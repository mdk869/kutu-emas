# Kutu Emas — Cabutan Giliran Jarak Jauh

Cabutan giliran kutu emas yang adil dan boleh disemak. Admin kunci senarai, setiap peserta dapat pautan peribadi dan cabut kad sendiri dari telefon. Keputusan penuh dibuka bila semua selesai.

## Aliran

1. **Admin** masukkan nama peserta → server susun kad secara rawak dan jana **Kod Kunci** (cth. `EMAS-K7M2-Q9XT`).
2. Admin umumkan Kod Kunci dalam group, kemudian tekan **Hantar** untuk menghantar pautan peribadi (`#p=…`) kepada setiap peserta melalui WhatsApp.
3. **Peserta** pilih satu kad tertutup (siapa cepat dia dapat) dan terus nampak bulan sendiri.
4. Peserta yang lambat: admin tekan **⋯ → Cabut bagi pihaknya**, dan server pilih kad baki secara rawak.
5. Bila semua selesai, admin kongsi **pautan keputusan** (`#k=…`) dalam group. Setiap halaman keputusan menyemak secara automatik dan memaparkan lencana **✓ Disahkan adil**.

Butiran teknikal (kod pengesahan penuh, kod benih) disorok di bawah "Butiran untuk semakan lanjutan" dan halaman `#semak`.

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
src/views/             create, admin, participant, results, verify
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
