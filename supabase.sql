-- FriendCampus backend. Paste this whole file into Supabase > SQL Editor > Run.
create extension if not exists pgcrypto with schema extensions;

-- ---------- tables ----------
create table if not exists profiles(
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  name text not null,
  bio text default '',
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz default now()
);
create table if not exists notices(
  id bigint generated always as identity primary key,
  title text not null, body text not null default '',
  author_id uuid references profiles(id) on delete set null,
  author_name text, created_at timestamptz default now()
);
create table if not exists reminders(
  id bigint generated always as identity primary key,
  title text not null, note text default '',
  remind_at timestamptz not null,
  scope text not null default 'personal' check (scope in ('global','personal')),
  user_id uuid references profiles(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);
create table if not exists requests(
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  name text, username text,
  subject text not null, message text default '',
  status text not null default 'pending' check (status in ('pending','resolved')),
  reply text, created_at timestamptz default now()
);
create table if not exists notifications(
  id bigint generated always as identity primary key,
  kind text not null, title text not null, body text default '',
  user_id uuid references profiles(id) on delete cascade,   -- null = everyone
  actor_id uuid, created_at timestamptz default now()
);
create table if not exists polls(
  id bigint generated always as identity primary key,
  question text not null, options jsonb not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);
create table if not exists votes(
  poll_id bigint references polls(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  option_idx int not null,
  primary key(poll_id,user_id)
);

-- ---------- helpers ----------
create or replace function public.my_role() returns text
language sql security definer stable set search_path=public as
$$ select role from profiles where id=auth.uid() $$;

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path=public as
$$ select coalesce((select role='admin' from profiles where id=auth.uid()),false) $$;

-- profile is created automatically at sign-up (only the username "admin" becomes admin)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
declare u text := split_part(new.email,'@',1);
begin
  insert into profiles(id,username,name,role)
  values(new.id,u,coalesce(nullif(new.raw_user_meta_data->>'name',''),u),
         case when u='admin' then 'admin' else 'user' end);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- notifications fan-out ----------
create or replace function public.t_notice() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into notifications(kind,title,body,actor_id) values('notice','New notice: '||new.title,left(new.body,140),new.author_id); return new; end $$;
create or replace function public.t_reminder() returns trigger language plpgsql security definer set search_path=public as $$
begin if new.scope='global' then insert into notifications(kind,title,body,actor_id) values('reminder','New reminder: '||new.title,coalesce(new.note,''),new.created_by); end if; return new; end $$;
create or replace function public.t_poll() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into notifications(kind,title,body,actor_id) values('poll','New poll: '||new.question,'',new.created_by); return new; end $$;
create or replace function public.t_request() returns trigger language plpgsql security definer set search_path=public as $$
begin if (new.reply is distinct from old.reply) or (new.status is distinct from old.status) then
  insert into notifications(kind,title,body,user_id,actor_id) values('request','Your request "'||new.subject||'" was '||new.status,coalesce(new.reply,''),new.user_id,auth.uid()); end if; return new; end $$;

drop trigger if exists tr_notice on notices;   create trigger tr_notice after insert on notices for each row execute function public.t_notice();
drop trigger if exists tr_reminder on reminders; create trigger tr_reminder after insert on reminders for each row execute function public.t_reminder();
drop trigger if exists tr_poll on polls;       create trigger tr_poll after insert on polls for each row execute function public.t_poll();
drop trigger if exists tr_request on requests; create trigger tr_request after update on requests for each row execute function public.t_request();

-- ---------- row level security ----------
alter table profiles enable row level security;
alter table notices enable row level security;
alter table reminders enable row level security;
alter table requests enable row level security;
alter table notifications enable row level security;
alter table polls enable row level security;
alter table votes enable row level security;

drop policy if exists p_sel on profiles; create policy p_sel on profiles for select to authenticated using (true);
drop policy if exists p_upd on profiles; create policy p_upd on profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid() and role=public.my_role());

drop policy if exists n_sel on notices; create policy n_sel on notices for select to authenticated using (true);
drop policy if exists n_ins on notices; create policy n_ins on notices for insert to authenticated with check (public.is_admin());
drop policy if exists n_upd on notices; create policy n_upd on notices for update to authenticated using (public.is_admin());
drop policy if exists n_del on notices; create policy n_del on notices for delete to authenticated using (public.is_admin());

drop policy if exists r_sel on reminders; create policy r_sel on reminders for select to authenticated using (scope='global' or user_id=auth.uid());
drop policy if exists r_ins on reminders; create policy r_ins on reminders for insert to authenticated with check (
  (scope='global' and public.is_admin()) or (scope='personal' and user_id=auth.uid()));
drop policy if exists r_del on reminders; create policy r_del on reminders for delete to authenticated using (public.is_admin() or (scope='personal' and user_id=auth.uid()));

drop policy if exists q_sel on requests; create policy q_sel on requests for select to authenticated using (user_id=auth.uid() or public.is_admin());
drop policy if exists q_ins on requests; create policy q_ins on requests for insert to authenticated with check (user_id=auth.uid());
drop policy if exists q_upd on requests; create policy q_upd on requests for update to authenticated using (public.is_admin());

drop policy if exists f_sel on notifications; create policy f_sel on notifications for select to authenticated using (user_id is null or user_id=auth.uid());

drop policy if exists o_sel on polls; create policy o_sel on polls for select to authenticated using (true);
drop policy if exists o_ins on polls; create policy o_ins on polls for insert to authenticated with check (public.is_admin());
drop policy if exists o_del on polls; create policy o_del on polls for delete to authenticated using (public.is_admin());

drop policy if exists v_sel on votes; create policy v_sel on votes for select to authenticated using (true);
drop policy if exists v_ins on votes; create policy v_ins on votes for insert to authenticated with check (user_id=auth.uid());

-- ---------- live updates ----------
do $$ begin
  begin alter publication supabase_realtime add table notices; exception when others then null; end;
  begin alter publication supabase_realtime add table reminders; exception when others then null; end;
  begin alter publication supabase_realtime add table requests; exception when others then null; end;
  begin alter publication supabase_realtime add table notifications; exception when others then null; end;
  begin alter publication supabase_realtime add table polls; exception when others then null; end;
  begin alter publication supabase_realtime add table votes; exception when others then null; end;
  begin alter publication supabase_realtime add table profiles; exception when others then null; end;
end $$;

-- ---------- admin account: username Admin / password nathaadmin ----------
-- (log in with "Admin"; the app turns it into admin@friendcampus.app)
do $$
declare uid uuid := gen_random_uuid();
begin
  if not exists (select 1 from auth.users where email='admin@friendcampus.app') then
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
      confirmation_token,email_change,email_change_token_new,recovery_token)
    values('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated','admin@friendcampus.app',
      extensions.crypt('nathaadmin',extensions.gen_salt('bf')),now(),
      '{"provider":"email","providers":["email"]}','{"name":"Admin"}',now(),now(),'','','','');
    insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
    values(gen_random_uuid(),uid,uid::text,
      jsonb_build_object('sub',uid::text,'email','admin@friendcampus.app','email_verified',true),'email',now(),now(),now());
  end if;
end $$;
