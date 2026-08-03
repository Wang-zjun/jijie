/* 解集 · welcome.js — 三步引导逻辑 */
const THEMES = [
  {key:"neon",  name:"霓虹",  icon:"🌃", bg:"linear-gradient(135deg,#0f0c29,#302b63,#24243e)", desc:"黑底荧光·赛博"},
  {key:"glass", name:"玻璃拟态", icon:"💠", bg:"linear-gradient(125deg,#667eea,#764ba2)", desc:"毛玻璃·通透"},
  {key:"paper", name:"纸张",  icon:"📜", bg:"linear-gradient(135deg,#f7f3e8,#e6dbc0)", desc:"米黄仿纸·文青"},
  {key:"ink",   name:"水墨古风", icon:"🕯️", bg:"linear-gradient(135deg,#f3ecdc,#dccfb0)", desc:"宣纸朱砂·古风"},
];
const THEME_CSS = {
  neon:"css/theme-neon.css", glass:"css/theme-glass.css",
  paper:"css/theme-paper.css", ink:"css/theme-ink.css"
};
const THEME_STAGE = {
  neon:"linear-gradient(135deg,#0f0c29,#302b63,#24243e)",
  glass:"linear-gradient(125deg,#667eea,#764ba2)",
  paper:"linear-gradient(135deg,#f7f3e8,#e6dbc0)",
  ink:"linear-gradient(135deg,#f3ecdc,#dccfb0)"
};

let current = 1, selTheme = Store.getTheme();

function el(id){ return document.getElementById(id); }

function buildThemes(){
  const wrap = el("themes");
  wrap.innerHTML = "";
  THEMES.forEach(t=>{
    const s = document.createElement("button");
    s.className = "tcard" + (t.key===selTheme ? " sel" : "");
    s.innerHTML = `<div class="swatch" style="background:${t.bg}">
        <div class="ti">${t.icon}</div><div class="tn">${t.name}</div>
      </div>
      <div class="td">${t.desc}</div>
      <div class="chk">✓</div>`;
    s.onclick = ()=>{ selTheme = t.key; document.querySelectorAll(".tcard").forEach(c=>c.classList.remove("sel")); s.classList.add("sel"); livePreview(t.key); };
    wrap.appendChild(s);
  });
}

function livePreview(key){
  // 切换预览条配色（模拟 mini 导航）
  const t = THEMES.find(x=>x.key===key);
  const pb = el("previewbar"); const top = el("pbtop"); const bar = el("pbbar");
  pb.style.display = "block";
  pb.style.background = t.bg;
  const fg = (key==="paper"||key==="ink") ? "#3a332a" : "#fff";
  top.innerHTML = `<span style="font-weight:800;font-size:15px;color:${fg}">解集</span><span style="font-size:12px;color:${fg}">SOLUTION SET</span>`;
  const items = ["讨论板","题库","悬赏板","邮箱"];
  bar.innerHTML = items.map(i=>`<div class="pb-item" style="color:${fg};background:${key==='glass'?'rgba(255,255,255,.35)':'rgba(255,255,255,.14)'}">${i}</div>`).join("");
  // 背景也微调
  el("stage").style.background = t.bg;
}

function go(n){
  current = n;
  document.querySelectorAll(".step").forEach(s=>{
    s.classList.toggle("active", +s.dataset.step===n);
    if(+s.dataset.step===2){ el("s2title").style.color = (n===2? pickFg() : ""); }
  });
  el("prog").style.width = (n/3*100)+"%";
  updateDots();
  if(n===2) buildThemes();
}

function pickFg(){ return (selTheme==="paper"||selTheme==="ink") ? "#3a332a" : "#fff"; }

function updateDots(){
  let d = el("dots"); d.innerHTML="";
  for(let i=1;i<=3;i++){
    const b=document.createElement("div");
    b.className="dot"+(i<=current?" on":"");
    d.appendChild(b);
  }
}

function setStage(){
  el("stage").style.background = THEME_STAGE[selTheme];
}

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
      if(n){ const uname = mail; const users=Store.getUsers(); const u=users.find(x=>x.username===uname); if(u){ u.nick=n; Store.saveUsers(users); } }
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
  Store.setTheme(selTheme); Store.setOnboarded();
  location.href = "index.html";
}
function finishLocal(username){
  Store.setAuth({username}); Store.setTheme(selTheme); Store.setOnboarded();
  location.href = "index.html";
}

function skipAll(){
  Store.setTheme(selTheme);
  Store.setOnboarded();
  location.href = "index.html";
}

// 初始化
(function init(){
  // 预载当前主题样式
  el("wtheme").href = THEME_CSS[selTheme];
  setStage();
  updateDots();
  setTab("login");
  buildThemes();
})();
