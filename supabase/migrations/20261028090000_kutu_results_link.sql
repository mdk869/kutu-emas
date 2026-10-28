-- Pautan keputusan awam (#k=<public_id>) untuk dikongsi dalam group WhatsApp.
-- Sebelum selesai: hanya kemajuan (berapa sudah cabut). Selepas selesai: keputusan penuh + data semakan.

alter table public.kutu_sessions add column public_id text;
update public.kutu_sessions set public_id = public.kutu__token() where public_id is null;
alter table public.kutu_sessions
  alter column public_id set not null,
  alter column public_id set default public.kutu__token();
create unique index kutu_sessions_public_id_uniq on public.kutu_sessions (public_id);

create or replace function public.kutu_results_view(p_public_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.kutu_sessions;
begin
  select * into s from public.kutu_sessions where public_id = coalesce(p_public_id, '');
  if not found then
    raise exception 'Pautan keputusan tidak sah.' using errcode = 'KT404';
  end if;
  return jsonb_build_object(
    'group_name',  s.group_name,
    'start_month', s.start_month,
    'n',           s.n,
    'status',      s.status,
    'commit_hash', s.commit_hash,
    'created_at',  s.created_at,
    'completed_at', s.completed_at,
    'picked',      (select count(*) from public.kutu_participants p
                     where p.session_id = s.id and p.picked_card is not null),
    'seed',        case when s.status = 'done' then s.seed end,
    'names',       case when s.status = 'done' then
                     (select jsonb_agg(p.name order by p.idx) from public.kutu_participants p
                       where p.session_id = s.id) end,
    'results',     case when s.status = 'done' then public.kutu__results(s.id) end
  );
end;
$$;

-- Tambah public_id dan masa dikunci pada paparan admin & peserta.
create or replace function public.kutu_admin_view(p_admin_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.kutu_sessions := public.kutu__session_by_admin(p_admin_token);
begin
  return jsonb_build_object(
    'public_id',    s.public_id,
    'group_name',   s.group_name,
    'start_month',  s.start_month,
    'n',            s.n,
    'status',       s.status,
    'commit_hash',  s.commit_hash,
    'created_at',   s.created_at,
    'completed_at', s.completed_at,
    'seed',         case when s.status = 'done' then s.seed end,
    'names',        case when s.status = 'done' then
                      (select jsonb_agg(p.name order by p.idx) from public.kutu_participants p
                        where p.session_id = s.id) end,
    'participants', (
      select jsonb_agg(jsonb_build_object(
               'idx', p.idx, 'name', p.name, 'token', p.token,
               'card', p.picked_card, 'month', c.month,
               'picked_at', p.picked_at, 'by_admin', p.picked_by_admin)
             order by p.idx)
        from public.kutu_participants p
        left join public.kutu_cards c
          on c.session_id = p.session_id and c.card = p.picked_card   -- hanya kad yang sudah dicabut
       where p.session_id = s.id),
    'results', case when s.status = 'done' then public.kutu__results(s.id) end
  );
end;
$$;

create or replace function public.kutu_participant_view(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me public.kutu_participants;
  s  public.kutu_sessions;
  my_month int;
begin
  select * into me from public.kutu_participants where token = coalesce(p_token, '');
  if not found then
    raise exception 'Pautan peserta tidak sah. Minta pautan baru daripada admin.' using errcode = 'KT404';
  end if;
  select * into s from public.kutu_sessions where id = me.session_id;
  if me.picked_card is not null then
    select month into my_month from public.kutu_cards
     where session_id = s.id and card = me.picked_card;
  end if;

  return jsonb_build_object(
    'public_id',   s.public_id,
    'group_name',  s.group_name,
    'start_month', s.start_month,
    'n',           s.n,
    'status',      s.status,
    'commit_hash', s.commit_hash,
    'created_at',  s.created_at,
    'seed',        case when s.status = 'done' then s.seed end,
    'me', jsonb_build_object('name', me.name, 'card', me.picked_card, 'month', my_month,
                             'by_admin', me.picked_by_admin, 'picked_at', me.picked_at),
    'taken', (select coalesce(jsonb_agg(p.picked_card order by p.picked_card), '[]'::jsonb)
                from public.kutu_participants p
               where p.session_id = s.id and p.picked_card is not null),
    'people', (select jsonb_agg(jsonb_build_object('name', p.name, 'picked', p.picked_card is not null)
                      order by p.idx)
                 from public.kutu_participants p where p.session_id = s.id),
    'names', case when s.status = 'done' then
               (select jsonb_agg(p.name order by p.idx) from public.kutu_participants p
                 where p.session_id = s.id) end,
    'results', case when s.status = 'done' then public.kutu__results(s.id) end
  );
end;
$$;

revoke execute on function public.kutu_results_view(text) from public, anon, authenticated;
grant execute on function public.kutu_results_view(text) to anon, authenticated;
