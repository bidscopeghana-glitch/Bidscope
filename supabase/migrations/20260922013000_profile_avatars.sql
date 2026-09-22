alter table public.profiles
  add column if not exists avatar_url text;

update public.profiles as profile
set avatar_url = coalesce(
  nullif(auth_user.raw_user_meta_data ->> 'avatar_url', ''),
  nullif(auth_user.raw_user_meta_data ->> 'picture', '')
)
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.avatar_url is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', '')
    )
  )
  on conflict (id) do update
  set email = excluded.email,
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  return new;
end;
$$;
