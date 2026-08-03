/* 解集 · app.js — 主应用逻辑 */
const THEME_CSS = {
  neon:"css/theme-neon.css", glass:"css/theme-glass.css",
  paper:"css/theme-paper.css", ink:"css/theme-ink.css"
};
const THEMES = [
  {key:"neon",name:"霓虹",icon:"🌃",bg:"linear-gradient(135deg,#0f0c29,#302b63,#24243e)"},
  {key:"glass",name:"玻璃拟态",icon:"💠",bg:"linear-gradient(125deg,#667eea,#764ba2)"},
  {key:"paper",name:"纸张",icon:"📜",bg:"linear-gradient(135deg,#f7f3e8,#e6dbc0)"},
  {key:"ink",name:"水墨古风",icon:"🕯️",bg:"linear-gradient(135deg,#f3ecdc,#dccfb0)"},
];
const AVATAR_COLORS = ["#e8562a","#2d6a9f","#2e8b57","#7c3aed","#db2777","#b45309","#0e7490","#4d7c0f","#9333ea","#c2410c"];

function avatarHtml(user, px){
  px = px || 42;
  // 自定义头像（image/... base64）优先
  if(user && user.avatarImg) return `<img class="av-img" src="${user.avatarImg}" style="width:${px}px;height:${px}px">`;
  const letter = ((user&&user.nick)||(user&&user.username)||"?").charAt(0).toUpperCase();
  const name = (user&&user.username)||"?";
  const color = AVATAR_COLORS[Math.abs((name.charCodeAt(0)||0)) % AVATAR_COLORS.length];
  return `<span class="av-letter" style="width:${px}px;height:${px}px;background:${color}">${letter}</span>`;
}
function profileImg(user){
  if(user && user.avatarImg) return `<img class="av-img" src="${user.avatarImg}" style="width:76px;height:76px">`;
  const letter = ((user&&user.nick)||(user&&user.username)||"?").charAt(0).toUpperCase();
  const color = AVATAR_COLORS[Math.abs((((user&&user.username)||"?").charCodeAt(0)||0)) % AVATAR_COLORS.length];
  return `<span class="av-letter" style="width:76px;height:76px;font-size:34px;background:${color}">${letter}</span>`;
}

const $ = id => document.getElementById(id);
let currentPage = "home";
let CUR = null; // 当前用户

/* ================= 启动 ================= */
function boot(){
  const theme = Store.getTheme();
  $("app-theme").href = THEME_CSS[theme];
  document.body.className = "theme-" + theme;

  // 若 Supabase 有 token（已云端登录过）→ 恢复云会话并拉取数据
  const cloudTok = window.Supabase ? window.Supabase.getToken() : null;
  if(cloudTok){
    // 无论引导与否，只要有云端会话就进主界面
    Store.cloudPullUser().then(()=>{
      CUR = Store.currentUser();
      if(CUR){ enterApp(); return; }
      afterBoot();
    }).catch(()=>afterBoot());
    return;
  }
  afterBoot();
}
function afterBoot(){
  if(!Store.getOnboarded()){
    location.href = "welcome.html"; return;
  }
  CUR = Store.currentUser();
  if(!CUR){
    Store.setOnboarded();
    location.href = "welcome.html"; return;
  }
  enterApp();
}
function enterApp(){
  // 后台拉云端帖子等（不阻塞）
  if(window.Supabase && Store.getTrust()){ Store.cloudPullAll().then(()=>{ try{route(currentPage);}catch(e){} }); }
  if(CUR.admin){ $("nav-admin").style.display = "flex"; }
  // 非管理员进入：清掉任何残留的管理员切换标记（普通用户绝不该看到该按钮）
  if(!CUR.admin){ try{ localStorage.removeItem('jijie_admin_session'); }catch(e){} }
  updateBackAdminBtn();
  $("tb-user").textContent = (CUR.nick||CUR.username) + (CUR.admin?"": "");
  bindNav();
  buildThemeModal();
  route("home");
}
// 统一更新「回到管理员」按钮显示（switchUser/backToAdmin/enterApp 都调用）
function updateBackAdminBtn(){
  let adm=null; try{ adm=localStorage.getItem('jijie_admin_session'); }catch(e){}
  let saved=null; if(adm){ try{ saved=JSON.parse(adm).username; }catch(e){} }
  const show = adm && saved && saved!==CUR.username;
  try{ $("back-admin-wrap").style.display = show ? "block" : "none"; }catch(e){}
}

/* ================= 导航 ================= */
const Sidebar = {
  toggle(){ $("sidebar").classList.toggle("open"); const open=$("sidebar").classList.contains("open"); $("drawer-mask").classList.toggle("show",open); },
  close(){ $("sidebar").classList.remove("open"); $("drawer-mask").classList.remove("show"); }
};
function bindNav(){
  document.querySelectorAll("#sidebar a[data-page]").forEach(a=>{
    a.onclick = e=>{ e.preventDefault(); route(a.dataset.page); Sidebar.close(); };
  });
}
function route(p){
  if(CUR && !Store.getOnboarded()) return;
  const pages = ["home","board","resources","articles","problems","bounty","search","mail","profile","admin"];
  if(!pages.includes(p)) p="home";
  currentPage = p;
  document.querySelectorAll("#sidebar a[data-page]").forEach(a=>{
    a.classList.toggle("on", a.dataset.page===p);
  });
  const map = {
    home:renderHome, board:renderBoard, resources:renderResources, articles:renderArticles,
    problems:renderProblems, bounty:renderBounty, search:renderSearch, mail:renderMail,
    profile:()=>renderProfile(CUR), admin:renderAdmin
  };
  (map[p]||renderHome)();
  window.scrollTo(0,0);
}

/* ================= 主题切换 ================= */
function buildThemeModal(){
  const wrap = $("theme-options"); wrap.innerHTML="";
  THEMES.forEach(t=>{
    const b=document.createElement("button");
    b.style.cssText = `border:none;border-radius:10px;padding:14px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:700;color:${(t.key==='paper'||t.key==='ink')?'#3a332a':'#fff'};background:${t.bg};text-align:center;${t.key===Store.getTheme()?'outline:3px solid var(--accent)':''}`;
    b.innerHTML = `<div style="font-size:24px">${t.icon}</div><div style="margin-top:4px">${t.name}</div>`;
    b.onclick = ()=>{ Store.setTheme(t.key); $("app-theme").href=THEME_CSS[t.key]; document.body.className="theme-"+t.key; closeModal("theme-modal"); rerender(); };
    wrap.appendChild(b);
  });
}
function openModal(id){ $(id).classList.add("show"); }
function openThemeModal(){ Sidebar.close(); openModal("theme-modal"); }
function closeModal(id){ $(id).classList.remove("show"); }
function rerender(){ route(currentPage); }

/* ================= 通用 ================= */

