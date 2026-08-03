/* 解集 · store.js — 数据层（本地缓存 + Supabase 云同步）
   读取：本地缓存优先（秒开），后台云端刷新。
   写入：本地缓存 + 异步推云端（失败降级，不阻塞 UI）。
   兼容：无网络/未登录时纯本地 demo 模式。 */
(function(){
  const PREFIX = "jijie_";
  const KEY_AUTH = PREFIX + "auth";       // 本地登录态（指本地 cache 的账号）
  const KEY_USERS = PREFIX + "users";
  const KEY_DB = PREFIX + "db";
  const KEY_THEME = PREFIX + "theme";
  const KEY_ONBOARDED = PREFIX + "onboarded";
  const KEY_TRUST = PREFIX + "trust";     // 是否云已验证（登录过）

  // 云端就绪标志
  let cloudReady = false;
  window.Store = {

    // ---- 主题 / 引导 ----
    getTheme(){ return localStorage.getItem(KEY_THEME) || "neon"; },
    setTheme(t){ localStorage.setItem(KEY_THEME, t); },
    getOnboarded(){ return localStorage.getItem(KEY_ONBOARDED) === "1"; },
    setOnboarded(){ localStorage.setItem(KEY_ONBOARDED, "1"); },
    getTrust(){ return localStorage.getItem(KEY_TRUST) === "1"; },
    setTrust(){ localStorage.setItem(KEY_TRUST, "1"); },
    isCloud(){ return cloudReady; },

    // ================= 用户 =================
    getUsers(){
      let arr = null;
      const raw = localStorage.getItem(KEY_USERS);
      if(raw){ try{ arr = JSON.parse(raw); }catch(e){ arr=null; } if(!Array.isArray(arr)) arr=null; }
      if(!arr){ arr = JSON.parse(JSON.stringify([{username:"admin", nick:"管理员", pass:"admin123", admin:true, avatar:"", intro:"解集的守护者。", solved:[], points:Infinity, lucks:{}, peekCount:{}, friends:[], registered:"2026-08-03"}])); localStorage.setItem(KEY_USERS, JSON.stringify(arr)); }
      return this.migrateUsers(arr);
    },
    migrateUsers(arr){
      let changed=false;
      arr.forEach(u=>{
        if(u.points===undefined){ u.points = u.admin?Infinity:20; changed=true; }
        if(!u.peekCount){ u.peekCount={}; changed=true; }
        if(!u.lucks){ u.lucks={}; changed=true; }
        if(!u.friends){ u.friends=[]; changed=true; }
        if(u.avatar===undefined){ u.avatar=""; changed=true; }
      });
      if(changed) localStorage.setItem(KEY_USERS, JSON.stringify(arr));
      return arr;
    },
    saveUsers(u){ this.migrateUsers(u); localStorage.setItem(KEY_USERS, JSON.stringify(u));
      // 云：更新当前登录用户的 profile
      this.cloudUpdateUser();
    },
    getAuth(){ try{ return JSON.parse(localStorage.getItem(KEY_AUTH)); }catch(e){ return null; } },
    setAuth(a){ localStorage.setItem(KEY_AUTH, JSON.stringify(a)); },
    clearAuth(){ localStorage.removeItem(KEY_AUTH); localStorage.removeItem(KEY_TRUST); },
    // 云端登录的用户（用 supabase token 判断）——供 app 判断当前人
    currentUser(){
      const a = this.getAuth(); if(!a) return null;
      // 若已云登录且本地 auth 是云端账号名，返回本地对应 user（含积分等）
      return this.getUsers().find(u=>u.username===a.username) || { username:a.username, nick:a.username, avatar:"", points:20, solved:[], lucks:{}, peekCount:{}, friends:[] };
    },

    // ================= 数据库（帖子/题目/悬赏等）=================
    getDB(){
      let db=null;
      const raw=localStorage.getItem(KEY_DB);
      if(raw){ try{ db=JSON.parse(raw); }catch(e){ db=null; } if(!db||typeof db!=='object'||Array.isArray(db)) db=null; }
      if(!db){ db = seedDB(); localStorage.setItem(KEY_DB, JSON.stringify(db)); }
      return this.migrateDB(db);
    },
    migrateDB(db){
      let ch=false;
      const fresh=window.JIJIE_DB.signs;
      if(db.signs&&db.signs.length&&!('points' in db.signs[0])){ db.signs=JSON.parse(JSON.stringify(fresh)); ch=true; }
      (db.problems||[]).forEach(p=>{ if(p.status===undefined){p.status='approved';ch=true;} });
      (db.bounties||[]).forEach(b=>{ if(b.rewardPts===undefined){b.rewardPts=0;} });
      if(ch) localStorage.setItem(KEY_DB, JSON.stringify(db));
      return db;
    },
    saveDB(db){ localStorage.setItem(KEY_DB, JSON.stringify(db));
      // 云：push 到各表
      this.cloudPushDB();
    },
    resetDB(){ localStorage.removeItem(KEY_DB); this.getDB(); },

    // ================= 每日打卡（存账号）=================
    getLuck(dateStr, username){
      const uname = username || (this.getAuth()||{}).username;
      if(!uname) return null;
      const u = this.getUsers().find(x=>x.username===uname);
      if(!u||!u.lucks) return null;
      const luck=u.lucks[dateStr];
      if(!luck) return null;
      if(luck.points===undefined){ const f=(window.JIJIE_DB.signs||[]).find(s=>s.name===luck.name); luck.points=(f&&f.points!==undefined)?f.points:0; }
      return luck;
    },
    setLuck(dateStr, val, username){
      const uname = username || (this.getAuth()||{}).username;
      if(!uname) return;
      const users=this.getUsers(); const u=users.find(x=>x.username===uname);
      if(!u) return;
      if(!u.lucks) u.lucks={};
      u.lucks[dateStr]=val;
      this.saveUsers(users);
    },

    // ================= 云端同步层 =================
    // 云仅在用户通过 Supabase 登录后启用（cloudReady）。未登录时纯本地。
    async cloudLogin(email, password){
      if(!window.Supabase) throw new Error('云端未加载');
      const res = await window.Supabase.login(email, password); // {access_token, user:{email,...}}
      if(!res || !res.access_token) throw new Error('登录失败');
      cloudReady = true;
      // 取 profile
      await this.cloudPullUser();
      return res;
    },
    async cloudRegister(email, password){
      if(!window.Supabase) throw new Error('云端未加载');
      const res = await window.Supabase.register(email, password);
      cloudReady = true;
      await this.cloudPullUser();
      return res;
    },
    async cloudLogout(){
      try{ await window.Supabase.logout(); }catch(e){}
      this.clearAuth(); cloudReady=false;
    },
    async cloudPullUser(){
      try{
        const tok = window.Supabase.getToken();
        if(!tok) return;
        // 查自己的 profile（按 id = auth.uid）
        const rows = await window.Supabase.getUser();
        if(!rows || !rows.id) return;
        const prof = await window.Supabase.select('profiles','*',{id: rows.id});
        const p = Array.isArray(prof) && prof[0] ? prof[0] : null;
        if(!p) return;
        // p.username 即注册邮箱（触发器用邮箱前半段做 username）
        const uname = p.username;
        const users=this.getUsers();
        let me=users.find(u=>u.username===uname);
        if(!me){ me={username:uname, admin:!!p.admin, avatar:p.avatar||'', intro:p.intro||'', points:(p.points!==undefined?p.points:20), solved:p.solved||[], lucks:p.lucks||{}, peekCount:p.peek_count||{}, friends:p.friends||[], registered:Date.now()}; users.push(me); }
        else { me.admin=!!p.admin; me.avatar=p.avatar||me.avatar; me.intro=(p.intro!==undefined?p.intro:me.intro); if(p.points!==undefined) me.points=p.points; me.solved=p.solved||me.solved; me.lucks=p.lucks||me.lucks; me.peekCount=p.peek_count||me.peekCount; me.friends=p.friends||me.friends||[]; }
        this.saveUsers(users);
        this.setAuth({username:uname});
        this.setTrust();
        this.cloudPushUser();
      }catch(e){ /* 静默 */ }
    },
    async cloudPushUser(){
      try{
        const tok=window.Supabase.getToken(); if(!tok) return;
        const rows=await window.Supabase.getUser(); const uid=rows&&rows.id; if(!uid) return;
        const me=this.currentUser(); if(!me) return;
        await window.Supabase.update('profiles',{
          nick:me.nick||me.username, admin:!!me.admin, avatar:me.avatar||'',
          intro:me.intro||'', points:(me.points===Infinity?null:me.points),
          solved:me.solved||[], peek_count:me.peekCount||{}, lucks:me.lucks||{}, friends:me.friends||[]
        },{id:uid});
      }catch(e){}
    },
    async cloudUpdateUser(){
      try{
        const me=this.currentUser(); if(!me) return;
        const tok=window.Supabase.getToken(); if(!tok) return;
        await this.cloudPushUser();
      }catch(e){}
    },
    async cloudPushDB(){
      // 把本地 DB 各表推送到云端（按字段映射后 insert；失败静默）
      try{
        const db=this.getDB();
        if(!db) return;
        const ins=async(t, rows, map)=>{ if(!t||!rows||!rows.length) return; try{ await window.Supabase.insert(t, rows.map(map)); }catch(e){} };
        const P = (p)=> p.pin!==undefined ? (p.pinned!==undefined?{...p,pinned:p.pin}:{...p,pinned:p.pin}) : p;
        await ins('posts', db.posts||[], r=>({ title:r.title, body:r.body, author:r.author, date:(r.date||todayStr()), pinned:!!r.pin, comments:r.comments||[] }));
        await ins('resources', db.resources||[], r=>({ name:r.name, type:r.type, link:r.link, sub:r.sub||'', author:r.author, date:(r.date||todayStr()) }));
        await ins('articles', db.articles||[], r=>({ title:r.title, body:r.body, tags:r.tags||'', author:r.author, date:(r.date||todayStr()) }));
        await ins('problems', db.problems||[], r=>({ title:r.title, tag:r.tag||'综合', diff:r.diff||3, body:r.body, solution:r.solution||'', status:r.status||'pending', author:r.author, solves:r.solves||0, solvers:r.solvers||{}, solutions:r.solutions||[] }));
        await ins('bounties', db.bounties||[], r=>({ title:r.title, body:r.body, reward_pts:r.rewardPts||0, author:r.author, date:(r.date||todayStr()), solved:!!r.solved, solver:r.solver||'', solution:r.solution||'' }));
        await ins('notices', db.notices||[], r=>({ title:r.title, body:r.body, tag:r.tag||'公告', date:(r.date||todayStr()) }));
      }catch(e){}
    },
    // 从云端全量拉取到本地（登录后/启动时调用）
    async cloudPullAll(){
      try{
        const tok=window.Supabase.getToken(); if(!tok) return;
        const db=this.getDB();
        const G=async(tDef,localKey,map)=>{ try{ const rows=await window.Supabase.selectOrder(tDef,'*','id'); if(rows&&Array.isArray(rows)&&rows.length){ db[localKey]=map?rows.map(map):rows; } }catch(e){} };
        await G('posts','posts', r=>({ id:r.id, title:r.title, body:r.body, author:r.author, date:r.date||todayStr(), pin:!!r.pinned, comments:r.comments||[], cloudId:r.id }));
        await G('resources','resources', r=>({ id:r.id, name:r.name, type:r.type, link:r.link, sub:r.sub||'', author:r.author, date:r.date||todayStr() }));
        await G('articles','articles', r=>({ id:r.id, title:r.title, body:r.body, tags:r.tags||'', author:r.author, date:r.date||todayStr() }));
        await G('problems','problems', r=>({ id:r.id, title:r.title, tag:r.tag||'综合', diff:r.diff||3, body:r.body, solution:r.solution||'', status:r.status||'approved', author:r.author, solves:r.solves||0, solvers:r.solvers||{}, solutions:r.solutions||[] }));
        await G('bounties','bounties', r=>({ id:r.id, title:r.title, body:r.body, rewardPts:r.reward_pts||0, author:r.author, date:r.date||todayStr(), solved:!!r.solved, solver:r.solver||'', solution:r.solution||'' }));
        await G('notices','notices', r=>({ id:r.id, title:r.title, body:r.body, tag:r.tag||'公告', date:r.date||todayStr() }));
        localStorage.setItem(KEY_DB, JSON.stringify(db));
      }catch(e){}
    }
  };

  function seedDB(){
    const db=JSON.parse(JSON.stringify(window.JIJIE_DB));
    delete db.users;
    db.quotes=window.JIJIE_DB.quotes; db.signs=window.JIJIE_DB.signs;
    db.notices=(window.JIJIE_DB.notices||[]).map((n,i)=>({id:i+1,...n}));
    return db;
  }

  window.todayStr = function(){
    const d=new Date();
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  };
})();
