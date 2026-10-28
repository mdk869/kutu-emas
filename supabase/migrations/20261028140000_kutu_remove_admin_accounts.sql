-- Log masuk admin dibatalkan (memerlukan SMTP sendiri). Pautan admin (#a=) kekal cara akses admin,
-- dan rekod "Cabutan saya" disimpan dalam peranti admin.
-- Buang fungsi akaun, kemudian lajur owner_id/archived. Fungsi yang merujuk lajur itu digantikan DAHULU.

drop function if exists public.kutu_owner_view(uuid);
drop function if exists public.kutu_owner_pick(uuid, int);
drop function if exists public.kutu_my_sessions(boolean);
drop function if exists public.kutu_set_archived(uuid, boolean);
drop function if exists public.kutu_claim_session(text);
drop function if exists public.kutu__owned(uuid);

create or replace function public.kutu__admin_payload(s public.kutu_sessions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'session_id',   s.id,
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
               'idx', p.idx, 'name', p.name,
               'card', p.picked_card, 'month', c.month,
               'picked_at', p.picked_at, 'by_admin', p.picked_by_admin)
             order by p.idx)
        from public.kutu_participants p
        left join public.kutu_cards c
          on c.session_id = p.session_id and c.card = p.picked_card   -- hanya kad yang sudah dibuka
       where p.session_id = s.id),
    'results', case when s.status = 'done' then public.kutu__results(s.id) end
  );
$$;

create or replace function public.kutu_create_session(
  p_group text, p_start date, p_names text[], p_luck text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_names text[];
  v_n     int;
  v_group text := public.kutu__norm(p_group);
  v_seed  bytea;
  v_hex   text;
  v_perm  int[];
  v_admin text := public.kutu__token();
  v_sid   uuid;
begin
  select array_agg(public.kutu__norm(x) order by o) into v_names
    from unnest(p_names) with ordinality u(x, o);
  v_n := coalesce(array_length(v_names, 1), 0);

  if v_n < 2 or v_n > 24 then
    raise exception 'Bilangan peserta mesti antara 2 hingga 24.' using errcode = 'KT400';
  end if;
  if exists (select 1 from unnest(v_names) x where x = '' or char_length(x) > 60) then
    raise exception 'Ada nama yang kosong atau melebihi 60 aksara.' using errcode = 'KT400';
  end if;
  if (select count(distinct lower(x)) from unnest(v_names) x) <> v_n then
    raise exception 'Ada nama berulang. Bezakan nama tersebut, contohnya "Ali (Kedai)".' using errcode = 'KT400';
  end if;
  if p_start is null then
    raise exception 'Pilih bulan pertama kutu.' using errcode = 'KT400';
  end if;
  if v_group = '' then v_group := 'Kutu Emas'; end if;
  v_group := left(v_group, 80);

  v_seed := extensions.gen_random_bytes(32);
  if public.kutu__norm(p_luck) <> '' then
    v_seed := sha256(v_seed || convert_to(public.kutu__norm(p_luck), 'UTF8'));
  end if;
  v_hex  := encode(v_seed, 'hex');
  v_perm := public.kutu__perm(v_seed, v_n);

  insert into public.kutu_sessions (admin_token_hash, group_name, start_month, n, seed, commit_hash)
  values (encode(sha256(convert_to(v_admin, 'UTF8')), 'hex'), v_group,
          date_trunc('month', p_start)::date, v_n, v_hex, public.kutu__commit(v_hex, v_names))
  returning id into v_sid;

  insert into public.kutu_cards (session_id, card, month)
  select v_sid, g, v_perm[g] from generate_series(1, v_n) g;

  insert into public.kutu_participants (session_id, idx, name, token)
  select v_sid, o, x, public.kutu__token()
    from unnest(v_names) with ordinality u(x, o);

  return jsonb_build_object('admin_token', v_admin, 'session_id', v_sid);
end;
$$;

drop index if exists public.kutu_sessions_owner_idx;
alter table public.kutu_sessions drop column if exists owner_id, drop column if exists archived;
