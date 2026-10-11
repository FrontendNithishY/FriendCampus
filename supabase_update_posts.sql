-- FriendCampus update: everyone can post notices (with photo), likes, comments, pinned notices.
-- Run ONCE in Supabase > SQL Editor.

alter table notices add column if not exists image_url text;
alter table notices add column if not exists pinned boolean not null default false;
alter table notices add column if not exists author_role text not null default 'user';

-- author info is filled by the server so it cannot be faked; only admins can pin
create or replace function public.t_notice_before() returns trigger
language plpgsql security definer set search_path=public as $$
declare p record;
begin
  select name,role into p from profiles where id=auth.uid();
  new.author_id := auth.uid();
  new.author_name := coalesce(p.name,new.author_name,'Friend');
  new.author_role := coalesce(p.role,'user');
  if coalesce(p.role,'user')<>'admin' then new.pinned:=false; end if;
  return new;
end $$;
drop trigger if exists tr_notice_before on notices;
create trigger tr_notice_before before insert on notices for each row execute function public.t_notice_before();

-- any signed-in user can post; author or admin can delete; admin can pin/edit
drop policy if exists n_ins on notices;
create policy n_ins on notices for insert to authenticated with check (auth.uid() is not null);
drop policy if exists n_del on notices;
create policy n_del on notices for delete to authenticated using (author_id=auth.uid() or public.is_admin());

-- likes
create table if not exists notice_likes(
  notice_id bigint references notices(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key(notice_id,user_id)
);
alter table notice_likes enable row level security;
drop policy if exists l_sel on notice_likes; create policy l_sel on notice_likes for select to authenticated using (true);
drop policy if exists l_ins on notice_likes; create policy l_ins on notice_likes for insert to authenticated with check (user_id=auth.uid());
drop policy if exists l_del on notice_likes; create policy l_del on notice_likes for delete to authenticated using (user_id=auth.uid());

-- comments
create table if not exists notice_comments(
  id bigint generated always as identity primary key,
  notice_id bigint not null references notices(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  author_name text, body text not null,
  created_at timestamptz default now()
);
alter table notice_comments enable row level security;
drop policy if exists c_sel on notice_comments; create policy c_sel on notice_comments for select to authenticated using (true);
drop policy if exists c_ins on notice_comments; create policy c_ins on notice_comments for insert to authenticated with check (user_id=auth.uid());
drop policy if exists c_del on notice_comments; create policy c_del on notice_comments for delete to authenticated using (user_id=auth.uid() or public.is_admin());

create or replace function public.t_comment() returns trigger
language plpgsql security definer set search_path=public as $$
declare a uuid; t text; nm text;
begin
  select name into nm from profiles where id=new.user_id;
  new.author_name := coalesce(nm,new.author_name,'Friend');
  return new;
end $$;
drop trigger if exists tr_comment_before on notice_comments;
create trigger tr_comment_before before insert on notice_comments for each row execute function public.t_comment();

create or replace function public.t_comment_notify() returns trigger
language plpgsql security definer set search_path=public as $$
declare a uuid; t text;
begin
  select author_id,title into a,t from notices where id=new.notice_id;
  if a is not null and a<>new.user_id then
    insert into notifications(kind,title,body,user_id,actor_id)
    values('comment',new.author_name||' commented on "'||left(t,40)||'"',left(new.body,120),a,new.user_id);
  end if;
  return new;
end $$;
drop trigger if exists tr_comment_after on notice_comments;
create trigger tr_comment_after after insert on notice_comments for each row execute function public.t_comment_notify();

-- live updates
do $$ begin
  begin alter publication supabase_realtime add table notice_likes; exception when others then null; end;
  begin alter publication supabase_realtime add table notice_comments; exception when others then null; end;
end $$;

-- photo storage (public bucket; each user uploads only into their own folder)
insert into storage.buckets(id,name,public) values('notice-images','notice-images',true) on conflict (id) do nothing;
drop policy if exists "ni_read" on storage.objects;
create policy "ni_read" on storage.objects for select using (bucket_id='notice-images');
drop policy if exists "ni_up" on storage.objects;
create policy "ni_up" on storage.objects for insert to authenticated
  with check (bucket_id='notice-images' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "ni_del" on storage.objects;
create policy "ni_del" on storage.objects for delete to authenticated
  using (bucket_id='notice-images' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
