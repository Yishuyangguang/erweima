export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 跨域处理 (CORS)
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 极简鉴权中间件：验证请求头中的口令
    const checkAuth = (req) => {
      const auth = req.headers.get('Authorization');
      // 默认密码为 admin123，您可以在 CF 环境变量中设置 ADMIN_PWD 覆盖
      const validPwd = env.ADMIN_PWD || 'admin123';
      return auth === `Bearer ${validPwd}`;
    };

    // 1. 管理员登录验证接口
    if (path === '/api/auth' && method === 'POST') {
      try {
        const body = await request.json();
        if (body.password === (env.ADMIN_PWD || 'admin123')) {
          return new Response(JSON.stringify({ success: true, token: body.password }), { 
            status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          });
        }
        return new Response(JSON.stringify({ success: false, message: '密码错误' }), { 
          status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        });
      } catch (e) {
        return new Response('Bad Request', { status: 400, headers: corsHeaders });
      }
    }

    // 2. 文件上传接口 (写入 R2)
    if (path === '/api/upload' && method === 'POST') {
      if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file) return new Response('No file provided', { status: 400, headers: corsHeaders });
      
      // 生成防冲突的唯一文件名
      const fileId = Date.now() + '_' + Math.random().toString(36).substring(2, 8) + '_' + file.name;
      
      // 写入 R2 储存桶
      await env.BUCKET.put(fileId, file.stream(), {
        httpMetadata: { contentType: file.type }
      });
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: '已上传后台',
        url: `/r2/${fileId}`, 
        name: file.name, 
        size: file.size 
      }), { 
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    // 3. 全局配置文件读写接口 (保存在 R2 中的 site_config.json)
    if (path === '/api/config') {
      if (method === 'GET') {
        const obj = await env.BUCKET.get('site_config.json');
        if (!obj) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json', ...corsHeaders }});
        return new Response(obj.body, { headers: { 'Content-Type': 'application/json', ...corsHeaders }});
      }
      
      if (method === 'POST') {
        if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
        const data = await request.text();
        await env.BUCKET.put('site_config.json', data, {
          httpMetadata: { contentType: 'application/json' }
        });
        return new Response(JSON.stringify({ success: true, message: '已同步至后台' }), { 
          status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        });
      }
    }

    // 4. 读取 R2 媒体与文件接口
    if (path.startsWith('/r2/')) {
      const key = decodeURIComponent(path.substring(4));
      const obj = await env.BUCKET.get(key);
      if (!obj) return new Response('Not found', { status: 404, headers: corsHeaders });
      
      const responseHeaders = new Headers(corsHeaders);
      obj.writeHttpMetadata(responseHeaders);
      responseHeaders.set('etag', obj.httpEtag);
      return new Response(obj.body, { headers: responseHeaders });
    }

    // 兜底：如果是页面请求，交还给 CF Pages 托管的静态文件 (如 index.html)
    return env.ASSETS.fetch(request);
  }
};
