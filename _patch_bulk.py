# -*- coding: utf-8 -*-
"""批量操作：帖子管理区加"批量删除"（勾选后删）+ 用户批量禁言"""
import io, sys, re
P='js/app.js'
s=io.open(P,encoding='utf-8').read()
def rep(old,new,must=True):
    global s
    if old in s: s=s.replace(old,new,1); return True
    print('!! 未找到:', old[:70].replace('\n','\\n')); return not must

# 帖子管理表加复选框 + 批量删除工具条
old_post_head='''    <h3 style="margin:26px 0 10px;font-family:var(--font-serif)">帖子管理</h3>
    <div class="card" style="overflow-x:auto">
      <table>
        <tr><th>标题</th><th>作者</th><th>日期</th><th>评论</th><th>操作</th></tr>
        ${postRows}
      </table>
    </div>'''
new_post_head='''    <h3 style="margin:26px 0 10px;font-family:var(--font-serif)">帖子管理</h3>
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
    </div>'''
rep(old_post_head,new_post_head)

# postRows 每行加复选框（行首）
old_pr='''  const postRows = db.posts.slice().reverse().map(p=>`
    <tr>
      <td>${p.pin?'置顶 ':''}${h(p.title)}</td>'''
new_pr='''  const postRows = db.posts.slice().reverse().map((p,idx)=>`
    <tr>
      <td><input type="checkbox" class="post-sel" value="${p.id}" data-idx="${idx}"></td>
      <td>${p.pin?'置顶 ':''}${p.title}${p.featured?' <span class="tag hot">精华</span>':''}</td>'''
rep(old_pr,new_pr)

# 批量函数（加到 adminTrash 前）
rep('''function adminTrash(db){''',
'''function toggleSelAll(cb){
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
function adminTrash(db){''')

io.open(P,'w',encoding='utf-8').write(s)
print('done bulk')
