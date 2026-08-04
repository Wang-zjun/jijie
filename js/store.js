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

    // 重进站点时恢复登录会话：刷新 token → 拉取本人 profile → 修正本地账号指向
    async restoreSession(){
      if(!window.Supabase) return;
      try{
        const s = await window.Supabase.restoreSession();
        if(!s) return;
        cloudReady = true;
        await this.cloudPullUser();
        return true;
      }catch(e){ return false; }
    },

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
    // 只写本地，不再触发云 push（供 cloudPushUser 内部回写合并后的 friends 等用，避免循环）
    saveUsersLocalOnly(u){ if(!Array.isArray(u)||!u.length) return; const all=this.getUsers(); const un=u[0].username; const i=all.findIndex(x=>x.username===un); if(i>=0){ all[i]=u[0]; } else { all.push(u[0]); } this.migrateUsers(all); localStorage.setItem(KEY_USERS, JSON.stringify(all)); },
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
        // 好友以「云端已有 + 本地」合并，不为空数组覆盖丢失 cloud 里的好友
        let cloudFriends=[];
        try{ const pf=await window.Supabase.select('profiles','friends',{id:uid}); if(Array.isArray(pf)&&pf[0]&&Array.isArray(pf[0].friends)) cloudFriends=pf[0].friends; }catch(e){}
        const mergedFriends=Array.from(new Set((me.friends||[]).concat(cloudFriends)));
        await window.Supabase.update('profiles',{
          nick:me.nick||me.username, admin:!!me.admin, avatar:me.avatar||'',
          intro:me.intro||'', points:(me.points===Infinity?null:me.points),
          solved:me.solved||[], peek_count:me.peekCount||{}, lucks:me.lucks||{}, friends:mergedFriends
        },{id:uid});
        if(me.friends===undefined || JSON.stringify(me.friends)!==JSON.stringify(mergedFriends)){ me.friends=mergedFriends; this.saveUsersLocalOnly([me]); }
      }catch(e){}
    },
    async cloudUpdateUser(){
      try{
        const me=this.currentUser(); if(!me) return;
        const tok=window.Supabase.getToken(); if(!tok) return;
        await this.cloudPushUser();
      }catch(e){}
    },

    // ---- 好友（双向，云端为准） ----
    // 按 username 查云端 profile（供加好友时回写对方、以及搜索）
    async cloudFindUserByUsername(username){
      try{
        const tok=window.Supabase.getToken(); if(!tok) return null;
        const rows=await window.Supabase.select('profiles','id,username,nick,admin,friends',{ username: username });
        return (Array.isArray(rows)&&rows[0])?rows[0]:null;
      }catch(e){ return null; }
    },
    // 更新对方 profile 的 friends（A加B时回写 B.friends += A）
    async cloudAddFriendFor(username, friendName){
      try{
        const tok=window.Supabase.getToken(); if(!tok) return;
        const p=await this.cloudFindUserByUsername(username);
        if(!p||!p.id) return;
        let fr=Array.isArray(p.friends)?p.friends:[];
        if(fr.includes(friendName)) return;
        fr.push(friendName);
        await window.Supabase.update('profiles',{ friends: fr },{ id: p.id });
      }catch(e){}
    },
    async cloudRemoveFriendFor(username, friendName){
      try{
        const tok=window.Supabase.getToken(); if(!tok) return;
        const p=await this.cloudFindUserByUsername(username);
        if(!p||!p.id) return;
        let fr=Array.isArray(p.friends)?p.friends:[];
        fr=fr.filter(x=>String(x)!==String(friendName));
        await window.Supabase.update('profiles',{ friends: fr },{ id: p.id });
      }catch(e){}
    },

    // ---- 邮件（洛谷式站内信，云端 mails 表） ----
    // 表结构见 supabase_schema.sql：id, from, to, subject, body, date, read, del_by_from, del_by_to
    async cloudSendMail(fromU, toU, subject, body){
      try{
        const tok=window.Supabase.getToken(); if(!tok) throw new Error('云端未登录');
        const ins=await window.Supabase.insert('mails',[{ from:fromU, to:toU, subject:subject, body:body, date:todayStr(), read:false, del_by_from:false, del_by_to:false }]);
        return ins;
      }catch(e){ throw e; }
    },
    // 收件箱：to=我 且 (未被我删 or 在云端已同步到本地)
    async cloudGetInbox(me){
      try{
        const tok=window.Supabase.getToken(); if(!tok) return [];
        const rows=await window.Supabase.select('mails','*',{ to: me });
        return Array.isArray(rows)?rows.filter(m=>!m.del_by_to):[];
      }catch(e){ return []; }
    },
    async cloudGetOutbox(me){
      try{
        const tok=window.Supabase.getToken(); if(!tok) return [];
        const rows=await window.Supabase.select('mails','*',{ from: me });
        return Array.isArray(rows)?rows.filter(m=>!m.del_by_from):[];
      }catch(e){ return []; }
    },
    // 删除：站在收件人角度删（del_by_to=true）；站在发件人角度删（del_by_from=true）
    // side = 'to' | 'from'
    async cloudDeleteMail(mailId, side){
      try{
        const tok=window.Supabase.getToken(); if(!tok) return;
        const patch = side==='to' ? { del_by_to:true } : { del_by_from:true };
        await window.Supabase.update('mails', patch, { id: mailId });
      }catch(e){}
    },
    // 标记已读
    async cloudMarkMailRead(mailId){
      try{
        const tok=window.Supabase.getToken(); if(!tok) return;
        await window.Supabase.update('mails', { read:true }, { id: mailId });
      }catch(e){}
    },
    // 云端删除一行（本地删除了就把云端对应 cloudId 的记录也删掉）
    async cloudDeleteRow(table, cloudId){
      if(cloudId===undefined||cloudId===null) return;
      try{
        const tok=window.Supabase.getToken(); if(!tok) return;
        await window.Supabase.remove(table, { id: cloudId });
        // 同时从已推送标记里摘掉，避免将来误判
        try{
          const PUSH_KEY='jijie_pushed';
          let pushed={}; try{ pushed=JSON.parse(localStorage.getItem(PUSH_KEY)||'{}'); }catch(e){ pushed={}; }
          const k=table;
          if(pushed[k]){ const i=pushed[k].indexOf(String(cloudId)); if(i>=0){ pushed[k].splice(i,1); localStorage.setItem(PUSH_KEY, JSON.stringify(pushed)); } }
        }catch(e){}
      }catch(e){}
    },
    async cloudPushDB(){
      // 推送新增到云端；以 cloudId 为唯一去重键，杜绝重推堆积。
      // 关键修复：本地 record 一旦推成功，就把云端返回的 id 写回本地(cloudId)，
      // 下次就不会再把同一条当新纪录重复 insert。
      try{
        const db=this.getDB();
        if(!db) return;
        const PUSH_KEY='jijie_pushed';
        let pushed={}; try{ pushed=JSON.parse(localStorage.getItem(PUSH_KEY)||'{}'); }catch(e){ pushed={}; }
        let changed=false; let dbChanged=false;
        const ins=async(table, rows, map, key)=>{
          if(!rows||!rows.length) return;
          const done=pushed[key]||[];
          // 只推「还没有 cloudId、且不在已推送标记里」的新纪录
          const todo=rows.filter(r=>!r.cloudId && !done.includes(String(r.id)));
          if(!todo.length) return;
          let inserted;
          try{ inserted=await window.Supabase.insert(table, todo.map(map)); }catch(e){ return; }
          // 把云端返回的 id 写回本地（marked 用本地 id 记录，cloudId 用于将来删除/去重）
          if(inserted && Array.isArray(inserted)){
            const byIdx={};
            todo.forEach((r,i)=>{ byIdx[i]=r; });
            inserted.forEach((cloudRow,ci)=>{
              const localRow=byIdx[ci];
              if(localRow && cloudRow && cloudRow.id!==undefined){ localRow.cloudId=cloudRow.id; }
            });
            dbChanged=true;
          }
          const merged=(pushed[key]||[]).concat(todo.map(r=>String(r.id)));
          pushed[key]=merged.slice(-500);
          changed=true;
        };
        await ins('posts', db.posts||[], r=>({ title:r.title, body:r.body, author:r.author, date:(r.date||todayStr()), pinned:!!r.pin, comments:r.comments||[] }), 'posts');
        await ins('resources', db.resources||[], r=>({ name:r.name, type:r.type, link:r.link, sub:r.sub||'', author:r.author, date:(r.date||todayStr()) }), 'resources');
        await ins('articles', db.articles||[], r=>({ title:r.title, body:r.body, tags:r.tags||'', author:r.author, date:(r.date||todayStr()) }), 'articles');
        await ins('problems', db.problems||[], r=>({ title:r.title, tag:r.tag||'综合', diff:r.diff||3, body:r.body, solution:r.solution||'', status:r.status||'pending', author:r.author, solves:r.solves||0, solvers:r.solvers||{}, solutions:r.solutions||[] }), 'problems');
        await ins('bounties', db.bounties||[], r=>({ title:r.title, body:r.body, reward_pts:r.rewardPts||0, author:r.author, date:(r.date||todayStr()), solved:!!r.solved, solver:r.solver||'', solution:r.solution||'' }), 'bounties');
        await ins('notices', db.notices||[], r=>({ title:r.title, body:r.body, tag:r.tag||'公告', date:(r.date||todayStr()) }), 'notices');
        if(dbChanged) localStorage.setItem(KEY_DB, JSON.stringify(db));
        if(changed) localStorage.setItem(PUSH_KEY, JSON.stringify(pushed));
      }catch(e){}
    },
    // 从云端全量拉取到本地（登录后/启动时调用）
    // 修复：按 cloudId 合并而不是粗暴整体覆盖 —— 云端有的、本地没有的才追加；
    // 本地已存在(同 cloudId)的以云端内容更新字段；本地新增但还没推云的保留。
    async cloudPullAll(){
      try{
        const tok=window.Supabase.getToken(); if(!tok) return;
        const db=this.getDB();
        let changed=false;
        const merge=async(tDef,localKey,map)=>{
          try{
            const rows=await window.Supabase.selectOrder(tDef,'*','id');
            if(!rows||!Array.isArray(rows)||!rows.length) return;
            const local=db[localKey]=db[localKey]||[];
            const cloudMapped=rows.map(map);
            // 本地已有 cloudId → 云端更新字段；否则追加（带 cloudId，防止重推）
            const localById={};
            local.forEach(r=>{ if(r.cloudId!==undefined) localById[String(r.cloudId)]=r; });
            const merged=[];
            const seen=new Set();
            cloudMapped.forEach(c=>{
              const existing=localById[String(c.cloudId)];
              if(existing){ Object.assign(existing, c); if(!c.cloudId) existing.cloudId=c.id; merged.push(existing); seen.add(String(c.cloudId)); }
              else { merged.push(c); seen.add(String(c.cloudId)); changed=true; }
            });
            // 保留本地新增、尚未有 cloudId 的纪录（不丢数据）
            local.forEach(r=>{ if(r.cloudId===undefined && !seen.has(''+r.id)) merged.push(r); });
            db[localKey]=merged;
          }catch(e){}
        };
        await merge('posts','posts', r=>({ cloudId:r.id, id:(r.id), title:r.title, body:r.body, author:r.author, date:r.date||todayStr(), pin:!!r.pinned, comments:r.comments||[] }));
        await merge('resources','resources', r=>({ cloudId:r.id, id:r.id, name:r.name, type:r.type, link:r.link, sub:r.sub||'', author:r.author, date:r.date||todayStr() }));
        await merge('articles','articles', r=>({ cloudId:r.id, id:r.id, title:r.title, body:r.body, tags:r.tags||'', author:r.author, date:r.date||todayStr() }));
        await merge('problems','problems', r=>({ cloudId:r.id, id:r.id, title:r.title, tag:r.tag||'综合', diff:r.diff||3, body:r.body, solution:r.solution||'', status:r.status||'approved', author:r.author, solves:r.solves||0, solvers:r.solvers||{}, solutions:r.solutions||[] }));
        await merge('bounties','bounties', r=>({ cloudId:r.id, id:r.id, title:r.title, body:r.body, rewardPts:r.reward_pts||0, author:r.author, date:r.date||todayStr(), solved:!!r.solved, solver:r.solver||'', solution:r.solution||'' }));
        await merge('notices','notices', r=>({ cloudId:r.id, id:r.id, title:r.title, body:r.body, tag:r.tag||'公告', date:r.date||todayStr() }));
        // 若管理员刚清空过通知（或普通用户无云端通知），不覆盖本地已清空的 notices
        try{ const cleared=localStorage.getItem('jijie_cleared_notices'); if(cleared && (Date.now()-Number(cleared))<86400000){ db.notices=[]; } }catch(e){}
        if(changed) localStorage.setItem(KEY_DB, JSON.stringify(db));
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
