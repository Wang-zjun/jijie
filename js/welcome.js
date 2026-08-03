/* 解集 · welcome.js — 登录/注册（不再含主题选择与分步引导） */
const THEME_STAGE = {
  neon:"linear-gradient(135deg,#0f0c29,#302b63,#24243e)",
  glass:"linear-gradient(125deg,#667eea,#764ba2)",
  paper:"linear-gradient(135deg,#f7f3e8,#e6dbc0)",
  ink:"linear-gradient(135deg,#f3ecdc,#dccfb0)"
};

function el(id){ return document.getElementById(id); }

// ---- 账号 ----
function setTab(mode){
  el("loginform").style.display = mode==="login"?"block":"none";
  el("regform").style.display = mode==="reg"?"block":"none";
  el("tab-login").style.fontWeight = mode==="login"?"800":"400";
  el("tab-reg").style.fontWeight = mode==="reg"?"800":"400";
  el("autherr").textContent="";
}

function err(msg){ el("autherr").textContent = msg; }

el("loginform").addEventListener("submit", async e=>{
  e.preventDefault(); err("");
  const u = el("lu").value.trim(), p = el("lp").value;
  if(!u||!p) return err("请填写邮箱和密码");
  // 云端登录（若 Supabase 可用）
  if(window.Supabase){
    try{
      await Store.cloudLogin(u, p); // 成功后已 setAuth + pullUser
      // 封禁检查
      const me = Store.currentUser();
      if(me && me.banned){ await Store.cloudLogout(); return err("该账号已被封禁，请联系管理员"); }
      return finishCloud();
    }catch(e){ err("登录失败：" + e.message); }
  }
  // 降级：本地用户名登录（仅当存了本地用户）
  const users = Store.getUsers();
  const user = users.find(x=>x.username===u && x.pass===p);
  if(user){ if(user.banned){ return err("该账号已被封禁，请联系管理员"); } finishLocal(user.username); return; }
  if(!user) err("邮箱或密码错误");
});
el("regform").addEventListener("submit", async e=>{
  e.preventDefault(); err("");
  const mail = el("ru").value.trim(), n = el("rn").value.trim(), p = el("rp").value, p2 = el("rp2").value;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return err("请输入有效邮箱");
  if(p.length < 6) return err("密码至少 6 位");
  if(p !== p2) return err("两次密码不一致");
  if(window.Supabase){
    try{
      await Store.cloudRegister(mail, p);
      // 注册后存昵称
      if(n){ const users=Store.getUsers(); const u=users.find(x=>x.username===mail); if(u){ u.nick=n; Store.saveUsers(users); } }
      return finishCloud();
    }catch(e){ err("注册失败：" + e.message); }
  }
  // 降级本地注册
  const users = Store.getUsers();
  if(users.find(x=>x.username===mail)) return err("该账号已注册");
  users.push({username:mail, nick:n||mail, pass:p, admin:false, avatar:"", intro:"", points:20, solved:[], peekCount:{}, lucks:{}, registered:todayStr()});
  Store.saveUsers(users); finishLocal(mail);
});

function finishCloud(){
  // 普通用户登录：清掉可能残留的管理员切换标记
  try{ const cu=Store.currentUser(); if(cu && !cu.admin){ localStorage.removeItem('jijie_admin_session'); } }catch(e){}
  Store.setOnboarded();
  location.href = "index.html";
}
function finishLocal(username){
  Store.setAuth({username}); Store.setOnboarded();
  location.href = "index.html";
}

// 初始化
(function init(){
  // 背景用当前保存的主题（或默认霓虹）
  const theme = (window.Store && Store.getTheme()) || "neon";
  el("stage").style.background = THEME_STAGE[theme] || THEME_STAGE.neon;
  setTab("login");
})();
