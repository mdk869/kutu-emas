-- Kutu Emas: cabutan giliran jarak jauh
--
-- Prinsip keselamatan:
--   * Semua jadual kutu_* ada RLS tanpa polisi -> tidak boleh dibaca terus dari pelayar.
--   * Semua akses melalui fungsi RPC SECURITY DEFINER yang menyemak token.
--   * Isi kad (kutu_cards) TIDAK pernah dihantar ke pelayar sebelum kad dibuka,
--     termasuk kepada admin. Admin hanya nampak bulan bagi kad yang sudah dicabut.
--   * Kod benih (seed) hanya didedahkan selepas semua peserta selesai.
--
-- Algoritma susunan rawak (mesti sama dengan src/fair.js):
--   Fisher-Yates ke atas [1..n]; indeks rawak = uint32 big-endian daripada
--   sha256(seed || int4send(counter)), dengan rejection sampling supaya tiada bias modulo.
-- Kod pengesahan:
--   sha256("kutu-emas:v1\n" || seed_hex || "\n" || nama dipisah "\n"), dalam heks.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- Jadual

create table public.kutu_sessions (
  id               uuid primary key default gen_random_uuid(),
  admin_token_hash text not null unique,
  group_name       text not null check (char_length(group_name) between 1 and 80),
  start_month      date not null,
  n                int  not null check (n between 2 and 24),
  status           text not null default 'open' check (status in ('open', 'done')),
  seed             text not null,
  commit_hash      text not null,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create table public.kutu_participants (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.kutu_sessions (id) on delete cascade,
  idx             int  not null,
  name            text not null,
  token           text not null unique,
  picked_card     int,
  picked_at       timestamptz,
  picked_by_admin boolean not null default false,
  unique (session_id, idx)
);

-- Dua peserta tidak boleh memegang kad yang sama.
create unique index kutu_participants_card_uniq
  on public.kutu_participants (session_id, picked_card)
  where picked_card is not null;

create table public.kutu_cards (
  session_id uuid not null references public.kutu_sessions (id) on delete cascade,
  card       int  not null,
  month      int  not null,
  primary key (session_id, card)
);

alter table public.kutu_sessions     enable row level security;
alter table public.kutu_participants enable row level security;
alter table public.kutu_cards        enable row level security;

revoke all on table public.kutu_sessions, public.kutu_participants, public.kutu_cards
  from anon, authenticated;

-- ---------------------------------------------------------------- Fungsi dalaman

create or replace function public.kutu__token()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
$$;

create or replace function public.kutu__norm(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g');
$$;

create or replace function public.kutu__perm(p_seed bytea, p_n int)
returns int[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  a   int[] := array(select generate_series(1, p_n));
  i   int;
  m   bigint;
  lim bigint;
  c   int := 0;
  h   bytea;
  x   bigint;
  j   int;
  t   int;
begin
  for i in reverse (p_n - 1)..1 loop
    m   := i + 1;
    lim := (4294967296 / m) * m;
    loop
      h := sha256(p_seed || int4send(c));
      c := c + 1;
      x := (get_byte(h, 0)::bigint << 24) | (get_byte(h, 1)::bigint << 16)
         | (get_byte(h, 2)::bigint << 8)  |  get_byte(h, 3)::bigint;
      exit when x < lim;
    end loop;
    j := (x % m)::int;
    t := a[i + 1]; a[i + 1] := a[j + 1]; a[j + 1] := t;
  end loop;
  return a;
end;
$$;

create or replace function public.kutu__commit(p_seed_hex text, p_names text[])
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(
    'kutu-emas:v1' || E'\n' || p_seed_hex || E'\n' || array_to_string(p_names, E'\n'),
    'UTF8')), 'hex');
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
    raise exception 'Pautan admin tidak sah atau sesi telah dipadam.' using errcode = 'KT404';
  end if;
  return s;
end;
$$;

-- Tandakan sesi selesai jika semua kad sudah dicabut.
create or replace function public.kutu__maybe_finish(p_session uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  update public.kutu_sessions s
     set status = 'done', completed_at = now()
   where s.id = p_session
     and s.status = 'open'
     and not exists (select 1 from public.kutu_participants p
                      where p.session_id = p_session and p.picked_card is null);
$$;

-- Senarai keputusan penuh (hanya dipanggil bila sesi selesai, atau oleh admin untuk kad yang dibuka).
create or replace function public.kutu__results(p_session uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'month', c.month, 'name', p.name, 'card', p.picked_card,
           'by_admin', p.picked_by_admin, 'picked_at', p.picked_at)
         order by c.month), '[]'::jsonb)
    from public.kutu_participants p
    join public.kutu_cards c on c.session_id = p.session_id and c.card = p.picked_card
   where p.session_id = p_session;
