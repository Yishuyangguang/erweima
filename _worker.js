export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const checkAuth = (req) => {
      const auth = req.headers.get('Authorization');
      const validPwd = env.ADMIN_PWD || 'admin123';
      return auth === `Bearer ${validPwd}`;
    };

    // 1. 管理员登录验证
    if (path === '/api/auth' && method === 'POST') {
      try {
        const body = await request.json();
        const validPwd = env.ADMIN_PWD || 'admin123';
        if (body.password === validPwd) {
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
      try {
        if (!env.BUCKET) throw new Error("R2 Bucket is not bound");
        const formData = await request.formData();
        const file = formData.get('file');
        if (!file) return new Response('No file provided', { status: 400, headers: corsHeaders });
        
        const fileId = Date.now() + '_' + Math.random().toString(36).substring(2, 8) + '_' + file.name;
        await env.BUCKET.put(fileId, file.stream(), { httpMetadata: { contentType: file.type } });
        
        return new Response(JSON.stringify({ 
          success: true, message: '已上传后台', url: `/r2/${fileId}`, name: file.name, size: file.size 
        }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ success: false, message: '后端存储异常' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // 3. 垃圾清理接口
    if (path === '/api/file' && method === 'DELETE') {
      if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      try {
        const body = await request.json();
        const fileUrl = body.url; 
        if (fileUrl && fileUrl.startsWith('/r2/') && env.BUCKET) {
          const key = decodeURIComponent(fileUrl.substring(4));
          await env.BUCKET.delete(key);
        }
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response('Bad Request', { status: 400, headers: corsHeaders });
      }
    }

    // 4. 全局配置文件读写 (修复 500 核心报错点)
    if (path === '/api/config') {
      if (method === 'GET') {
        try {
          if (!env.BUCKET) throw new Error("未绑定R2");
          const obj = await env.BUCKET.get('site_config.json');
          if (!obj) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
          return new Response(obj.body, { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
        } catch (err) {
          // 发生任何异常（无数据、未绑定），柔性降级返回空数组，避免前端白屏
          return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
        }
      }
      
      if (method === 'POST') {
        if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
        try {
          if (!env.BUCKET) throw new Error("未绑定R2");
          const data = await request.text();
          await env.BUCKET.put('site_config.json', data, { httpMetadata: { contentType: 'application/json' } });
          return new Response(JSON.stringify({ success: true, message: '已同步' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, message: '写入异常' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
      }
    }

    // 5. 媒体流读取
    if (path.startsWith('/r2/')) {
      try {
        if (!env.BUCKET) throw new Error("未绑定R2");
        const key = decodeURIComponent(path.substring(4));
        const obj = await env.BUCKET.get(key);
        if (!obj) return new Response('Not found', { status: 404, headers: corsHeaders });
        
        const responseHeaders = new Headers(corsHeaders);
        obj.writeHttpMetadata(responseHeaders);
        responseHeaders.set('etag', obj.httpEtag);
        return new Response(obj.body, { headers: responseHeaders });
      } catch (err) {
        return new Response('Server Error', { status: 500, headers: corsHeaders });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
