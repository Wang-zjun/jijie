/* 解集 · supabase.js — 云端数据层（原生 REST，无需构建，GitHub Pages 可直接跑）
   用 Supabase REST + Auth API 替代 localStorage 假后端。
   使用说明：在 index.html/welcome.html 里 <script src="js/supabase.js"></script> 放最前。 */
(function(){
  const BASE = 'https://ijpziqovwdflorxyftse.supabase.co';
  const ANON = 'sb_publishable_yIhpRAHz4ygS2zzDhvSKdQ_vO3Pzx0R';

  function authHeaders(token){
    return { 'apikey': ANON, 'Authorization': 'Bearer ' + (token || ANON), 'Content-Type': 'application/json' };
  }

  async function req(path, opts){
    const r = await fetch(BASE + path, opts);
    if(!r.ok){
      let detail = r.status + ' ' + r.statusText;
      try{ const j = await r.json(); detail = (j.error_description || j.message || j.msg || detail) + (j.error?(' ['+j.error+']'):''); }catch(e){}
      throw new Error('Supabase ' + detail);
    }
    if(r.status===204) return null;
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }

  // 会话 token 存取（Supabase 官方 key 名）
  const TOKEN_KEY = 'sb-' + BASE.split('//')[1] + '-auth-token';
  function getToken(){
    try{
      const raw = localStorage.getItem(TOKEN_KEY);
      if(raw){ const j=JSON.parse(raw); return j.access_token; }
    }catch(e){}
    try{ const raw=localStorage.getItem('supabase.auth.token'); if(raw){ const j=JSON.parse(raw); return j.access_token; } }catch(e){}
    return null;
  }
  function setToken(session){
    if(!session) return;
    // 存成 Supabase 标准结构 {access_token, refresh_token, expires_at, user}
    const store = {
      access_token: session.access_token,
      refresh_token: session.refresh_token||'',
      expires_at: session.expires_at ? session.expires_at : (Date.now()/1000 + 3600),
      user: session.user||null
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(store));
  }
  function clearToken(){ try{ localStorage.removeItem(TOKEN_KEY); }catch(e){} }

  window.Supabase = {
    BASE, ANON,
    getToken,
    authHeaders,

    // ===== Auth =====
    async register(email, password){
      const r = await req('/auth/v1/signup', {
        method:'POST',
        headers: authHeaders(null),
        body: JSON.stringify({ email, password })
      });
      if(r && r.access_token) setToken(r);
      return r;
    },
    async login(email, password){
      const r = await req('/auth/v1/token?grant_type=password', {
        method:'POST',
        headers: authHeaders(null),
        body: JSON.stringify({ email, password })
      });
      if(r && r.access_token) setToken(r);
      return r; // {access_token, user, ...}
    },
    async logout(){
      const r = await req('/auth/v1/logout', {
        method:'POST',
        headers: authHeaders(getToken())
      });
      clearToken();
      return r;
    },
    async getUser(){
      const tok = getToken();
      if(!tok) return null;
      const r = await req('/auth/v1/user', { headers: authHeaders(tok) });
      return r;
    },

    // ===== 通用表操作 =====
    async select(table, select='*', filter={}){
      let url = '/rest/v1/' + table + '?select=' + encodeURIComponent(select);
      for(const k in filter){
        if(filter[k] !== undefined && filter[k] !== null){
          // 简单等值；复杂用法后续扩展
          url += '&' + encodeURIComponent(k) + '=eq.' + encodeURIComponent(filter[k]);
        }
      }
      const r = await req(url, { headers: authHeaders(getToken()) });
      return r;
    },
    async insert(table, rows){
      const r = await req('/rest/v1/' + table, {
        method:'POST',
        headers: authHeaders(getToken()),
        body: JSON.stringify(Array.isArray(rows)?rows:[rows])
      });
      return r;
    },
    async update(table, patch, filter){
      let url = '/rest/v1/' + table;
      for(const k in filter){
        if(filter[k]!==undefined) url += (url.includes('?')?'&':'?') + encodeURIComponent(k) + '=eq.' + encodeURIComponent(filter[k]);
      }
      const r = await req(url, {
        method:'PATCH',
        headers: authHeaders(getToken()),
        body: JSON.stringify(patch)
      });
      return r;
    },
    async remove(table, filter){
      let url = '/rest/v1/' + table;
      for(const k in filter){
        if(filter[k]!==undefined) url += (url.includes('?')?'&':'?') + encodeURIComponent(k) + '=eq.' + encodeURIComponent(filter[k]);
      }
      const r = await req(url, {
        method:'DELETE',
        headers: authHeaders(getToken())
      });
      return r;
    },
    // order 辅助：select 里带 order
    async selectOrder(table, select, orderBy, ascending){
      const r = await req('/rest/v1/' + table + '?select=' + encodeURIComponent(select) + '&order=' + encodeURIComponent(orderBy + (ascending?'':'') + (ascending===false?'.desc':'')), { headers: authHeaders(getToken()) });
      return r;
    }
  };
})();
