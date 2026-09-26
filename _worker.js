export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 追加 Access-Control-Expose-Headers 供前端计算真实进度百分比
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Expose-Headers': 'Content-Length',
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
        if (!env.BUCKET) throw new Error("R2 储存桶未绑定 (BUCKET 变量缺失)");
        
        const formData = await request.formData();
        const file = formData.get('file');
        if (!file) throw new Error("接收到的文件为空");
        
        // 文件名安全过滤：去除非法字符，防止路径注入或 R2 解析失败
        const safeName = file.name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9.\-_]/g, '_');
        const fileId = Date.now() + '_' + Math.random().toString(36).substring(2, 6) + '_' + safeName;
        
        const fileBuffer = await file.arrayBuffer();
        const mimeType = file.type || 'application/octet-stream';

        await env.BUCKET.put(fileId, fileBuffer, { 
            httpMetadata: { contentType: mimeType } 
        });
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: '已上传后台', 
          url: `/r2/${fileId}`, 
          name: file.name, 
          size: file.size 
        }), { 
            status: 200, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        });

      } catch (err) {
        console.error('Upload Error:', err.message);
        return new Response(JSON.stringify({ 
            success: false, 
            message: `云端异常: ${err.message}` 
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        });
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

    // 4. 全局配置文件读写
    if (path === '/api/config') {
      if (method === 'GET') {
        try {
          if (!env.BUCKET) throw new Error("未绑定R2");
          const obj = await env.BUCKET.get('site_config.json');
          if (!obj) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
          return new Response(obj.body, { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
        } catch (err) {
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
