-- ============================================================
-- 解集 · Solution Set Site — Supabase 建表脚本
-- 在 Supabase 后台 → SQL Editor → New query → 粘贴本脚本 → Run
-- 说明：auth.users 由 Supabase Auth 自动管理（邮箱注册）。
--       下面这些表是论坛的业务表，与 auth.users 关联。
-- ============================================================

-- 1) 用户资料表（与 auth 关联，存积分、昵称、头像、简介、做题记录等）
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  nick text,
  pass_mirror text,            -- 仅用于本演示阶段展示/审计，后续应移除（安全）
  admin boolean default false,
  avatar text default '',
  intro text default '',
  points int default 20,
  solved jsonb default '[]',        -- 已解题 id 数组
  peek_count jsonb default '{}',    -- 每道题偷看次数 {problemId: n}
  lucks jsonb default '{}',         -- 每日运势 {date: {name,points,note}}
  friends jsonb default '[]',       -- 好友 username 数组
  registered timestamptz default now()
);

-- 2) 帖子
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  author text not null,             -- username
  date date default current_date,
  pinned boolean default false,
  comments jsonb default '[]'       -- [{author,body,date}]
);

-- 3) 资源库
create table if not exists public.resources (
  id bigint generated always as identity primary key,
  name text not null,
  type text not null,
  link text not null,
  sub text default '',
  author text not null,
  date date default current_date
);

-- 4) 文章专栏
create table if not exists public.articles (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  tags text default '',
  author text not null,
  date date default current_date
);

-- 5) 题库
create table if not exists public.problems (
  id bigint generated always as identity primary key,
  title text not null,
  tag text default '综合',
  diff int default 3,
  body text not null,
  solution text default '',        -- 标准题解
  status text default 'pending',   -- pending | approved
  author text not null,
  solves int default 0,
  solvers jsonb default '{}',
  solutions jsonb default '[]'     -- [{author,body,date,pending}]
);

-- 6) 悬赏板
create table if not exists public.bounties (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  reward_pts int default 0,
  author text not null,
  date date default current_date,
  solved boolean default false,
  solver text default '',
  solution text default ''
);

-- 7) 通知
create table if not exists public.notices (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  tag text default '公告',
  date date default current_date
);

-- 8) 站内信（洛谷式）── 2026-08-04 新增
-- 收件箱 = to=我 且 del_by_to=false；发件箱 = from=我 且 del_by_from=false
-- 删除只影响看的那一方（收件人删 del_by_to=true，发件人删 del_by_from=true），不真正删行
create table if not exists public.mails (
  id bigint generated always as identity primary key,
  "from" text not null,
  "to" text not null,
  subject text not null default '',
  body text not null default '',
  date date default current_date,
  read boolean default false,
  del_by_from boolean default false,
  del_by_to boolean default false
);

-- ============================================================
-- 行级安全（RLS）：论坛业务数据允许所有登录用户读写。
-- 生产环境应根据 admin 角色收紧写权限，这里先放开便于开发。
-- ============================================================
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.resources enable row level security;
alter table public.articles enable row level security;
alter table public.problems enable row level security;
alter table public.bounties enable row level security;
alter table public.notices enable row level security;
alter table public.mails enable row level security;

-- 允许登录用户读写 forum 业务表
create policy "all users read/write profiles" on public.profiles for all using (true) with check (true);
create policy "all users read/write posts" on public.posts for all using (true) with check (true);
create policy "all users read/write resources" on public.resources for all using (true) with check (true);
create policy "all users read/write articles" on public.articles for all using (true) with check (true);
create policy "all users read/write problems" on public.problems for all using (true) with check (true);
create policy "all users read/write bounties" on public.bounties for all using (true) with check (true);
create policy "all users read/write notices" on public.notices for all using (true) with check (true);
create policy "all users read/write mails" on public.mails for all using (true) with check (true);

-- 触发器：注册时自动创建 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, nick, points)
  values (new.id, new.email, split_part(new.email,'@',1), 20);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 种子管理员账号（可改邮箱/密码后执行一次）
-- 先在 Auth > Users 手动建 admin 账号；或在下方用函数创建：
-- 提示：密码由 Supabase admin API 设置，这里不放明文。
