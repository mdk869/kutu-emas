-- Edit & padam kutu (admin, melalui pautan admin).
-- Peraturan keadilan:
--   * Nama group: boleh diubah bila-bila masa (tidak menjejaskan keputusan).
--   * Nama ahli / bulan mula: hanya SEBELUM ada ahli yang cabut. Jika nama ahli berubah, kad
--     disusun semula dengan benih baru dan Kod Kunci baru dijana. Link group kekal sama.
--   * Padam terus: hanya SEBELUM ada ahli yang cabut.
-- relocked_at merekod bila senarai dikemas kini, supaya ahli nampak notis dan masa kunci baru.
-- kutu_group_pick kini menyemak Kod Kunci semasa, supaya ahli yang sedang memilih ketika admin
-- mengubah senarai tidak tercabut atas nama orang lain.

alter table public.kutu_sessions add column relocked_at timestamptz;

-- ---------------------------------------------------------------- Dalaman

create or replace function public.kutu__clean_names(p_names text[])
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text[];
  n int;
begin
  select array_agg(public.kutu__norm(x) order by o) into v
    from unnest(p_names) with ordinality u(x, o);
  n := coalesce(array_length(v, 1), 0);
  if n < 2 or n > 24 then
    raise exception 'Bilangan ahli mesti antara 2 hingga 24.' using errcode = 'KT400';
  end if;
  if exists (select 1 from unnest(v) x where x = '' or char_length(x) > 60) then
    raise exception 'Ada nama yang kosong atau terlalu panjang.' using errcode = 'KT400';
  end if;
  if (select count(distinct lower(x)) from unnest(v) x) <> n then
    raise exception 'Ada nama yang sama. Tambah sesuatu untuk bezakan, contohnya "Ali (Kedai)".' using errcode = 'KT400';
  end if;
  return v;
end;
$$;

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
    'relocked_at',  s.relocked_at,
    'completed_at', s.completed_at,
    'seed',         case when s.status = 'done' then s.seed end,
    'names',        (select jsonb_agg(p.name order by p.idx) from public.kutu_participants p
                      where p.session_id = s.id),
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

create or replace function public.kutu__session_by_admin(p_admin_token text)
returns public.kutu_sessions
language plpgsql
stable
set search_path = ''
as $$
declare
  s public.kutu_sessions;
begin
  select * into s from public.kutu_sessions
   where admin_token_hash = encode(sha256(convert_to(coalesce(p_admin_token, ''), 'UTF8')), 'hex');
  if not found then
    raise exception 'Link admin ini tidak sah, atau kutu ini telah dipadam.' using errcode = 'KT404';
  end if;
  return s;
end;
$$;

-- ---------------------------------------------------------------- Edit

