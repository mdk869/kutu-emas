-- Akaun admin: cabutan disimpan atas nama admin (Supabase Auth, emel + kod 6 digit).
--   * Cabutan yang dicipta semasa log masuk direkod atas nama admin.
--     (Peraturan "wajib log masuk untuk cipta" berada dalam migrasi berikutnya,
--      supaya ia dijalankan serentak dengan deploy frontend.)
--   * Admin buka cabutan sendiri melalui session_id + auth.uid(), tanpa pautan admin.
--   * Cabutan lama (tanpa pemilik) boleh dituntut dengan pautan admin.
--   * Peserta tidak berubah: tiada log masuk, guna pautan group.

alter table public.kutu_sessions
  add column owner_id uuid,
  add column archived boolean not null default false;
create index kutu_sessions_owner_idx on public.kutu_sessions (owner_id, created_at desc);

-- ---------------------------------------------------------------- Dalaman

create or replace function public.kutu__admin_payload(s public.kutu_sessions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'session_id',   s.id,
    'public_id',    s.public_id,
    'owned',        s.owner_id is not null,
    'archived',     s.archived,
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

create or replace function public.kutu__owned(p_session_id uuid)
returns public.kutu_sessions
language plpgsql
stable
set search_path = ''
as $$
declare
  s public.kutu_sessions;
begin
  if auth.uid() is null then
    raise exception 'Sila log masuk sebagai admin.' using errcode = 'KT401';
  end if;
  select * into s from public.kutu_sessions where id = p_session_id and owner_id = auth.uid();
  if not found then
    raise exception 'Cabutan ini tidak dijumpai dalam akaun anda.' using errcode = 'KT404';
  end if;
  return s;
end;
$$;

-- Pilih kad baki secara rawak (CSPRNG) bagi pihak peserta. Pemanggil mesti sudah mengunci sesi.
create or replace function public.kutu__do_admin_pick(p_session public.kutu_sessions, p_idx int)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  me   public.kutu_participants;
  card int;
begin
  select * into me from public.kutu_participants where session_id = p_session.id and idx = p_idx;
  if not found then
    raise exception 'Peserta tidak dijumpai.' using errcode = 'KT404';
  end if;
  if me.picked_card is not null then
    raise exception '% sudah mencabut kad.', me.name using errcode = 'KT409';
  end if;
  select g into card
    from generate_series(1, p_session.n) g
   where not exists (select 1 from public.kutu_participants p
                      where p.session_id = p_session.id and p.picked_card = g)
   order by extensions.gen_random_bytes(8)
   limit 1;
  update public.kutu_participants
     set picked_card = card, picked_at = now(), picked_by_admin = true
   where id = me.id;
  perform public.kutu__maybe_finish(p_session.id);
end;
$$;

-- ---------------------------------------------------------------- Cipta (rekod pemilik jika log masuk)

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

  insert into public.kutu_sessions (admin_token_hash, group_name, start_month, n, seed, commit_hash, owner_id)
  values (encode(sha256(convert_to(v_admin, 'UTF8')), 'hex'), v_group,
          date_trunc('month', p_start)::date, v_n, v_hex, public.kutu__commit(v_hex, v_names), auth.uid())
  returning id into v_sid;

  insert into public.kutu_cards (session_id, card, month)
  select v_sid, g, v_perm[g] from generate_series(1, v_n) g;

  insert into public.kutu_participants (session_id, idx, name, token)
  select v_sid, o, x, public.kutu__token()
    from unnest(v_names) with ordinality u(x, o);

  return jsonb_build_object('admin_token', v_admin, 'session_id', v_sid);
end;
$$;

-- ---------------------------------------------------------------- Admin melalui pautan (lama)

create or replace function public.kutu_admin_view(p_admin_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.kutu__admin_payload(public.kutu__session_by_admin(p_admin_token));
$$;

create or replace function public.kutu_admin_pick(p_admin_token text, p_idx int)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.kutu_sessions := public.kutu__session_by_admin(p_admin_token);
begin
  select * into s from public.kutu_sessions where id = s.id for update;
  perform public.kutu__do_admin_pick(s, p_idx);
  return public.kutu_admin_view(p_admin_token);
end;
$$;

-- ---------------------------------------------------------------- Admin melalui akaun

create or replace function public.kutu_owner_view(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.kutu__admin_payload(public.kutu__owned(p_session_id));
$$;

create or replace function public.kutu_owner_pick(p_session_id uuid, p_idx int)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.kutu_sessions := public.kutu__owned(p_session_id);
begin
  select * into s from public.kutu_sessions where id = s.id for update;
  perform public.kutu__do_admin_pick(s, p_idx);
  return public.kutu_owner_view(p_session_id);
end;
$$;

create or replace function public.kutu_my_sessions(p_archived boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sila log masuk sebagai admin.' using errcode = 'KT401';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'session_id', s.id, 'group_name', s.group_name, 'n', s.n, 'status', s.status,
             'start_month', s.start_month, 'created_at', s.created_at, 'completed_at', s.completed_at,
             'archived', s.archived,
             'picked', (select count(*) from public.kutu_participants p
                         where p.session_id = s.id and p.picked_card is not null),
             'names', (select jsonb_agg(p.name order by p.idx) from public.kutu_participants p
                        where p.session_id = s.id))
           order by s.created_at desc)
      from public.kutu_sessions s
     where s.owner_id = auth.uid() and s.archived = coalesce(p_archived, false)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.kutu_set_archived(p_session_id uuid, p_archived boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.kutu_sessions := public.kutu__owned(p_session_id);
begin
  update public.kutu_sessions set archived = coalesce(p_archived, false) where id = s.id;
end;
$$;

-- Tuntut cabutan lama (tanpa pemilik) ke akaun yang sedang log masuk, menggunakan pautan admin.
create or replace function public.kutu_claim_session(p_admin_token text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.kutu_sessions;
begin
  if auth.uid() is null then
    raise exception 'Sila log masuk sebagai admin.' using errcode = 'KT401';
  end if;
  s := public.kutu__session_by_admin(p_admin_token);
  if s.owner_id is not null and s.owner_id <> auth.uid() then
    raise exception 'Cabutan ini sudah berada dalam akaun admin lain.' using errcode = 'KT409';
  end if;
  update public.kutu_sessions set owner_id = auth.uid() where id = s.id;
  return s.id;
end;
$$;

-- ---------------------------------------------------------------- Kebenaran

revoke execute on function
  public.kutu__admin_payload(public.kutu_sessions), public.kutu__owned(uuid),
  public.kutu__do_admin_pick(public.kutu_sessions, int),
  public.kutu_create_session(text, date, text[], text),
  public.kutu_admin_view(text), public.kutu_admin_pick(text, int),
  public.kutu_owner_view(uuid), public.kutu_owner_pick(uuid, int),
  public.kutu_my_sessions(boolean), public.kutu_set_archived(uuid, boolean),
  public.kutu_claim_session(text)
  from public, anon, authenticated;

-- Pautan admin lama kekal berfungsi tanpa log masuk.
grant execute on function public.kutu_admin_view(text), public.kutu_admin_pick(text, int),
  public.kutu_create_session(text, date, text[], text)
  to anon, authenticated;

-- Hanya admin yang log masuk.
grant execute on function
  public.kutu_owner_view(uuid), public.kutu_owner_pick(uuid, int),
  public.kutu_my_sessions(boolean), public.kutu_set_archived(uuid, boolean),
  public.kutu_claim_session(text)
  to authenticated;
