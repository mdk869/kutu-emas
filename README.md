# Kutu Emas — Cabutan Giliran Jarak Jauh

Cabutan giliran kutu emas yang adil dan boleh disemak. Admin kunci senarai, setiap peserta dapat pautan peribadi dan cabut kad sendiri dari telefon. Keputusan penuh dibuka bila semua selesai.

## Aliran

1. **Admin** masukkan nama peserta → server susun kad secara rawak dan jana **Kod Kunci** (cth. `EMAS-K7M2-Q9XT`).
2. Admin kongsi **satu pautan cabutan** (`#k=…`) dalam group WhatsApp. Tiada PM kepada sesiapa.
3. **Peserta** buka pautan yang sama, tekan nama sendiri, sahkan ("Ya, saya Rosnah"), dan pilih satu kad.
4. **Papan langsung:** setiap kad yang dibuka dipaparkan kepada semua serta-merta. Isi kad yang belum dibuka kekal tersembunyi, termasuk daripada admin.
5. Peserta yang lambat: admin tekan **⋯ → Cabut bagi pihaknya**. Server pilih kad baki secara rawak, dan semua nampak ia dicabut oleh admin.
6. Bila semua selesai, pautan yang sama memaparkan senarai giliran dengan lencana **✓ Disahkan adil**.

Butiran teknikal (kod pengesahan penuh, kod benih) disorok di bawah "Butiran untuk semakan lanjutan" dan halaman `#semak`. Pautan peribadi (`#p=…`) masih berfungsi tetapi tidak lagi digunakan dalam aliran utama.

## Akaun admin

- Admin log masuk dengan **emel + kod 6 digit** (Supabase Auth). Kod dipilih berbanding pautan log masuk kerana pautan di iPhone terbuka di Safari, bukan dalam aplikasi yang dipasang.
- **Cabutan saya** (`/`): semua cabutan atas nama admin, dari mana-mana peranti. Tab Aktif/Arkib, *Guna semula senarai nama*, dan *Tambah cabutan sedia ada* (tuntut dengan pautan admin lama `#a=…`).
- Papan admin dibuka melalui `#s=<session_id>` dan disemak dengan `auth.uid()`. Pautan admin lama masih berfungsi.
- Mencipta cabutan **wajib log masuk** (`20261028130000_kutu_require_login.sql`). Peserta tidak perlu akaun.

### Tetapan Supabase Auth (sekali sahaja)
1. **Authentication → Email Templates → Magic Link** dan **Confirm signup**: masukkan `{{ .Token }}` dalam isi emel supaya kod 6 digit dihantar.
2. **Authentication → SMTP**: sambung SMTP sendiri (cth. Resend). Emel terbina dalam Supabase hanya menghantar kepada ahli pasukan projek dan dihadkan beberapa emel sejam.

## Aplikasi (PWA) untuk admin

- `public/manifest.webmanifest`, ikon PNG (`public/icons/`, `public/apple-touch-icon.png`) dan `public/sw.js`.
- Gesaan automatik Chrome disekat di semua halaman; butang **Pasang aplikasi** hanya dipaparkan di halaman admin. iPhone mendapat panduan *Add to Home Screen*. Halaman peserta (`#k=`, `#p=`) tidak pernah memaparkan gesaan.
- Service worker menyimpan rangka aplikasi sahaja. Panggilan Supabase tidak disimpan, jadi data cabutan sentiasa terkini.

## Keadilan

| Jaminan | Bagaimana |
|---|---|
| Rawak sebenar | `gen_random_bytes` (CSPRNG) di Postgres, boleh dicampur nombor bertuah peserta |
| Tidak boleh diubah | Kod pengesahan = SHA-256(benih + senarai nama). Kod Kunci = 40 bit pertamanya (Crockford base32) untuk dibaca manusia; semakan automatik guna hash penuh |
| Tiada siapa boleh intai | Isi kad dalam jadual RLS tanpa polisi. Admin pun hanya nampak kad yang sudah dibuka |
| Tiada kad berganda | Kunci baris sesi (`FOR UPDATE`) + indeks unik `(session_id, picked_card)` |
| Boleh disemak | `src/fair.js` mengira semula algoritma yang sama dengan `kutu__perm` di SQL |

## Struktur

```
supabase/migrations/   skema, RLS, fungsi RPC
src/fair.js            algoritma susunan rawak + semakan (mesti sama dengan SQL)
src/api.js             panggilan RPC ke Supabase (fetch, tiada SDK)
src/auth.js            log masuk emel + kod (REST Supabase Auth, tanpa SDK)
src/pwa.js             gesaan pasang (admin sahaja), service worker, jalur luar talian
src/views/             home, login, create, admin, group (pautan group), participant, verify
test/fair.test.mjs     ujian: vektor sama dengan SQL, taburan sekata
```

Semua jadual dan fungsi berawalan `kutu_`, jadi selamat dipasang dalam projek Supabase yang dikongsi.

## Pembangunan

```bash
cp .env.example .env.local   # isi URL dan kunci publishable Supabase
npm install
npm run dev
npm test
```

## Deploy

1. Jalankan migrasi dalam `supabase/migrations/` pada projek Supabase.
2. Di Vercel, import repo (preset Vite) dan tetapkan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