create or replace function public.kutu_admin_update(
  p_admin_token text, p_group text, p_start date, p_names text[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s        public.kutu_sessions := public.kutu__session_by_admin(p_admin_token);
  v_group  text := left(public.kutu__norm(p_group), 80);
  v_cur    text[];
  v_names  text[];
  v_picked int;
  v_seed   bytea;
  v_hex    text;
  v_perm   int[];
  v_start  date := date_trunc('month', coalesce(p_start, s.start_month))::date;
begin
  select * into s from public.kutu_sessions where id = s.id for update;
  select count(*) into v_picked from public.kutu_participants where session_id = s.id and picked_card is not null;
  select array_agg(name order by idx) into v_cur from public.kutu_participants where session_id = s.id;

  -- Nama group: sentiasa boleh.
  if v_group <> '' and v_group <> s.group_name then
    update public.kutu_sessions set group_name = v_group where id = s.id;
  end if;

  v_names := case when p_names is null then v_cur else public.kutu__clean_names(p_names) end;

  if v_names is distinct from v_cur or v_start <> s.start_month then
    if v_picked > 0 then
      raise exception 'Tak boleh ubah nama ahli atau bulan mula kerana dah ada ahli yang cabut. Hanya nama group boleh diubah.' using errcode = 'KT409';
    end if;
    update public.kutu_sessions set start_month = v_start, relocked_at = now() where id = s.id;
  end if;

  if v_names is distinct from v_cur then
    -- Susun semula kad dengan benih baru; Kod Kunci baru.
    v_seed := extensions.gen_random_bytes(32);
    v_hex  := encode(v_seed, 'hex');
    v_perm := public.kutu__perm(v_seed, array_length(v_names, 1));
    delete from public.kutu_participants where session_id = s.id;
    delete from public.kutu_cards where session_id = s.id;
    update public.kutu_sessions
       set n = array_length(v_names, 1), seed = v_hex,
           commit_hash = public.kutu__commit(v_hex, v_names), status = 'open', completed_at = null
     where id = s.id;
    insert into public.kutu_cards (session_id, card, month)
    select s.id, g, v_perm[g] from generate_series(1, array_length(v_names, 1)) g;
    insert into public.kutu_participants (session_id, idx, name, token)
    select s.id, o, x, public.kutu__token() from unnest(v_names) with ordinality u(x, o);
  end if;

  select * into s from public.kutu_sessions where id = s.id;
  return public.kutu__admin_payload(s);
end;
$$;

-- ---------------------------------------------------------------- Padam

create or replace function public.kutu_admin_delete(p_admin_token text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.kutu_sessions := public.kutu__session_by_admin(p_admin_token);
begin
  select * into s from public.kutu_sessions where id = s.id for update;
  if exists (select 1 from public.kutu_participants where session_id = s.id and picked_card is not null) then
    raise exception 'Tak boleh padam kerana dah ada ahli yang cabut. Anda masih boleh buang kutu ini dari senarai di telefon anda.' using errcode = 'KT409';
  end if;
  delete from public.kutu_sessions where id = s.id;
end;
$$;

-- ---------------------------------------------------------------- Paparan ahli (tambah relocked_at)

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
    raise exception 'Link cabutan ini tidak sah atau kutu telah dipadam oleh admin.' using errcode = 'KT404';
  end if;
  return jsonb_build_object(
    'public_id',    s.public_id,
    'group_name',   s.group_name,
    'start_month',  s.start_month,
    'n',            s.n,
    'status',       s.status,
    'commit_hash',  s.commit_hash,
    'created_at',   s.created_at,
    'relocked_at',  s.relocked_at,
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

-- Tandatangan baru dengan p_commit_hash (pilihan). Versi lama dibuang supaya tiada kekeliruan
-- panggilan; frontend lama yang hantar 3 parameter masih berfungsi melalui nilai lalai.
drop function if exists public.kutu_group_pick(text, int, int);
create or replace function public.kutu_group_pick(p_public_id text, p_idx int, p_card int, p_commit_hash text default null)
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
  select * into s from public.kutu_sessions where public_id = coalesce(p_public_id, '') for update;
  if not found then
    raise exception 'Link cabutan ini tidak sah atau kutu telah dipadam oleh admin.' using errcode = 'KT404';
  end if;
  if p_commit_hash is not null and p_commit_hash <> s.commit_hash then
    raise exception 'Admin baru sahaja kemas kini senarai nama. Sila pilih nama anda semula.' using errcode = 'KT410';
  end if;
  select * into me from public.kutu_participants where session_id = s.id and idx = p_idx;
  if not found then
    raise exception 'Nama tidak dijumpai.' using errcode = 'KT404';
  end if;
  if me.picked_card is not null then
    raise exception '% dah cabut kad.', me.name using errcode = 'KT409';
  end if;
  if p_card is null or p_card < 1 or p_card > s.n then
    raise exception 'Kad tidak sah.' using errcode = 'KT400';
  end if;
  if exists (select 1 from public.kutu_participants
              where session_id = s.id and picked_card = p_card) then
    raise exception 'Kad ini baru sahaja diambil orang lain. Sila pilih kad lain.' using errcode = 'KT409';
  end if;

  update public.kutu_participants
     set picked_card = p_card, picked_at = now()
   where id = me.id;

  perform public.kutu__maybe_finish(s.id);
  return public.kutu_group_view(p_public_id);
end;
$$;

-- ---------------------------------------------------------------- Kebenaran

revoke execute on function
  public.kutu__clean_names(text[]),
  public.kutu_admin_update(text, text, date, text[]),
  public.kutu_admin_delete(text),
  public.kutu_group_pick(text, int, int, text)
  from public, anon, authenticated;

grant execute on function
  public.kutu_admin_update(text, text, date, text[]),
  public.kutu_admin_delete(text),
  public.kutu_group_pick(text, int, int, text)
  to anon, authenticated;