function fmtDate(s){ return s ? s : "刚刚"; }
function h(text){ return String(text||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function pageShell(title, sub, inner){
  return `<div class="pagehead"><h2>${h(title)}</h2>${sub?`<p>${sub}</p>`:""}</div>${inner}`;
}
function noticesHTML(db){
  if(!db.notices || !db.notices.length) return "";
  return db.notices.slice().reverse().map(n=>`
    <div class="banner">
      <div><b>${h(n.title)}</b><small>${h(n.body)}</small></div>
    </div>`).join("");
}
function userByName(db, users, username){
  return (users.find(u=>u.username===username)) || {username,nick:username,avatar:""};
}

/* ================= 首页 ================= */
function renderHome(){
  const db = Store.getDB();
  const q = window.dailyIndex();
  const luck = Store.getLuck(todayStr());
  const me = Store.currentUser();
  const recent = db.posts.slice().reverse().slice(0,5);

  let boardHtml = recent.length ? recent.map(p=>postItem(p, db)).join("")
    : `<div class="muted">还没有帖子，去<b>讨论板</b>发第一帖吧！</div>`;

  const ptsDisplay = (me && me.admin) ? '∞' : ((me&&me.points!==undefined)? me.points : 20);

  render(pageShell("", "", `
    ${noticesHTML(db)}
    <div class="hero">
      <div class="logo">解集<small>SOLUTION SET SITE</small></div>
      <div class="daily">「${h(q.t)}」<span class="src">—— ${h(q.s)}</span></div>
    </div>

    <div class="hero-actions">
      <button class="bigbtn" onclick="randomProblem()">随机跳题</button>
      <button class="bigbtn" onclick="doCheckin()">每日打卡</button>
    </div>

    <div style="text-align:center;margin:6px auto 4px;font-size:13px;opacity:.7">我的积分：<b style="font-size:16px">${ptsDisplay}</b></div>

    <div class="luckbox ${luck?'':'hidden'}" id="luckbox">
      ${luck?`
        <div class="date">${h(todayStr())} · 今日运势</div>
        <div class="sign">${h(luck.name)} <span style="font-size:14px">(+${luck.points!==undefined?luck.points:0} 积分)</span></div>
        <div class="muted">${h(luck.note)}</div>`:""}
    </div>

    <h3 style="margin:26px 0 12px;font-family:var(--font-serif)">精华推荐</h3>
    ${featuredBlock(db)}

    <h3 style="margin:26px 0 12px;font-family:var(--font-serif)">最新讨论</h3>
    ${boardHtml}
  `));
}
function featuredBlock(db){
  const fp=(db.posts||[]).filter(p=>p.featured && !p.trashed);
  const fpb=(db.problems||[]).filter(p=>p.featured);
  let html='';
  if(fp.length){ html+='<div class="card"><h3 style="font-size:15px">精华贴</h3>'+fp.slice(0,3).map(p=>'<div style="padding:4px 0">⭐ '+h(p.title)+' <span class="muted" style="font-size:12px">'+h(p.author)+'</span></div>').join('')+'</div>'; }
  if(fpb.length){ html+='<div class="card"><h3 style="font-size:15px">精华题</h3>'+fpb.slice(0,3).map(p=>'<div style="padding:4px 0">⭐ '+h(p.title)+'</div>').join('')+'</div>'; }
  return html || '<div class="muted" style="font-size:13px">暂无精华内容，管理员可在管理面板设精华</div>';
}
function signPointsHint(){
  const signs=Store.getDB().signs||[];
  if(!signs.length) return "?";
  const ps=signs.map(s=>s.points).sort((a,b)=>b-a);
  return ps[0]+"~"+ps[ps.length-1];
}

function doCheckin(){
  const today = todayStr();
  const existing = Store.getLuck(today);
  if(existing){ alert("你今天已经打过卡啦，明天再来吧～"); return; }
  const signs = Store.getDB().signs;
  const sign = signs[Math.floor(Math.random()*signs.length)];
  // 确保 sign 带 points（兼容旧数据）
  const pts = (sign.points!==undefined) ? sign.points : 0;
  const luckRecord = { name:sign.name, points:pts, note:sign.note };
  Store.setLuck(today, luckRecord);
  // 加积分（管理员不加）
  const me = Store.currentUser();
  if(me && !me.admin){
    const users=Store.getUsers(); const u=users.find(x=>x.username===me.username);
    if(u && u.points!==undefined){ u.points = (u.points||0) + pts; Store.saveUsers(users); CUR=Store.currentUser(); }
  }
  renderHome();
}

function randomProblem(){
  const db = Store.getDB();
  const approved = db.problems.filter(p=>!p.status || p.status==='approved');
  if(!approved.length){ alert("题库还没有已审核的题目～"); return; }
  const p = approved[Math.floor(Math.random()*approved.length)];
  route("problems");
  setTimeout(()=>{ const el=document.getElementById("prob-"+p.id); if(el) el.scrollIntoView({behavior:"smooth",block:"center"}); },80);
}

/* ================= 讨论板 ================= */
function renderBoard(){
  const db = Store.getDB();
  const users = Store.getUsers();
  const pinned = db.posts.filter(p=>p.pin).reverse();
  const normal = db.posts.filter(p=>!p.pin).reverse();
  const list = [...pinned, ...normal];

  let inner = noticesHTML(db) + `
    <div class="card">
      <h3>发布新帖</h3>
      <div class="field"><input id="np-title" placeholder="标题"></div>
      <div class="field"><textarea id="np-body" placeholder="正文内容…"></textarea></div>
      <button class="pbtn" onclick="newPost()">发布</button>
    </div>
    ${list.length ? list.map(p=>postItem(p, db)).join("") : '<div class="muted">还没有帖子，来发第一帖吧！</div>'}
  `;
  render(pageShell("讨论板","交流想法、请教难题、分享心得", inner));
}
function newPost(){
  if(isMuted(CUR)) return alert("你已被禁言到 "+CUR.muteUntil+"，暂时不能发帖");
  const t = $("np-title").value.trim(), b = $("np-body").value.trim();
  if(!t) return alert("请填写标题");
  const db = Store.getDB();
  db.posts.push({id:Date.now(), title:t, body:b, author:CUR.username, date:todayStr(), pin:false, comments:[]});
  Store.saveDB(db); renderBoard();
}

function postItem(p, db){
  const user = userByName(db, Store.getUsers(), p.author);
  const av = avatarHtml(user);
  return `<div class="card post">
    <div class="av">${av}</div>
    <div class="body">
      <div class="pmeta">${h(user.nick||p.author)} · ${h(p.date)}${p.pin?'<span class="pin">置顶</span>':''}${p.featured?'<span class="tag hot">精华</span>':''}${p.trashed?' <span class="muted">(回收站)</span>':''}</div>
      <div class="ptitle">${h(p.title)}</div>
      <div class="ptext">${h(p.body)}</div>
      <div style="margin-top:8px;display:flex;gap:14px;font-size:12.5px;opacity:.7;flex-wrap:wrap">
        <span>评论 ${p.comments?p.comments.length:0}</span>
        <a href="#" onclick="viewPost(${p.id});return false;">查看/评论</a>
        ${CUR.admin?`
        <a href="#" style="color:#d63a3a" onclick="delPost(${p.id});return false;">删除</a>
        <a href="#" onclick="togglePin(${p.id});return false;">${p.pin?"取消置顶":"置顶"}</a>
        <a href="#" onclick="toggleFeature(${p.id});return false;">${p.featured?"取消精华":"设精华"}</a>
        <a href="#" onclick="editPost(${p.id});return false;">编辑</a>
        <a href="#" onclick="trashPost(${p.id});return false;">${p.trashed?"恢复":"回收站"}</a>`:""}
      </div>
    </div>
  </div>`;
}
function toggleFeature(id){
  const db=Store.getDB(); const p=db.posts.find(x=>x.id===id); if(!p) return; p.featured=!p.featured; Store.saveDB(db); rerender();
}
function editPost(id){
  const db=Store.getDB(); const p=db.posts.find(x=>x.id===id); if(!p) return;
  const t=prompt("标题：", p.title); if(t===null) return;
  const b=prompt("正文：", p.body); if(b===null) return;
  p.title=t; p.body=b; Store.saveDB(db); rerender();
}
function trashPost(id){
  const db=Store.getDB(); const p=db.posts.find(x=>x.id===id); if(!p) return;
  p.trashed=!p.trashed; Store.saveDB(db); rerender();
}

function viewPost(id){
  const db = Store.getDB();
  const p = db.posts.find(x=>x.id===id); if(!p) return;
  render(pageShell("帖子详情","", `
    ${postItem(p, db)}
    <div class="card">
      <h3>评论 (${p.comments.length})</h3>
      ${p.comments.length ? p.comments.map((c,ci)=>`
        <div style="padding:9px 0;border-bottom:1px solid var(--line)">${h(userByName(db,Store.getUsers(),c.author).nick||c.author)}：${h(c.body)} <span class="muted">· ${h(c.date)}</span>${CUR.admin?` <a href="#" style="color:#d63a3a;font-size:12px" onclick="delComment(${p.id},${ci});return false;">删评论</a>`:''}</div>`).join("")
      : '<div class="muted">还没有评论</div>'}
      <div style="margin-top:12px;display:flex;gap:10px">
        <input id="cm-body" placeholder="写下评论…">
        <button class="pbtn" style="flex-shrink:0" onclick="addComment(${id})">评论</button>
      </div>
    </div>
  `));
}
function addComment(id){
  if(isMuted(CUR)) return alert("你已被禁言，暂时不能评论");
  const b = $("cm-body").value.trim(); if(!b) return;
  const db = Store.getDB(); const p = db.posts.find(x=>x.id===id);
  p.comments.push({author:CUR.username, body:b, date:todayStr()});
  Store.saveDB(db); viewPost(id);
}
function delComment(pid, ci){
  if(!CUR.admin) return;
  const db=Store.getDB(); const p=db.posts.find(x=>x.id===pid); if(!p||!p.comments) return;
  p.comments.splice(ci,1); Store.saveDB(db); viewPost(pid);
}
function delPost(id){
  if(!CUR.admin){ return; }
  if(!confirm("确定删除该帖？")) return;
  recordLog(CUR.username, 'delete_post', '删除帖子 #'+id);
  const db=Store.getDB(); db.posts=db.posts.filter(p=>p.id!==id); Store.saveDB(db); rerender();
}
function togglePin(id){
  const db=Store.getDB(); const p=db.posts.find(x=>x.id===id); p.pin=!p.pin; Store.saveDB(db); rerender();
}

/* ================= 资源库 ================= */
function renderResources(){
  const db = Store.getDB();
  let html = `
    <div class="card">
      <h3>上传资源</h3>
      <div class="field"><input id="res-name" placeholder="资源名称"></div>
      <div class="row">
        <div class="field" style="flex:1"><input id="res-type" placeholder="类型（如 PDF / DOCX / 链接）"></div>
        <div class="field" style="flex:1"><input id="res-link" placeholder="链接或文件名"></div>
      </div>
      <div class="field"><input id="res-sub" placeholder="科目/分类（可选）"></div>
      <button class="pbtn" onclick="uploadRes()">上传</button>
      <p class="hint" style="font-size:12px;opacity:.6;margin-top:8px">本地演示：文件需先放入 data/files/ 或用外链。</p>
    </div>
    <table>
      <tr><th>名称</th><th>类型</th><th>分类</th><th>上传者</th><th>日期</th><th></th></tr>
      ${db.resources.length ? db.resources.map(r=>`
        <tr>
          <td>${h(r.name)}</td>
          <td><span class="tag">${h(r.type)}</span></td>
          <td>${h(r.sub||"—")}</td>
          <td>${h(r.author)}</td>
          <td class="muted">${h(r.date)}</td>
          <td><a href="${r.link}" target="_blank" class="pbtn ghost" style="padding:5px 14px;font-size:13px">下载</a></td>
        </tr>`).join("")
      : '<tr><td colspan="6" class="muted">暂无资源</td></tr>'}
    </table>
  `;
  render(pageShell("资源库","PDF / DOCX / 学习资料共享", html));
}
function uploadRes(){
  const name=$("res-name").value.trim(), type=$("res-type").value.trim(), link=$("res-link").value.trim(), sub=$("res-sub").value.trim();
  if(!name||!type||!link) return alert("名称、类型、链接为必填");
  const db=Store.getDB();
  db.resources.push({name,type,link,sub,author:CUR.nick||CUR.username,date:todayStr()});
  Store.saveDB(db); renderResources();
}

/* ================= 文章专栏 ================= */
function renderArticles(){
  const db = Store.getDB();
  let html = `
    <div class="card">
      <h3>写一篇文章</h3>
      <div class="field"><input id="ar-title" placeholder="标题"></div>
      <div class="field"><textarea id="ar-body" placeholder="正文（支持长文）"></textarea></div>
      <div class="field"><input id="ar-tag" placeholder="标签（空格分隔，如：数论 组合）"></div>
      <button class="pbtn" onclick="newArticle()">发布专栏</button>
    </div>
    ${db.articles.length ? db.articles.slice().reverse().map(a=>`
      <div class="card">
        <div class="pmeta">${h(a.author)} · ${h(a.date)} ${a.tags? a.tags.split(" ").filter(Boolean).map(t=>`<span class="tag">${h(t)}</span>`).join(""):""}</div>
        <div class="ptitle" style="font-size:17px">${h(a.title)}</div>
        <div class="ptext">${h(a.body)}</div>
        ${CUR.admin?`<div style="margin-top:6px"><a href="#" style="color:#d63a3a;font-size:13px" onclick="delArticle(${a.id});return false;">删除</a></div>`:""}
      </div>`).join("")
    : '<div class="muted">还没有文章</div>'}
  `;
  render(pageShell("文章专栏","长文教程、学习笔记、心路随笔", html));
}
function newArticle(){
  const t=$("ar-title").value.trim(), b=$("ar-body").value.trim(), tag=$("ar-tag").value.trim();
  if(!t||!b) return alert("标题和正文不能为空");
  const db=Store.getDB();
  db.articles.push({id:Date.now(),title:t,body:b,tags:tag,author:CUR.nick||CUR.username,date:todayStr()});
  Store.saveDB(db); renderArticles();
}
function delArticle(id){ if(!confirm("删除该文章？"))return; const db=Store.getDB(); db.articles=db.articles.filter(a=>a.id!==id); Store.saveDB(db); rerender(); }

/* ================= 题库 ================= */
function renderProblems(){
  const db = Store.getDB();
  const visible = db.problems.filter(p=>!p.status || p.status==='approved');
  const pending = db.problems.filter(p=>p.status==='pending');
  const me = Store.currentUser();
  let html = `
    <div class="card"><h3>题库</h3>
      <p class="muted">共 ${visible.length} 道已审核题目${pending.length?`,另有 ${pending.length} 道待审核`:''}。做对按难度得分（难度 × 5 积分）。</p>
    </div>
    <div class="card">
      <h3>上传题目</h3>
      <div class="field"><input id="up-title" placeholder="题目名称"></div>
      <div class="row">
        <div class="field" style="flex:1"><input id="up-tag" placeholder="分类（数论/组合/几何…）"></div>
        <div class="field" style="flex:1"><select id="up-diff"><option value="1">难度 1</option><option value="2">难度 2</option><option value="3" selected>难度 3</option><option value="4">难度 4</option><option value="5">难度 5</option></select></div>
      </div>
      <div class="field"><textarea id="up-body" placeholder="题目内容/题干…（可写 LaTeX 公式）"></textarea></div>
      <div class="field"><textarea id="up-solution" placeholder="题解（必填，需要题解才能发布。没有题解？请发布到悬赏板）…"></textarea></div>
      <button class="pbtn" onclick="uploadProblem()">提交题目（待审核）</button>
      <p class="hint" style="font-size:12px;opacity:.6;margin-top:8px">题目需带题解并经管理员审核后才会公开。若暂无题解，请到悬赏板求助。</p>
    </div>
    <table>
      <tr><th>题目</th><th>分类</th><th>难度</th><th>分值</th><th>提交者</th><th></th></tr>
      ${visible.length ? visible.map(p=>`
        <tr id="prob-${p.id}">
          <td>${h(p.title)}</td>
          <td><span class="tag">${h(p.tag||"综合")}</span></td>
          <td>${"⭐".repeat(Math.max(1,Math.min(5,+(p.diff||1))))}</td>
          <td><b>${Math.max(1,Math.min(5,+(p.diff||1)))*5}</b></td>
          <td class="muted">${h(p.author)}</td>
          <td><a href="#" class="pbtn ghost" style="padding:4px 12px;font-size:13px" onclick="openProblem(${p.id});return false;">开始</a></td>
        </tr>`).join("")
      : '<tr><td colspan="6" class="muted">题库暂无已审核题目</td></tr>'}
    </table>
    ${pending.length && me && me.admin ? `
      <h3 style="margin:26px 0 10px;font-family:var(--font-serif)">待审核题目（管理员）</h3>
      <table>
        <tr><th>题目</th><th>分类</th><th>难度</th><th>上传者</th><th>操作</th></tr>
        ${pending.map(p=>`<tr>
          <td>${h(p.title)}</td>
          <td>${h(p.tag||"综合")}</td>
          <td>${"⭐".repeat(Math.max(1,Math.min(5,+(p.diff||1))))}</td>
          <td>${h(p.author)}</td>
          <td style="display:flex;gap:6px">
            <button class="pbtn ghost" style="padding:4px 10px;font-size:12px" onclick="approveProblem(${p.id})">通过</button>
            <button class="pbtn ghost" style="padding:4px 10px;font-size:12px;border-color:#d63a3a;color:#d63a3a" onclick="viewPending(${p.id})">查看</button>
          </td>
        </tr>`).join("")}
      </table>`:''}
  `;
  render(pageShell("题库","当前所有题目", html));
}
function uploadProblem(){
  const t=$("up-title").value.trim(), tag=$("up-tag").value.trim(), d=$("up-diff").value, b=$("up-body").value.trim(), sol=$("up-solution").value.trim();
  if(!t||!b) return alert("题目名称和题干必填");
  if(!sol){ alert("题目必须附带题解才能发布。\n\n如果还没有题解，建议发布到悬赏板求助，而不是上传题目。"); return; }
  const db=Store.getDB();
  db.problems.push({id:Date.now(),title:t,tag:tag||"综合",diff:+d,body:b,solution:sol,author:CUR.username,status:'pending',solves:0,solvers:{},solutions:[],requester:CUR.nick||CUR.username});
  Store.saveDB(db); renderProblems(); alert("已提交，等待管理员审核后公开 ✓");
}
function approveProblem(id){
  const db=Store.getDB(); const p=db.problems.find(x=>x.id===id); if(!p) return;
  p.status='approved'; Store.saveDB(db); renderProblems();
}
function viewPending(id){
  const db=Store.getDB(); const p=db.problems.find(x=>x.id===id); if(!p) return;
  const approve=confirm("题目："+p.title+"\n\n分类："+(p.tag||"综合")+"  难度："+p.diff+"\n上传者："+p.author+"\n\n题干："+p.body+"\n\n题解："+p.solution+"\n\n点击确定=通过，取消=保持待审核");
  if(approve) approveProblem(id);
}
function openProblem(id){
  const db=Store.getDB(); const p=db.problems.find(x=>x.id===id); if(!p) return;
  const me = Store.currentUser();
  const solved = (me&&me.solved||[]).includes(id);
  const mySol = (p.solutions||[]).find(s=>s.author===CUR.username);
  const pending = mySol && mySol.pending;
  const peek = (me&&me.peekCount||{});
  const peeked = peek[id] || 0;
  const unlocked = solved || peeked >= 3;
  const pts = Math.max(1,Math.min(5,+(p.diff||1)))*5;
  render(pageShell("题目","", `
    <div class="card">
      <div class="pmeta"><span class="tag ${p.diff>=4?'hot':''}">${"⭐".repeat(Math.max(1,Math.min(5,+(p.diff||1))))}</span> <span class="tag">${h(p.tag||"综合")}</span> <span class="tag">${pts} 分</span> 提交者 ${h(p.author)}</div>
      <h3 style="font-size:19px;margin:6px 0 10px">${h(p.title)}</h3>
      <div style="white-space:pre-wrap;opacity:.9">${h(p.body)}</div>
    </div>
    ${solved?`<div class="banner" style="background:var(--banner-bg,var(--accent))"><span class="b-ico"></span><div>你已正确解答此题（管理员已审核）</div></div>`:''}
    ${pending?`<div class="banner" style="background:#d0a020"><span class="b-ico"></span><div>你的解答待管理员审核，通过后解锁题解并获得 ${pts} 积分</div></div>`:''}
    <div class="card">
      <h3>我的解答</h3>
      ${mySol
        ? `<div style="opacity:.9;white-space:pre-wrap">${h(mySol.body)}</div>${mySol.pending?'<div class="muted" style="font-size:12px;margin-top:6px">状态：待审核</div>':'<div class="muted" style="font-size:12px;margin-top:6px">状态：已通过</div>'}`
        : `<textarea id="ans-body" placeholder="写下你的思路或答案…（支持 LaTeX 公式）"></textarea>
          <div style="margin-top:10px"><button class="pbtn" onclick="submitAnswer(${id})">提交解答（待审核）</button></div>`}
    </div>
    <div class="card">
      <h3>题解${CUR.admin?` <button class="pbtn ghost" style="padding:3px 12px;font-size:12px" onclick="editSolution(${id})">编辑</button>`:''}</h3>
      ${unlocked
        ? `<div style="white-space:pre-wrap;opacity:.95">${p.solution?h(p.solution):'<span class="muted">暂未提供标准题解</span>'}</div>
           ${CUR.admin?pendingSolutionsRow(p):''}
           <h4 style="margin:12px 0 4px;font-size:14px">用户解法</h4>
           ${solutionsList(p)}`
        : `<div class="muted" style="margin-bottom:12px">${peeked>0?`已偷看 ${peeked}/3 次`:'作答通过审核后，或查看题解 3 次后解锁'}</div>
           <button class="pbtn ghost" onclick="peekSolution(${id})">查看题解 (${peeked}/3)</button><span class="muted" style="font-size:12px;margin-left:10px">第 3 次查看可解锁</span>`}
    </div>
  `));
}
function editSolution(id){
  if(!CUR.admin) return;
  const db=Store.getDB(); const p=db.problems.find(x=>x.id===id); if(!p) return;
  const sol=prompt("标准题解：", p.solution||""); if(sol===null) return;
  p.solution=sol; Store.saveDB(db); openProblem(id);
}
function solutionsList(p, isAdmin){
  const sols = (p.solutions||[]).filter(s=>!s.pending);
  if(!sols.length) return '<div class="muted">还没有通过审核的解法，成为第一个吧！</div>';
  return sols.map(s=>`
    <div style="padding:12px 0;border-top:1px solid var(--line,rgba(0,0,0,.08));margin-top:8px">
      <div class="pmeta">${h(s.author)} 的解法 · ${h(s.date)}</div>
      <div style="white-space:pre-wrap;opacity:.9">${h(s.body)}</div>
    </div>`).join('');
}
function approveSolution(pid, username){
  if(!CUR.admin) return;
  const db=Store.getDB(); const p=db.problems.find(x=>x.id===pid); if(!p) return;
  const s=(p.solutions||[]).find(x=>x.author===username); if(!s) return;
  if(!confirm("确定通过 "+username+" 的解答？通过后：\n· 解锁题解\n· 该用户获得 "+(Math.max(1,Math.min(5,+(p.diff||1)))*5)+" 积分")) return;
  s.pending=false;
  const users=Store.getUsers(); const u=users.find(x=>x.username===username);
  if(u && !u.admin){
    if(!u.solved) u.solved=[];
    if(!u.solved.includes(pid)) u.solved.push(pid);
    u.points = (u.points||0) + (Math.max(1,Math.min(5,+(p.diff||1)))*5);
  }
  Store.saveUsers(users); Store.saveDB(db); rerender(); alert("已通过，"+username+" 获得积分 ✓");
}
function pendingSolutionsRow(p){
  const sols=(p.solutions||[]).filter(s=>s.pending);
  if(!sols.length) return '';
  return sols.map(s=>`<div style="padding:8px 0;border-bottom:1px dashed var(--line,rgba(0,0,0,.12))">
    <div class="pmeta">${h(s.author)} 的解答待审 · ${h(s.date)}</div>
    <div style="opacity:.8;font-size:13px">${h(s.body)}</div>
    <button class="pbtn" style="margin-top:6px;font-size:13px" onclick="approveSolution(${p.id},'${s.author}')">通过并给分</button>
  </div>`).join('');
}
function peekSolution(id){
  const users=Store.getUsers(); const me=users.find(u=>u.username===CUR.username); if(!me) return;
  if(!me.peekCount) me.peekCount={};
  const cur = me.peekCount[id] || 0;
  const next = cur + 1;
  me.peekCount[id] = next;
  Store.saveUsers(users); CUR=Store.currentUser();
  if(next >= 3){
    alert('……\n三次都按了，看来是真的没辙了。\n\n那就看吧，题解给你。但别忘了——你已经知道自己偷看过 3 次了，下次遇到它，想躲也躲不掉。\n\n（题解已解锁）');
  } else if(next === 2){
    alert('这是第二下咯。\n\n说实话，连你自己都知道——这不像在解题，像在认输。\n只剩下最后一次机会了。真要继续吗？\n\n（第 2/3 次查看）');
  } else {
    alert('咦？真的要现在看题解吗？\n\n再盯着题目三分钟，说不定灵光一闪呢。这道题……你甘心就这么放弃吗？\n\n（第 1/3 次查看）');
  }
  rerender();
}
function submitAnswer(id){
  const a=$("ans-body").value.trim(); if(!a) return alert("先写点解答吧");
  const db=Store.getDB(); const p=db.problems.find(x=>x.id===id);
  if(!p.solutions) p.solutions=[];
  const existing=p.solutions.find(s=>s.author===CUR.username);
  if(existing){ existing.body=a; existing.date=todayStr(); existing.pending=true; }
  else { p.solutions.push({author:CUR.username,body:a,date:todayStr(),pending:true}); }
  p.solvers=Object.assign({},p.solvers,{[CUR.username]:todayStr()});
  Store.saveDB(db); alert("已提交，等待管理员审核。通过后解锁题解并获得 " + (Math.max(1,Math.min(5,+(p.diff||1)))*5) + " 积分。"); openProblem(id);
}

/* ================= 悬赏板 ================= */
function renderBounty(){
  const db=Store.getDB();
  const me=Store.currentUser();
  const myPts = (me&&!me.admin&&me.points!==undefined)?me.points:(me&&me.admin?'∞':'20');
  let html=`
    <div class="card"><h3>悬赏板</h3>
      <p class="muted">未解决的问题或作业，可发布悬赏让高手相助。悬赏积分从你的账户扣除，解题者答对后获得。我的积分：<b>${myPts}</b></p>
    </div>
    <div class="card">
      <h3>发布悬赏</h3>
      <div class="field"><input id="bt-title" placeholder="问题标题"></div>
      <div class="field"><textarea id="bt-body" placeholder="问题详情…（可写 LaTeX 公式）"></textarea></div>
      <div class="field"><input id="bt-pts" type="number" min="1" placeholder="悬赏积分（从你账户扣除）"></div>
      <button class="pbtn" onclick="newBounty()">发布悬赏</button>
    </div>
    ${db.bounties.length ? db.bounties.slice().reverse().map(b=>`
      <div class="card post">
        <div class="body">
          <div class="pmeta">${h(b.author)} · ${h(b.date)} · <span class="tag hot">悬赏 ${h(b.rewardPts)} 积分</span>${b.solved?'<span class="tag new" style="background:#e3f4ec;color:#1d7a4d">已解决</span>':''}</div>
          <div class="ptitle">${h(b.title)}</div>
          <div class="ptext">${h(b.body)}</div>
          ${!b.solved?`<div style="margin-top:8px"><button class="pbtn ghost" style="padding:6px 14px;font-size:13px" onclick="answerBounty(${b.id})">我来解决</button></div>`
            :`<div class="muted" style="font-size:13px;margin-top:6px">已由 ${h(b.solver)} 解决，获得 ${h(b.rewardPts)} 积分</div>`}
        </div>
      </div>`).join("")
    : '<div class="muted">还没有悬赏，发布第一个吧</div>'} 
  `;
  render(pageShell("悬赏板","未解决问题 / 作业互助", html));
}
function newBounty(){
  const t=$("bt-title").value.trim(), b=$("bt-body").value.trim(), p=$("bt-pts").value.trim();
  if(!t||!b) return alert("标题和详情必填");
  if(!p || +p<=0) return alert("请填写悬赏积分（需大于 0）");
  const pts=Math.floor(+p);
  const me=Store.currentUser();
  const users=Store.getUsers(); const u=users.find(x=>x.username===me.username);
  if(!u.admin && (u.points===undefined || u.points < pts)) return alert("积分不足，发布悬赏需要 "+pts+" 积分（当前 "+(u.points||0)+"）");
  if(!u.admin){ u.points-=pts; }
  Store.saveUsers(users); CUR=Store.currentUser();
  const db=Store.getDB();
  db.bounties.push({id:Date.now(),title:t,body:b,rewardPts:pts,author:me.username,date:todayStr(),solved:false});
  Store.saveDB(db); renderBounty(); alert("悬赏已发布，已扣 "+pts+" 积分 ✓");
}
function answerBounty(id){
  const db=Store.getDB(); const b=db.bounties.find(x=>x.id===id); if(!b||b.solved) return;
  const me=Store.currentUser();
  if(me.admin || me.username===b.author) return alert("管理员或悬赏发布者不能自己解答");
  const msg=prompt("写一下你的解法要点，提交后标记为已解决并领取 "+b.rewardPts+" 积分：");
  if(msg===null) return;
  const users=Store.getUsers(); const solver=users.find(x=>x.username===me.username);
  solver.points=(solver.points||0)+b.rewardPts;
  Store.saveUsers(users); CUR=Store.currentUser();
  b.solved=true; b.solver=me.nick||me.username; b.solution=msg;
  Store.saveDB(db); renderBounty(); alert("已解决 ✓ 你获得 "+b.rewardPts+" 积分");
}

/* ================= 搜索 / 好友 / 邮件 ================= */
function renderSearch(){
  let html=`
    <div class="card">
      <h3>搜索用户 · 添加好友</h3>
      <div class="field"><input id="su" placeholder="输入用户名搜索…"></div>
      <button class="pbtn" onclick="doSearch()">搜索</button>
      <div id="search-res" style="margin-top:14px"></div>
    </div>
    <div class="card">
      <h3>我的好友 (${(CUR.friends||[]).length})</h3>
      <div id="friend-list">
        ${(CUR.friends||[]).length ? CUR.friends.map(f=>`
          <div class="userchip"><span class="av" style="width:34px;height:34px"><span style="display:flex">${avatarHtml(userByName(Store.getDB(),Store.getUsers(),f),34)}</span></span>
          <span style="flex:1">${h(f)}</span></div>`).join("") : '<div class="muted">还没有好友</div>'}
      </div>
    </div>
  `;
  render(pageShell("搜索与好友","添加好友，一起讨论", html));
}
async function doSearch(){
  const q=$("su").value.trim(); const box=$("search-res");
  if(!q){ box.innerHTML=""; return; }
  let hits=[];
  // 云端登录：查所有注册用户
  if(window.Supabase && Store.getTrust()){
    try{
      const rows=await window.Supabase.select('profiles','username,nick,admin,avatar',{});
      if(Array.isArray(rows)){
        hits=rows.filter(u=>u.username && String(u.username).toLowerCase().includes(q.toLowerCase()) && String(u.username)!==String(CUR.username))
                 .map(u=>({username:u.username, nick:u.nick||u.username, admin:!!u.admin, avatar:u.avatar||''}));
      }
    }catch(e){ hits=[]; }
  }
  // 降级：本地用户
  if(!hits.length){
    try{
      hits=Store.getUsers().filter(u=>u.username && String(u.username).toLowerCase().includes(q.toLowerCase()) && String(u.username)!==String(CUR.username));
    }catch(e){}
  }
  if(!hits.length){ box.innerHTML='<div class="muted">没有找到匹配的用户</div>'; return; }
  box.innerHTML = hits.map(u=>{
    const isFriend=(CUR.friends||[]).includes(u.username);
    return `<div class="userchip"><span class="av" style="width:34px;height:34px"><span style="display:flex">${avatarHtml(u,34)}</span></span>
      <span style="flex:1">${h(u.username)} <span class="muted">${h(u.nick||"")}</span></span>
      ${u.admin?'<span class="tag hot">管理员</span>':''}
      <button class="pbtn ghost" style="padding:5px 14px;font-size:13px" onclick="addFriend('${u.username}',this)">${isFriend?"<span style='color:#2d9f5e'>已是好友</span>":"＋加好友"}</button></div>`;
  }).join("");
}
function addFriend(name, btn){
  const users=Store.getUsers(); const me=users.find(u=>u.username===CUR.username);
  if(!me.friends) me.friends=[];
  if(me.friends.includes(name)) return;
  me.friends.push(name); Store.saveUsers(users); CUR=Store.currentUser();
  btn.textContent="已添加"; btn.disabled=true; renderSearch();
}

function renderMail(){
  const db=Store.getDB();
  const mail = db.mail || [];
  const mine = mail.filter(m=>m.from===CUR.username || m.to===CUR.username);
  let html=`
    <div class="card">
      <h3>发送邮件</h3>
      <div class="field"><select id="mail-to">
        <option value="">选择好友…</option>
        ${(CUR.friends||[]).map(f=>`<option value="${f}">${f}</option>`).join("")}
      </select></div>
      <div class="field"><input id="mail-sub" placeholder="主题"></div>
      <div class="field"><textarea id="mail-body" placeholder="内容…"></textarea></div>
      <button class="pbtn" onclick="sendMail()">发送</button>
    </div>
    <h3 style="margin:20px 0 10px;font-family:var(--font-serif)">我的邮件</h3>
    ${mine.length ? mine.slice().reverse().map(m=>`
      <div class="card">
        <div class="pmeta">${m.from===CUR.username?'→ 发送给 '+h(m.to):'← 来自 '+h(m.from)} · ${h(m.date)}</div>
        <div class="ptitle">${h(m.subject)}</div>
        <div class="ptext">${h(m.body)}</div>
      </div>`).join("") : '<div class="muted">还没有邮件</div>'}
  `;
  render(pageShell("邮件","给好友发消息", html));
}
function sendMail(){
  const to=$("mail-to").value, sub=$("mail-sub").value.trim(), b=$("mail-body").value.trim();
  if(!to) return alert("请选择收件人");
  if(!sub||!b) return alert("主题和内容必填");
  const db=Store.getDB(); if(!db.mail) db.mail=[];
  db.mail.push({from:CUR.username,to,subject:sub,body:b,date:todayStr()});
  Store.saveDB(db);
  // 存储到接收者自己的邮箱记录也可通过 DB 公共 mail —— 本地演示用公共池
  alert("已发送 ✔"); renderMail();
}

/* ================= 个人主页 ================= */
function renderProfile(user){
  const u = user || CUR;
  const db = Store.getDB();
  const myPosts = db.posts.filter(p=>p.author===u.username).length;
  const solved = (u.solved||[]).length;
  let html=`
    <div class="card" style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
      ${profileImg(u)}
      <div style="flex:1;min-width:200px">
        <div style="font-size:24px;font-weight:800">${h(u.nick||u.username)} ${u.admin?'<span class="tag hot">管理员</span>':""}</div>
        <div class="muted">@${h(u.username)} · 注册于 ${h(u.registered)||"—"}</div>
        <div style="margin-top:8px">${h(u.intro)||'<span class="muted">这个人很懒，还没写简介。</span>'}</div>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          ${CUR && CUR.username===u.username ? `<button class="pbtn ghost" onclick="editIntro()">编辑简介</button>
          <button class="pbtn ghost" onclick="document.getElementById('avatar-file').click()">${u.avatarImg?'更换头像':'上传头像'}</button>`:""}
        </div>
      </div>
    </div>
    ${CUR && CUR.username===u.username?`<input type="file" id="avatar-file" accept="image/*" style="display:none" onchange="uploadAvatar(this)">`:''}
    <div class="row" style="margin-top:14px">
      <div class="stat"><div class="n">${u.admin?'∞':(u.points!==undefined?u.points:20)}</div><div class="l">积分</div></div>
      <div class="stat"><div class="n">${u.solved?u.solved.length:0}</div><div class="l">已解题目</div></div>
      <div class="stat"><div class="n">${myPosts}</div><div class="l">发布帖子</div></div>
    </div>
    <h3 style="margin:24px 0 10px;font-family:var(--font-serif)">最近做题</h3>
    ${u.solved&&u.solved.length ? u.solved.slice().reverse().map(id=>{
      const p=db.problems.find(x=>x.id===id);
      return p?`<div class="card" style="padding:12px 16px">✅ ${h(p.title)} <span class="muted">· ${"⭐".repeat(+p.diff||1)}</span></div>`:"";
    }).join("") : '<div class="muted">还没有做题记录，去题库逛逛吧</div>'}
  `;
  render(pageShell("个人主页","", html));
}
function editIntro(){
  const users=Store.getUsers(); const me=users.find(x=>x.username===CUR.username);
  const v=prompt("编辑个人简介：", me.intro||"");
  if(v===null) return;
  me.intro=v; Store.saveUsers(users); CUR=Store.currentUser(); renderProfile(CUR);
}
function uploadAvatar(input){
  const file = input.files && input.files[0];
  if(!file) return;
  if(!file.type.startsWith("image/")){ alert("请选择图片文件"); return; }
  if(file.size > 2*1024*1024){ alert("图片不能超过 2MB"); return; }
  const reader = new FileReader();
  reader.onload = function(e){
    const users=Store.getUsers();
    const me=users.find(x=>x.username===CUR.username);
    if(!me) return;
    me.avatarImg = e.target.result; // base64 存 localStorage
    Store.saveUsers(users); CUR=Store.currentUser(); renderProfile(CUR);
    alert("头像已更新 ✔");
  };
  reader.onerror = function(){ alert("读取文件失败"); };
  reader.readAsDataURL(file);
  input.value = "";
}

/* 管理员面板辅助 */
function adminRank(users){
  // 活跃排行：按解题+VIP翻译简化为解题数
  const list=(users||[]).filter(u=>!u.admin).slice().sort((a,b)=>(b.solved||[]).length-(a.solved||[]).length);
  if(!list.length) return '<span class="muted">暂无用户</span>';
  return list.map((u,i)=>{ const nick=(u.nick||u.username||'?'); const n=(u.solved||[]).length; return '<div>'+(i+1)+'. '+esc(nick)+' — '+n+' 题</div>'; }).join('');
}
function adminLogs(db){
  const logs=(db.logs||[]).slice().reverse().slice(0,50);
  if(!logs.length) return '<span class="muted">暂无日志</span>';
  return logs.map(l=>'<div>'+esc(l.date)+' · '+esc(l.user)+' · '+esc(l.action)+' · '+esc(l.detail)+'</div>').join('');
}
function esc(t){ return String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function sendMassMessage(){
  if(!CUR.admin) return;
  const t=document.getElementById('mass-title').value.trim();
  const b=document.getElementById('mass-body').value.trim();
  if(!t||!b) return alert('请填写主题和内容');
  const db=Store.getDB();
  if(!db.broadcasts) db.broadcasts=[];
  db.broadcasts.push({title:t, body:b, from:CUR.username, date:todayStr()});
  // 也写入通知，首页显示
  if(!db.notices) db.notices=[];
  db.notices.push({id:Date.now(), title:t, body:b, tag:'群发', date:todayStr()});
  Store.saveDB(db);
  recordLog(CUR.username,'broadcast', t);
  alert('已群发 ✓');
  renderAdmin();
}
/* ================= 管理员面板 ================= */
function renderAdmin(){
  if(!CUR || !CUR.admin){ render(pageShell("无权限","", '<div class="card">此页面仅管理员可见。</div>')); return; }
  const db=Store.getDB(); const users=Store.getUsers();

  const userRows = users.map(u=>`
    <tr>
      <td><span class="av" style="width:30px;height:30px;display:inline-flex">${avatarHtml(u,30)}</span> ${h(u.nick||u.username)} <span class="muted">@${h(u.username)}</span>${u.banned?' <span class="tag hot">封禁</span>':''}</td>
      <td>${u.admin?'<span class="tag hot">管理员</span>':'<span class="tag">用户</span>'}</td>
      <td class="muted">${h(u.registered||"—")}</td>
      <td>积分 <b>${u.admin?'∞':(u.points!==undefined?u.points:20)}</b></td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="pbtn ghost" style="padding:4px 10px;font-size:12px" onclick="switchUser('${u.username}')">登录此账号</button>
        ${u.username!==CUR.username?`
          ${!u.admin?`<button class="pbtn ghost" style="padding:4px 10px;font-size:12px" onclick="toggleBan('${u.username}')">${u.banned?"解封":"封禁"}</button>`:''}
          ${!u.admin?`<button class="pbtn ghost" style="padding:4px 10px;font-size:12px" onclick="muteUser('${u.username}')">${u.muteUntil&&new Date(u.muteUntil)>new Date()?"取消禁言":"禁言"}</button>`:''}
          ${!u.admin?`<button class="pbtn ghost" style="padding:4px 10px;font-size:12px" onclick="adminAddPoints('${u.username}')">加积分</button>`:''}
          <button class="pbtn ghost" style="padding:4px 10px;font-size:12px" onclick="toggleAdmin('${u.username}')">${u.admin?"取消管理":"设为管理"}</button>
          ${u.admin?`<span class="muted" style="font-size:11px">(protected)</span>`:`<button class="pbtn ghost" style="padding:4px 10px;font-size:12px;border-color:#d63a3a;color:#d63a3a" onclick="delUser('${u.username}')">删除</button>`}
        `:'<span class="muted">(当前)</span>'}
      </td>
    </tr>`).join("");

  const probRows = db.problems.length ? db.problems.map(p=>`
    <tr>
      <td>${h(p.title)}${p.status==='pending'?' <span class="tag hot">待审</span>':''}</td>
      <td><span class="tag">${h(p.tag||"综合")}</span></td>
      <td>${"⭐".repeat(Math.max(1,Math.min(5,+p.diff||1)))}</td>
      <td class="muted">${(p.solves||0)} 解</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        ${p.status==='pending'?`<button class="pbtn" style="padding:4px 10px;font-size:12px" onclick="approveProblem(${p.id})">通过</button>`:''}
        <button class="pbtn ghost" style="padding:4px 10px;font-size:12px" onclick="editProblem(${p.id})">编辑</button>
        <button class="pbtn ghost" style="padding:4px 10px;font-size:12px" onclick="toggleProblemFeature(${p.id})">${p.featured?"取消精华":"设精华"}</button>
        <button class="pbtn ghost" style="padding:4px 10px;font-size:12px;border-color:#d63a3a;color:#d63a3a" onclick="delProblem(${p.id})">删除</button>
      </td>
    </tr>`).join("") : '<tr><td colspan="5" class="muted">暂无题目</td></tr>';
function toggleProblemFeature(id){ const db=Store.getDB(); const p=db.problems.find(x=>x.id===id); if(!p)return; p.featured=!p.featured; Store.saveDB(db); renderAdmin(); }

  const postRows = db.posts.slice().reverse().map((p,idx)=>`
    <tr>
      <td><input type="checkbox" class="post-sel" value="${p.id}" data-idx="${idx}"></td>
      <td>${p.pin?'置顶 ':''}${p.title}${p.featured?' <span class="tag hot">精华</span>':''}</td>
      <td>${h(p.author)}</td>
      <td class="muted">${h(p.date)}</td>
      <td>${p.comments?p.comments.length:0} 评</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="pbtn ghost" style="padding:4px 10px;font-size:12px" onclick="togglePin(${p.id})">${p.pin?"取消置顶":"置顶"}</button>
        <button class="pbtn ghost" style="padding:4px 10px;font-size:12px" onclick="toggleFeature(${p.id})">${p.featured?"取消精华":"设精华"}</button>
        <button class="pbtn ghost" style="padding:4px 10px;font-size:12px" onclick="editPost(${p.id})">编辑</button>
        <button class="pbtn ghost" style="padding:4px 10px;font-size:12px;border-color:#d63a3a;color:#d63a3a" onclick="delPost(${p.id})">删除</button>
      </td>
    </tr>`).join("") || '<tr><td colspan="5" class="muted">暂无帖子</td></tr>';

  const bountyRows = db.bounties.length ? db.bounties.slice().reverse().map(b=>`
    <tr>
      <td>${b.solved?'已解 ':''}${h(b.title)}</td>
      <td>${h(b.author)}</td>
      <td><span class="tag">${h(b.rewardPts)} 分</span></td>
      <td>${b.solved?`<span class="muted">${h(b.solver||"")} 已解决</span>`:'<span class="tag new">进行中</span>'}</td>
      <td><button class="pbtn ghost" style="padding:4px 10px;font-size:12px;border-color:#d63a3a;color:#d63a3a" onclick="delBounty(${b.id})">删除</button></td>
    </tr>`).join("") : '<tr><td colspan="5" class="muted">暂无悬赏</td></tr>';

  const resRows = db.resources.length ? db.resources.map(r=>`
    <tr>
      <td>${h(r.name)}</td>
      <td><span class="tag">${h(r.type)}</span></td>
      <td class="muted">${h(r.author)}</td>
      <td><button class="pbtn ghost" style="padding:4px 10px;font-size:12px;border-color:#d63a3a;color:#d63a3a" onclick="delResource(${r.id})">删除</button></td>
    </tr>`).join("") : '<tr><td colspan="4" class="muted">暂无资源</td></tr>';

  const artRows = db.articles.length ? db.articles.slice().reverse().map(a=>`
    <tr>
      <td>${h(a.title)}</td>
      <td class="muted">${h(a.author)}</td>
      <td><button class="pbtn ghost" style="padding:4px 10px;font-size:12px;border-color:#d63a3a;color:#d63a3a" onclick="delArticle(${a.id})">删除</button></td>
    </tr>`).join("") : '<tr><td colspan="3" class="muted">暂无文章</td></tr>';

  const ntRows = (db.notices||[]).length ? (db.notices||[]).slice().reverse().map(n=>`
    <tr>
      <td>${h(n.title)}</td>
      <td class="muted">${h(n.body)} · ${h(n.date)}</td>
      <td><button class="pbtn ghost" style="padding:4px 10px;font-size:12px;border-color:#d63a3a;color:#d63a3a" onclick="delNotice('${n.id}')">删除</button></td>
    </tr>`).join("") : '<tr><td colspan="3" class="muted">暂无通知</td></tr>';

  const adminHTML=`
    <div class="row">
      <div class="stat"><div class="n">${users.length}</div><div class="l">用户</div></div>
      <div class="stat"><div class="n">${db.posts.length}</div><div class="l">帖子</div></div>
      <div class="stat"><div class="n">${db.problems.length}</div><div class="l">题目</div></div>
      <div class="stat"><div class="n">${db.bounties.length}</div><div class="l">悬赏</div></div>
      <div class="stat"><div class="n">${db.problems.reduce((a,p)=>a+(p.solves||0),0)}</div><div class="l">总解答</div></div>
      <div class="stat"><div class="n">${(db.problems||[]).filter(p=>p.featured).length}</div><div class="l">精华题</div></div>
    </div>
    <h4 style="margin:18px 0 8px">活跃排行（按发帖+解答）</h4>
    <div class="card" style="font-size:13.5px">
      ${adminRank(users)}
    </div>

    <div class="card" style="margin-top:16px">
      <h3>发布通知</h3>
      <div class="field"><input id="nt-title" placeholder="通知标题"></div>
      <div class="field"><textarea id="nt-body" placeholder="通知内容…"></textarea></div>
      <button class="pbtn" onclick="publishNotice()">发布</button>
    </div>

    <div class="card">
      <h3>群发站内消息</h3>
      <div class="field"><input id="mass-title" placeholder="消息主题"></div>
      <div class="field"><textarea id="mass-body" placeholder="消息内容…"></textarea></div>
      <button class="pbtn" onclick="sendMassMessage()">群发</button>
    </div>

    <div class="card">
      <h3>审计日志</h3>
      <div style="max-height:200px;overflow-y:auto;font-size:12.5px;opacity:.8">
        ${adminLogs(db)}
      </div>
    </div>

    <h3 style="margin:26px 0 10px;font-family:var(--font-serif)">用户管理</h3>
    <div class="card" style="overflow-x:auto">
      <table>
        <tr><th>用户</th><th>角色</th><th>注册</th><th>活跃</th><th>操作</th></tr>
        ${userRows}
      </table>
    </div>

    <h3 style="margin:26px 0 10px;font-family:var(--font-serif)">题目管理</h3>
    <div class="card">
      <h3>添加题目</h3>
      <div class="field"><input id="prob-title" placeholder="题目名称"></div>
      <div class="row">
        <div class="field" style="flex:1"><input id="prob-tag" placeholder="分类（数论/组合/几何…）"></div>
        <div class="field" style="flex:1"><select id="prob-diff"><option value="1">⭐1</option><option value="2">⭐2</option><option value="3" selected>⭐3</option><option value="4">⭐4</option><option value="5">⭐5</option></select></div>
      </div>
      <div class="field"><textarea id="prob-body" placeholder="题目内容/题干…（可写 LaTeX 公式）"></textarea></div>
      <div class="field"><textarea id="prob-solution" placeholder="标准题解（可选，做了题才能看）…"></textarea></div>
      <button class="pbtn" onclick="addProblem()">添加题目</button>
    </div>
    <div class="card" style="overflow-x:auto">
      <table>
        <tr><th>题目</th><th>分类</th><th>难度</th><th>解答</th><th>操作</th></tr>
        ${probRows}
      </table>
    </div>

    <h3 style="margin:26px 0 10px;font-family:var(--font-serif)">帖子管理</h3>
    <div class="card">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="sel-all" onchange="toggleSelAll(this)"> 全选</label>
        <button class="pbtn ghost" style="padding:5px 14px;font-size:13px;border-color:#d63a3a;color:#d63a3a" onclick="bulkDelPosts()">批量删除选中</button>
        <span id="bulk-count" class="muted" style="font-size:12px"></span>
      </div>
    </div>
    <div class="card" style="overflow-x:auto">
      <table>
        <tr><th><input type="checkbox" onclick="toggleSelAll(this)"></th><th>标题</th><th>作者</th><th>日期</th><th>评论</th><th>操作</th></tr>
        ${postRows}
      </table>
    </div>

    <h3 style="margin:26px 0 10px;font-family:var(--font-serif)">悬赏管理</h3>
    <div class="card" style="overflow-x:auto">
      <table>
        <tr><th>标题</th><th>发起人</th><th>悬赏</th><th>状态</th><th>操作</th></tr>
        ${bountyRows}
      </table>
    </div>

    <h3 style="margin:26px 0 10px;font-family:var(--font-serif)">资源管理</h3>
    <div class="card" style="overflow-x:auto">
      <table>
        <tr><th>名称</th><th>类型</th><th>上传者</th><th>操作</th></tr>
        ${resRows}
      </table>
    </div>

    <h3 style="margin:26px 0 10px;font-family:var(--font-serif)">文章管理</h3>
    <div class="card" style="overflow-x:auto">
      <table>
        <tr><th>标题</th><th>作者</th><th>操作</th></tr>
        ${artRows}
      </table>
    </div>

    <h3 style="margin:26px 0 10px;font-family:var(--font-serif)">通知管理</h3>
    <div class="card" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <span class="muted" style="font-size:13px">共 ${(db.notices||[]).length} 条通知</span>
      <button class="pbtn ghost" style="padding:5px 14px;font-size:13px;border-color:#d63a3a;color:#d63a3a" onclick="clearAllNotices()">一键清空全部通知</button>
    </div>
    <div class="card" style="overflow-x:auto">
      <table>
        <tr><th>标题</th><th>内容</th><th>操作</th></tr>
        ${ntRows}
      </table>
    </div>

    <h3 style="margin:26px 0 10px;font-family:var(--font-serif)">回收站</h3>
    <div class="card">
      ${adminTrash(db)}
    </div>

    <div class="card" style="border-color:#d63a3a33">
      <h3 style="color:#d63a3a">危险区</h3>
      <p class="muted">重置会清空所有本地数据（帖子/题目/资源等），回到初始状态。不可恢复。</p>
      <button class="pbtn ghost" onclick="resetData()" style="border-color:#d63a3a;color:#d63a3a">重置本地数据</button>
    </div>
  `;
  render(pageShell("管理面板","管理员专属 · 全面管理", adminHTML));
}
function toggleSelAll(cb){
  document.querySelectorAll('.post-sel').forEach(x=>x.checked=cb.checked);
  updateBulkCount();
}
function updateBulkCount(){
  const n=document.querySelectorAll('.post-sel:checked').length;
  const el=document.getElementById('bulk-count'); if(el) el.textContent=n?('已选 '+n+' 帖'):'';
}
function bulkDelPosts(){
  const ids=[...document.querySelectorAll('.post-sel:checked')].map(x=>Number(x.value));
  if(!ids.length) return alert("请先勾选要删除的帖子");
  if(!confirm("确定删除选中的 "+ids.length+" 个帖子？")) return;
  const db=Store.getDB(); db.posts=db.posts.filter(p=>!ids.includes(p.id));
  Store.saveDB(db); recordLog(CUR.username,'bulk_delete', '批量删除 '+ids.length+' 帖');
  renderAdmin();
}
function adminTrash(db){
  const tr=(db.posts||[]).filter(p=>p.trashed);
  if(!tr.length) return '<span class="muted">回收站为空</span>';
  return tr.map(p=>'<div style="padding:6px 0;border-bottom:1px dashed var(--line)">'+h(p.title)+' <span class="muted">('+h(p.author)+')</span> <a href="#" style="color:#2d9f5e" onclick="trashPost('+p.id+');return false;">恢复</a> <a href="#" style="color:#d63a3a" onclick="emptyTrashItem('+p.id+');return false;">彻底删除</a></div>').join('');
}
function emptyTrashItem(id){
  if(!confirm("彻底删除该帖（不可恢复）？")) return;
  const db=Store.getDB(); db.posts=db.posts.filter(p=>p.id!==id); Store.saveDB(db); renderAdmin();
}
function publishNotice(){
  const t=$("nt-title").value.trim(), b=$("nt-body").value.trim(); if(!t) return alert("标题必填");
  const db=Store.getDB(); if(!db.notices) db.notices=[];
  db.notices.push({id:Date.now(),title:t,body:b,tag:"公告",date:todayStr()}); Store.saveDB(db); renderAdmin();
}
function delNotice(id){ if(!confirm("删除该通知？"))return; const db=Store.getDB(); db.notices=db.notices.filter(n=>String(n.id)!==String(id)); Store.saveDB(db); renderAdmin(); }
function clearAllNotices(){
  if(!CUR.admin) return;
  const n=(Store.getDB().notices||[]).length;
  if(!n) return alert("通知已是空的");
  if(!confirm("确定清空全部 "+n+" 条通知？此操作不可恢复。")) return;
  const db=Store.getDB(); db.notices=[]; Store.saveDB(db);
  recordLog(CUR.username,'clear_notices','清空全部 '+n+' 条通知');
  renderAdmin(); alert("已清空全部通知 ✓");
}
function addProblem(){
  const t=$("prob-title").value.trim(), tag=$("prob-tag").value.trim(), d=$("prob-diff").value, b=$("prob-body").value.trim();
  const sol=$("prob-solution")?$("prob-solution").value.trim():"";
  if(!t||!b) return alert("题目和题干必填");
  if(!sol) return alert("题目必须附带题解才能发布（管理员也不例外）。\n\n如果暂无题解，请发布到悬赏板。");
  const db=Store.getDB();
  const isAdmin = CUR && CUR.admin;
  db.problems.push({id:Date.now(),title:t,tag:tag||"综合",diff:+d,body:b,solution:sol,status:isAdmin?'approved':'pending',author:CUR.username,solves:0,solvers:{},solutions:[]});
  Store.saveDB(db); renderAdmin(); alert("题目已"+(isAdmin?"添加并通过审核":"提交待审核"));
}
function editProblem(id){
  const db=Store.getDB(); const p=db.problems.find(x=>x.id===id); if(!p) return;
  const title=prompt("题目名称：", p.title); if(title===null) return;
  const tag=prompt("分类：", p.tag||""); if(tag===null) return;
  const diff=parseInt(prompt("难度(1-5)：", p.diff||"3")||"3",10)||1;
  const body=prompt("题目内容：", p.body); if(body===null) return;
  const sol=prompt("标准题解（可含 LaTeX 公式）：", p.solution||""); if(sol===null) return;
  p.title=title; p.tag=tag||"综合"; p.diff=Math.max(1,Math.min(5,diff)); p.body=body; p.solution=sol;
  Store.saveDB(db); renderAdmin(); alert("已保存 ✔");
}
function delProblem(id){ if(!confirm("删除该题目？"))return; const db=Store.getDB(); db.problems=db.problems.filter(p=>p.id!==id); Store.saveDB(db); renderAdmin(); }
function delBounty(id){ if(!confirm("删除该悬赏？"))return; const db=Store.getDB(); db.bounties=db.bounties.filter(b=>b.id!==id); Store.saveDB(db); renderAdmin(); }
function delResource(id){ if(!confirm("删除该资源？"))return; const db=Store.getDB(); db.resources=db.resources.filter(r=>r.id!==id); Store.saveDB(db); renderAdmin(); }
function adminAddPoints(username){
  if(!CUR.admin) return;
  const val = prompt("给 "+username+" 增加积分（输入正数加，负数扣）：");
  if(val===null || val==="") return;
  const pts = Math.floor(+val);
  if(isNaN(pts)) return alert("请输入数字");
  const users=Store.getUsers(); const u=users.find(x=>x.username===username); if(!u||u.admin) return;
  u.points = (u.points===undefined?20:u.points) + pts;
  if(u.points < 0) u.points = 0;
  Store.saveUsers(users); renderAdmin(); alert("已更新 "+username+" 积分："+u.points+(pts>=0?" (+"+pts+")":" ("+pts+")"));
}
// 管理员：以任意用户身份登录（切换身份）
function switchUser(username){
  if(!CUR || !CUR.admin) return;
  const users=Store.getUsers(); const u=users.find(x=>x.username===username); if(!u) return alert("用户不存在");
  if(u.banned){ return alert("该用户已被封禁，无法以他身份登录"); }
  if(!confirm("以 \""+(u.nick||u.username)+"\" 的身份登录？可在侧边栏切回管理员。")) return;
  // 记住当前管理员（存完整用户对象），便于切回（云端模式下本地可能无管理员缓存）
  try{ localStorage.setItem('jijie_admin_session', JSON.stringify({user: CUR, username: CUR.username})); }catch(e){}
  Store.setAuth({username:u.username});
  CUR=Store.currentUser();
  updateBackAdminBtn();
  rerender();
}
// 管理员：封禁/解封用户（禁止登录）
function toggleBan(username){
  if(!CUR.admin) return;
  const users=Store.getUsers(); const u=users.find(x=>x.username===username); if(!u||u.admin) return alert("不能封禁管理员");
  if(!confirm((u.banned?"解封":"封禁")+" 用户 "+username+"？")) return;
  u.banned=!u.banned;
  Store.saveUsers(users);
  // 云端同步封禁
  if(window.Supabase){ Store.cloudPushUser(); }
  renderAdmin();
}
// 管理员：切回管理员身份
function muteUser(username){
  if(!CUR.admin) return;
  const users=Store.getUsers(); const u=users.find(x=>x.username===username); if(!u||u.admin) return alert("不能禁言管理员");
  if(u.muteUntil && new Date(u.muteUntil) > new Date()){
    delete u.muteUntil; Store.saveUsers(users); renderAdmin(); alert("已取消禁言"); return;
  }
  const days=prompt("禁言天数（如 1=1天, 7=一周, 30=一月）：", "1");
  if(days===null||days==="") return;
  const d=parseInt(days,10);
  if(isNaN(d)||d<=0) return alert("无效天数");
  const until=new Date(); until.setDate(until.getDate()+d);
  u.muteUntil=until.toISOString().slice(0,10);
  Store.saveUsers(users); recordLog(CUR.username,'mute', username+' 禁言'+d+'天');
  renderAdmin(); alert("已禁言 "+d+" 天");
}
function backToAdmin(){
  const saved=localStorage.getItem('jijie_admin_session');
  if(saved){
    try{
      const j=JSON.parse(saved);
      // 还原完整管理员：优先用标记里的 user 对象，其次用 username 从缓存找
      let adminUser = j.user || null;
      if(!adminUser && j.username){
        adminUser = Store.getUsers().find(x=>x.username===j.username) || null;
      }
      if(!adminUser){ return alert("无法还原管理员身份，请重新登录"); }
      // 确保备份用户存在于本地 users
      const users=Store.getUsers();
      if(!users.find(x=>x.username===adminUser.username)){ users.push(adminUser); }
      adminUser.admin = true; // 强制保持管理员权限
      // 替换本地缓存中该用户
      const idx=users.findIndex(x=>x.username===adminUser.username);
      if(idx>=0){ users[idx]=adminUser; } else { users.push(adminUser); }
      Store.saveUsers(users);
      Store.setAuth({username:adminUser.username});
      try{ localStorage.removeItem('jijie_admin_session'); }catch(e){}
      CUR=Store.currentUser();
      updateBackAdminBtn();
      rerender();
    }catch(e){}
  }
  else { alert("你不是通过切换进入的"); }
}
function toggleAdmin(username){
  if(!CUR.admin) return;
  const users=Store.getUsers(); const u=users.find(x=>x.username===username); if(!u) return;
  // 保护：admin 自身账号不可被降级（防失控）
  if(u.admin && u.username==='wangzijun1969@outlook.com') return alert("主管理员账号受保护，不可降级");
  if(!confirm("确定更改该用户的管理员权限？")) return;
  u.admin=!u.admin; Store.saveUsers(users); renderAdmin();
}
function delUser(username){
  if(!CUR.admin) return;
  const users=Store.getUsers(); const u=users.find(x=>x.username===username);
  if(u && (u.admin || username==='wangzijun1969@outlook.com')) return alert("管理员账号受保护，不可删除");
  if(!confirm("确定删除用户 "+username+" ？将同时移除其登录能力。")) return;
  users = users.filter(x=>x.username!==username); Store.saveUsers(users); renderAdmin();
}
// 禁言检查：CUR 被禁言且在有效期内则 true
function isMuted(user){
  if(!user || user.admin) return false;
  if(!user.muteUntil) return false;
  return new Date(user.muteUntil) > new Date();
}
// 审计日志 / 积分流水
function recordLog(user, action, detail){
  try{
    const db=Store.getDB();
    if(!db.logs) db.logs=[];
    db.logs.push({user, action, detail, date:new Date().toLocaleString('zh-CN',{hour12:false})});
    if(db.logs.length>300) db.logs=db.logs.slice(-300);
    Store.saveDB(db);
  }catch(e){}
}
function addPoints(username, delta, reason){
  const users=Store.getUsers(); const u=users.find(x=>x.username===username);
  if(!u||u.admin) return false;
  u.points=(u.points===undefined?20:u.points)+delta;
  if(u.points<0) u.points=0;
  Store.saveUsers(users);
  recordLog('system','points', username+' +'+delta+' ('+reason+')');
  return true;
}
function resetData(){
  if(!confirm("确定清空所有本地数据？此操作不可恢复。")) return;
  Store.resetDB();
  alert("已重置。重新进入将恢复初始状态。");
  location.reload();
}

/* ================= Auth ================= */
const Auth = {
  logout(){ if(!confirm("确定退出登录？"))return; try{ localStorage.removeItem('jijie_admin_session'); }catch(e){} if(window.Supabase){ Store.cloudLogout(); } else { Store.clearAuth(); } location.href="welcome.html"; }
};

/* ================= render helper ================= */
function render(html){ $("page").innerHTML = html; renderMath($("page")); }

/* ================= KaTeX 数学渲染 ================= */
function renderMath(rootEl){
  if(!window.renderMathInElement) return;
  try{
    // KaTeX 需要把行内 $..$ 和块级 $$..$$ 分开处理，避免误判
    // 先渲染块级 $$...$$
    window.renderMathInElement(rootEl, {
      delimiters: [
        {left: "$$", right: "$$", display: true},
        {left: "\\[", right: "\\]", display: true},
        {left: "$", right: "$", display: false},
        {left: "\\(", right: "\\)", display: false}
      ],
      throwOnError: false
    });
  }catch(e){ /* 公式渲染失败不阻塞页面 */ }
}

/* ================= 启动 ================= */
boot();
