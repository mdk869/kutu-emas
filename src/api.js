const BASE = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

async function rpc(fn, args) {
  if (!BASE || !KEY) throw new ApiError('Sambungan Supabase belum ditetapkan (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  if (KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${KEY}`; // kunci anon lama (JWT)
  let res;
  try {
    res = await fetch(`${BASE.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
    });
  } catch {
    throw new ApiError('Tiada sambungan internet. Semak talian dan cuba lagi.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.message || 'Ralat pelayan. Cuba lagi sebentar.', data?.code);
  return data;
}

export const api = {
  createSession: (group, start, names, luck) =>
    rpc('kutu_create_session', { p_group: group, p_start: start, p_names: names, p_luck: luck || null }),
  adminView: (token) => rpc('kutu_admin_view', { p_admin_token: token }),
  adminPick: (token, idx) => rpc('kutu_admin_pick', { p_admin_token: token, p_idx: idx }),
  participantView: (token) => rpc('kutu_participant_view', { p_token: token }),
  pick: (token, card) => rpc('kutu_pick', { p_token: token, p_card: card }),
  groupView: (publicId) => rpc('kutu_group_view', { p_public_id: publicId }),
  groupPick: (publicId, idx, card) => rpc('kutu_group_pick', { p_public_id: publicId, p_idx: idx, p_card: card }),
};
