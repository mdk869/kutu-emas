// Log masuk admin: emel + kod 6 digit (Supabase Auth, REST terus tanpa SDK).
// Kod (bukan pautan) dipilih kerana pautan log masuk di iPhone terbuka di Safari, bukan dalam aplikasi PWA.

const BASE = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const STORE = 'kutu-emas-auth';

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)); } catch { return null; }
}
function save(s) {
  try { s ? localStorage.setItem(STORE, JSON.stringify(s)) : localStorage.removeItem(STORE); } catch { /* storan disekat */ }
}

let session = load();
let refreshing = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(session));

function friendly(status, data) {
  const code = data?.error_code || data?.code || data?.error;
  const msg = (data?.msg || data?.error_description || data?.message || '').toLowerCase();
  if (status === 429 || /rate limit|over_email_send_rate_limit/.test(code + msg))
    return 'Terlalu banyak permintaan kod. Sila cuba lagi selepas beberapa minit.';
  if (/otp_expired|expired|invalid/.test(code + msg)) return 'Kod salah atau sudah tamat tempoh. Minta kod baru.';
  if (/email_address_invalid|invalid email|validate email/.test(code + msg)) return 'Alamat emel tidak sah.';
  if (/not authorized|email_address_not_authorized/.test(code + msg))
    return 'Emel ini belum dibenarkan oleh sistem emel. Hubungi pemilik sistem.';
  return 'Tidak dapat log masuk sekarang. Cuba lagi sebentar.';
}

async function call(path, body, token) {
  if (!BASE || !KEY) throw new Error('Sambungan Supabase belum ditetapkan.');
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${BASE}/auth/v1/${path}`, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  } catch {
    throw new Error('Tiada sambungan internet. Semak talian dan cuba lagi.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(friendly(res.status, data));
  return data;
}

function adopt(data) {
  session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    email: data.user?.email || session?.email,
  };
  save(session);
  emit();
  return session;
}

export const auth = {
  get email() { return session?.email || null; },
  get loggedIn() { return !!session; },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  sendCode: (email) => call('otp', { email: email.trim().toLowerCase(), create_user: true }),

  async verify(email, code) {
    const data = await call('verify', { type: 'email', email: email.trim().toLowerCase(), token: code.trim() });
    return adopt(data);
  },

  /** Token akses yang sah (diperbaharui automatik), atau null jika tidak log masuk. */
  async token() {
    if (!session) return null;
    if (session.expires_at - 60 > Date.now() / 1000) return session.access_token;
    if (!refreshing) {
      refreshing = call('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
        .then(adopt)
        .catch(() => { session = null; save(null); emit(); return null; })
        .finally(() => { refreshing = null; });
    }
    const s = await refreshing;
    return s?.access_token || null;
  },

  async logout() {
    const t = session?.access_token;
    session = null;
    save(null);
    emit();
    if (t) call('logout', {}, t).catch(() => {});
  },
};

// Segerak log keluar/masuk antara tab.
addEventListener('storage', (e) => { if (e.key === STORE) { session = load(); emit(); } });