$$;

-- ---------------------------------------------------------------- RPC awam

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

  return jsonb_build_object('admin_token', v_admin);
end;
$$;

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
    'group_name',   s.group_name,
    'start_month',  s.start_month,
    'n',            s.n,
    'status',       s.status,
    'commit_hash',  s.commit_hash,
    'created_at',   s.created_at,
    'completed_at', s.completed_at,
    'seed',         case when s.status = 'done' then s.seed end,
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
    'group_name',  s.group_name,
    'start_month', s.start_month,
    'n',           s.n,
    'status',      s.status,
    'commit_hash', s.commit_hash,
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

create or replace function public.kutu_pick(p_token text, p_card int)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me public.kutu_participants;
  s  public.kutu_sessions;
begin
  select * into me from public.kutu_participants where token = coalesce(p_token, '');
  if not found then
    raise exception 'Pautan peserta tidak sah. Minta pautan baru daripada admin.' using errcode = 'KT404';
  end if;

  -- Kunci sesi supaya cabutan dalam sesi yang sama diproses satu demi satu.
  select * into s from public.kutu_sessions where id = me.session_id for update;
  select * into me from public.kutu_participants where id = me.id;

  if me.picked_card is not null then
    raise exception 'Anda sudah mencabut kad.' using errcode = 'KT409';
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
  return public.kutu_participant_view(p_token);
end;
$$;

create or replace function public.kutu_admin_pick(p_admin_token text, p_idx int)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s    public.kutu_sessions := public.kutu__session_by_admin(p_admin_token);
  me   public.kutu_participants;
  card int;
begin
  perform 1 from public.kutu_sessions where id = s.id for update;
  select * into me from public.kutu_participants where session_id = s.id and idx = p_idx;
  if not found then
    raise exception 'Peserta tidak dijumpai.' using errcode = 'KT404';
  end if;
  if me.picked_card is not null then
    raise exception '% sudah mencabut kad.', me.name using errcode = 'KT409';
  end if;

  -- Pilih kad baki secara rawak (CSPRNG), bukan dipilih oleh admin.
  select g into card
    from generate_series(1, s.n) g
   where not exists (select 1 from public.kutu_participants p
                      where p.session_id = s.id and p.picked_card = g)
   order by extensions.gen_random_bytes(8)
   limit 1;

  update public.kutu_participants
     set picked_card = card, picked_at = now(), picked_by_admin = true
   where id = me.id;

  perform public.kutu__maybe_finish(s.id);
  return public.kutu_admin_view(p_admin_token);
end;
$$;

-- ---------------------------------------------------------------- Kebenaran

-- Hanya fungsi kutu_* disentuh, supaya selamat walaupun projek Supabase dikongsi dengan app lain.
revoke execute on function
  public.kutu__token(), public.kutu__norm(text), public.kutu__perm(bytea, int),
  public.kutu__commit(text, text[]), public.kutu__session_by_admin(text),
  public.kutu__maybe_finish(uuid), public.kutu__results(uuid),
  public.kutu_create_session(text, date, text[], text),
  public.kutu_admin_view(text),
  public.kutu_participant_view(text),
  public.kutu_pick(text, int),
  public.kutu_admin_pick(text, int)
  from public, anon, authenticated;

grant execute on function
  public.kutu_create_session(text, date, text[], text),
  public.kutu_admin_view(text),
  public.kutu_participant_view(text),
  public.kutu_pick(text, int),
  public.kutu_admin_pick(text, int)
  to anon, authenticated;
