-- FriendCampus update: real email + verification code sign-up.
-- Run this ONCE in Supabase > SQL Editor (after supabase.sql).

-- private place for emails (RLS on, no policies => nobody can read it directly)
create table if not exists private_emails(
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  email text not null
);
alter table private_emails enable row level security;

-- backfill existing users (including the admin account)
insert into private_emails(id,username,email)
select p.id,p.username,u.email from profiles p join auth.users u on u.id=p.id
on conflict (id) do nothing;

-- new-user trigger: username comes from sign-up form; ONLY admin@friendcampus.app can be admin
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
declare u text := lower(coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email,'@',1)));
begin
  insert into profiles(id,username,name,role)
  values(new.id,u,coalesce(nullif(new.raw_user_meta_data->>'name',''),u),
         case when new.email='admin@friendcampus.app' then 'admin' else 'user' end);
  insert into private_emails(id,username,email) values(new.id,u,new.email);
  return new;
end $$;

-- lookups used by the login / sign-up screens
create or replace function public.email_for_username(u text) returns text
language sql security definer stable set search_path=public as
$$ select email from private_emails where username=lower(u) $$;

create or replace function public.username_taken(u text) returns boolean
language sql security definer stable set search_path=public as
$$ select exists(select 1 from private_emails where username=lower(u)) or lower(u) in ('admin','administrator') $$;

grant execute on function public.email_for_username(text) to anon, authenticated;
grant execute on function public.username_taken(text) to anon, authenticated;
