-- Cabutan melalui SATU pautan group (#k=<public_id>), tanpa PM.
-- Semua peserta buka pautan yang sama, pilih nama sendiri, kemudian pilih kad.
-- Setiap kad yang dibuka dipaparkan kepada semua serta-merta (papan langsung).
-- Isi kad yang BELUM dibuka kekal tersembunyi daripada semua, termasuk admin.

drop function if exists public.kutu_results_view(text);

create or replace function public.kutu_group_view(p_public_id text)
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
    raise exception 'Pautan cabutan tidak sah. Minta pautan baru daripada admin.' using errcode = 'KT404';
  end if;
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
    'people', (
      select jsonb_agg(jsonb_build_object(
               'idx', p.idx, 'name', p.name, 'card', p.picked_card, 'month', c.month,
               'picked_at', p.picked_at, 'by_admin', p.picked_by_admin)
             order by p.idx)
        from public.kutu_participants p
        left join public.kutu_cards c
          on c.session_id = p.session_id and c.card = p.picked_card   -- hanya kad yang sudah dibuka
       where p.session_id = s.id),
    'results', case when s.status = 'done' then public.kutu__results(s.id) end
  );
end;
$$;

create or replace function public.kutu_group_pick(p_public_id text, p_idx int, p_card int)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s  public.kutu_sessions;
  me public.kutu_participants;
begin
  -- Kunci sesi supaya cabutan diproses satu demi satu.
  select * into s from public.kutu_sessions where public_id = coalesce(p_public_id, '') for update;
  if not found then
    raise exception 'Pautan cabutan tidak sah.' using errcode = 'KT404';
  end if;
  select * into me from public.kutu_participants where session_id = s.id and idx = p_idx;
  if not found then
    raise exception 'Nama tidak dijumpai.' using errcode = 'KT404';
  end if;
  if me.picked_card is not null then
    raise exception '% sudah mencabut kad.', me.name using errcode = 'KT409';
  end if;
  if p_card is null or p_card < 1 or p_card > s.n then
    raise exception 'Kad tidak sah.' using errcode = 'KT400';
  end if;
  if exists (select 1 from public.kutu_participants
              where session_id = s.id and picked_card = p_card) then
    raise exception 'Kad ini baru sahaja diambil peserta lain. Sila pilih kad lain.' using errcode = 'KT409';
  end if;

  update public.kutu_participants
     set picked_card = p_card, picked_at = now()
   where id = me.id;

  perform public.kutu__maybe_finish(s.id);
  return public.kutu_group_view(p_public_id);
end;
$$;

revoke execute on function public.kutu_group_view(text), public.kutu_group_pick(text, int, int)
  from public, anon, authenticated;
grant execute on function public.kutu_group_view(text), public.kutu_group_pick(text, int, int)
  to anon, authenticated;
