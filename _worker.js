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

    // 鉴权中间件
    const checkAuth = (req) => {
      const auth = req.headers.get('Authorization');
      const validPwd = env.ADMIN_PWD || 'admin123';
      return auth === `Bearer ${validPwd}`;
    };

    // 1. 管理员登录验证
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
      
      const fileId = Date.now() + '_' + Math.random().toString(36).substring(2, 8) + '_' + file.name;
      
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

    // 3. 垃圾清理接口 (从 R2 删除缓存文件)
    if (path === '/api/file' && method === 'DELETE') {
      if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      try {
        const body = await request.json();
        const fileUrl = body.url; 
        if (fileUrl && fileUrl.startsWith('/r2/')) {
          const key = decodeURIComponent(fileUrl.substring(4));
          await env.BUCKET.delete(key);
        }
        return new Response(JSON.stringify({ success: true, message: '缓存已自动清理' }), { 
          status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        });
      } catch (e) {
        return new Response('Bad Request', { status: 400, headers: corsHeaders });
      }
    }

    // 4. 全局配置文件读写
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

    // 5. 媒体流读取
    if (path.startsWith('/r2/')) {
      const key = decodeURIComponent(path.substring(4));
      const obj = await env.BUCKET.get(key);
      if (!obj) return new Response('Not found', { status: 404, headers: corsHeaders });
      
      const responseHeaders = new Headers(corsHeaders);
      obj.writeHttpMetadata(responseHeaders);
      responseHeaders.set('etag', obj.httpEtag);
      return new Response(obj.body, { headers: responseHeaders });
    }

    return env.ASSETS.fetch(request);
  }
};
