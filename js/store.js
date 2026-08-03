/* 解集 · store.js — localStorage 数据层（当前本地演示，后续接云端） */
(function(){
  const PREFIX = "jijie_";
  const KEY_AUTH = PREFIX + "auth";
  const KEY_USERS = PREFIX + "users";
  const KEY_DB = PREFIX + "db";
  const KEY_THEME = PREFIX + "theme";
  const KEY_ONBOARDED = PREFIX + "onboarded";

  window.Store = {
    // ---- 主题 ----
    getTheme(){ return localStorage.getItem(KEY_THEME) || "neon"; },
    setTheme(t){ localStorage.setItem(KEY_THEME, t); },
    getOnboarded(){ return localStorage.getItem(KEY_ONBOARDED) === "1"; },
    setOnboarded(){ localStorage.setItem(KEY_ONBOARDED, "1"); },

    // ---- 用户 ----
    getUsers(){
      let arr = null;
      const raw = localStorage.getItem(KEY_USERS);
      if(raw){
        try{ arr = JSON.parse(raw); }catch(e){ arr = null; }
        if(!Array.isArray(arr)) arr = null;
      }
      if(!arr){
        // 脏数据/无数据 -> 用默认用户（defaultUsers 返回数组），并写回
        arr = defaultUsers();
        localStorage.setItem(KEY_USERS, JSON.stringify(arr));
      }
      return this.migrateUsers(arr);
    },
    migrateUsers(arr){
      let changed=false;
      arr.forEach(u=>{
        if(u.points===undefined){ u.points = u.admin?Infinity:20; changed=true; }
        if(!u.peekCount){ u.peekCount={}; changed=true; }
        if(!u.lucks){ u.lucks={}; changed=true; }
        if(u.avatar===undefined){ u.avatar=""; changed=true; }
      });
      if(changed){ localStorage.setItem(KEY_USERS, JSON.stringify(arr)); }
      return arr;
    },
    saveUsers(u){ this.migrateUsers(u); localStorage.setItem(KEY_USERS, JSON.stringify(u)); },
    getAuth(){ try{ return JSON.parse(localStorage.getItem(KEY_AUTH)); }catch(e){ return null; } },
    setAuth(a){ localStorage.setItem(KEY_AUTH, JSON.stringify(a)); },
    clearAuth(){ localStorage.removeItem(KEY_AUTH); },
    currentUser(){
      const a = this.getAuth(); if(!a) return null;
      return this.getUsers().find(u=>u.username===a.username) || null;
    },

    // ---- 数据库（帖子等） ----
    getDB(){
      const raw = localStorage.getItem(KEY_DB);
      let db = null;
      if(raw){
        try{ db = JSON.parse(raw); }catch(e){ db = null; }
        if(db && typeof db !== 'object') db = null;
        if(db && Array.isArray(db)) db = null; // 脏数据
      }
      if(!db){
        const seeded = seedDB();
        localStorage.setItem(KEY_DB, JSON.stringify(seeded));
        return seeded;
      }
      return this.migrateDB(db);
    },
    migrateDB(db){
      let changed=false;
      // 确保 signs 带 points
      const freshSigns = window.JIJIE_DB.signs;
      if(db.signs && db.signs.length && !('points' in db.signs[0])){
        db.signs = JSON.parse(JSON.stringify(freshSigns)); changed=true;
      }
      // 确保问题和悬赏字段齐全
      (db.problems||[]).forEach(p=>{ if(p.status===undefined){ p.status='approved'; changed=true; } });
      (db.bounties||[]).forEach(b=>{ if(b.rewardPts===undefined){ b.rewardPts = 0; } });
      if(changed) this.saveDB(db);
      return db;
    },
    saveDB(db){ localStorage.setItem(KEY_DB, JSON.stringify(db)); },
    resetDB(){ localStorage.removeItem(KEY_DB); this.getDB(); },

    // ---- 每日打卡（存到用户账号，跟随账号而非浏览器） ----
    getLuck(dateStr, username){
      const uname = username || (this.getAuth()||{}).username;
      if(!uname) return null;
      const users = this.getUsers();
      const u = users.find(x=>x.username===uname);
      if(!u || !u.lucks) return null;
      const luck = u.lucks[dateStr];
      if(!luck) return null;
      // 缂撅细鑻ユ棫璁板綍鏃?points锛屼粠褰撳墠 signs 缁冨寲
      if(luck.points===undefined){
        const fresh = (window.JIJIE_DB.signs||[]).find(s=>s.name===luck.name);
        luck.points = (fresh && fresh.points!==undefined) ? fresh.points : 0;
      }
      return luck;
    },
    setLuck(dateStr, val, username){
      const uname = username || (this.getAuth()||{}).username;
      if(!uname) return;
      const users = this.getUsers();
      const u = users.find(x=>x.username===uname);
      if(!u) return;
      if(!u.lucks) u.lucks = {};
      u.lucks[dateStr] = val;
      this.saveUsers(users);
    },
  };

  function defaultUsers(){
    return JSON.parse(JSON.stringify([
      {username:"admin", nick:"管理员", pass:"admin123", admin:true, avatar:"", intro:"解集的守护者。", solved:[], points:Infinity, registered:"2026-08-03"}
    ]));
  }

  // 给 DB 里带上默认用户（管理员的展示信息在 users，其他地方按需引用）
  function seedDB(){
    const db = JSON.parse(JSON.stringify(window.JIJIE_DB));
    // 移除 users（users 单独存）；posts 等默认留空
    delete db.users;
    db.quotes = window.JIJIE_DB.quotes;
    db.signs = window.JIJIE_DB.signs;
    db.notices = (window.JIJIE_DB.notices||[]).map((n,i)=>({id:i+1, ...n}));
    return db;
  }

  window.todayStr = function(){
    const d=new Date();
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  };
})();
