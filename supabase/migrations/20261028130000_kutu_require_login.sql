-- Wajib log masuk untuk mencipta cabutan. Peserta tidak terjejas.
-- Jalankan SERENTAK dengan deploy frontend yang mempunyai log masuk admin.

-- Hanya peranan authenticated boleh memanggil; semakan auth.uid() sebagai lapisan kedua.
revoke execute on function public.kutu_create_session(text, date, text[], text) from public, anon;
grant execute on function public.kutu_create_session(text, date, text[], text) to authenticated;

create or replace function public.kutu_create_session_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is null then
    raise exception 'Sila log masuk sebagai admin untuk mencipta cabutan.' using errcode = 'KT401';
  end if;
  return new;
end;
$$;
create trigger kutu_sessions_require_owner
  before insert on public.kutu_sessions
  for each row execute function public.kutu_create_session_guard();
