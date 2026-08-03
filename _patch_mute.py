# -*- coding: utf-8 -*-
"""补丁：禁言(muteUntil) + 帖子/评论发帖时检查 + 管理面板禁言按钮"""
import io, sys
P='js/app.js'
s=io.open(P,encoding='utf-8').read()
def rep(old,new,must=True):
    global s
    if old in s: s=s.replace(old,new,1); return True
    print('!! 未找到:', old[:60].replace('\n','\\n')); return not must

# 1. 发帖/评论时检查禁言
rep('''function newPost(){
  const t = $("np-title").value.trim(), b = $("np-body").value.trim();
  if(!t) return alert("请填写标题");''',
'''function newPost(){
  if(isMuted(CUR)) return alert("你已被禁言到 "+CUR.muteUntil+"，暂时不能发帖");
  const t = $("np-title").value.trim(), b = $("np-body").value.trim();
  if(!t) return alert("请填写标题");''')

rep('''function addComment(id){
  const b = $("cm-body").value.trim(); if(!b) return;''',
'''function addComment(id){
  if(isMuted(CUR)) return alert("你已被禁言，暂时不能评论");
  const b = $("cm-body").value.trim(); if(!b) return;''')

# 2. isMuted 工具函数（加到 recordLog 前）
rep('''// 审计日志 / 积分流水
function recordLog(''',
'''// 禁言检查：CUR 被禁言且在有效期内则 true
function isMuted(user){
  if(!user || user.admin) return false;
  if(!user.muteUntil) return false;
  return new Date(user.muteUntil) > new Date();
}
// 审计日志 / 积分流水
function recordLog(''')

# 3. 管理面板用户行加「禁言」按钮（插到 toggleBan 前）
rep('''          ${!u.admin?`<button class="pbtn ghost" style="padding:4px 10px;font-size:12px" onclick="toggleBan('${u.username}')">${u.banned?"解封":"封禁"}</button>`:''}''',
'''          ${!u.admin?`<button class="pbtn ghost" style="padding:4px 10px;font-size:12px" onclick="toggleBan('${u.username}')">${u.banned?"解封":"封禁"}</button>`:''}
          ${!u.admin?`<button class="pbtn ghost" style="padding:4px 10px;font-size:12px" onclick="muteUser('${u.username}')">${u.muteUntil&&new Date(u.muteUntil)>new Date()?"取消禁言":"禁言"}</button>`:''}''')

# 4. muteUser 函数
rep('''function backToAdmin(){''',
'''function muteUser(username){
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
function backToAdmin(){''')

io.open(P,'w',encoding='utf-8').write(s)
print('done mute')
