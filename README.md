# Tongkrongan Hiroo POS

Aplikasi kasir berbasis web untuk Tongkrongan Hiroo dengan fitur login berbasis peran, manajemen shift, pesanan, pembayaran tunai/QRIS, laporan harian, dan sinkronisasi Google Sheets.

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** MySQL 8
- **Integration:** Google Sheets API

## Struktur Project

```text
tongkrongan-hiroo-pos/
├── client/          # Frontend React
├── server/          # Backend Express modular
├── database/        # Schema dan seed database
└── README.md
```

Detail struktur:

- `client/` — Frontend React (tampilan tetap seperti prototipe AI Studio).
- `server/` — Backend Express modular (`src/config`, `middleware`, `routes`, `utils`, `services`).
- `database/` — `schema.sql` (7 tabel) dan `seed.sql` (peran + menu awal).

## Menjalankan Secara Lokal

### Prasyarat

- Node.js 20+
- MySQL 8
- Git

### 1. Menjalankan Backend

Buka terminal pertama:

```bash
cd server
cp .env.example .env
```

Isi konfigurasi pada `server/.env`, terutama `DB_PASSWORD` dan `JWT_SECRET` (gunakan string acak minimal 32 karakter).

Kemudian jalankan:

```bash
npm install
npm run seed
npm run dev
```

Backend berjalan di:

`http://localhost:4000`

Pengecekan server:

`http://localhost:4000/api/health`

**Peringatan:** `npm run seed` dapat menghapus database lama sebelum mengisi ulang data awal. Pastikan melakukan backup terlebih dahulu.

### 2. Menjalankan Frontend

Buka terminal kedua:

```bash
cd client
npm install
npm run dev
```

Frontend berjalan di:

`http://localhost:3000`

Endpoint `/api` diteruskan ke backend port `4000`.

## Akun Pengujian

Akun berikut digunakan untuk pengembangan lokal:

| Username | Nama | Peran | Password |
|---|---|---|---|
| faiz | Faiz | Owner | owner123 |
| nadia | Nadia | Owner | owner123 |
| siti | Siti | Cashier | kasir123 |
| budi | Budi | Cashier | kasir123 |

Jangan menggunakan password pengujian ini untuk lingkungan produksi.

## Endpoint yang Sudah Tersedia

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/health` | Status server dan database |
| POST | `/api/auth/login` | Login `{username, password}`, set cookie httpOnly |
| POST | `/api/auth/logout` | Menghapus cookie |
| GET | `/api/auth/me` | Memeriksa sesi pengguna |

Format respons API:

Berhasil:
```json
{
  "success": true,
  "data": {}
}
```

Gagal:
```json
{
  "success": false,
  "message": "Error message"
}
```

## Aturan Kerja Tim

### Pembagian Branch

Setiap anggota menggunakan branch masing-masing:

- `karel/...`
- `dwi/...`
- `ilham/...`

Setiap perubahan diajukan melalui Pull Request ke branch `main` dan direview oleh satu anggota tim lainnya.

### Aturan Pengembangan

1. Setiap anggota hanya mengubah file sesuai bagian tugasnya.
2. Route baru harus didaftarkan di `server/src/routes/index.js` (satu baris per modul).
3. Pemanggil API ditambahkan melalui `client/src/lib/api.ts`.
4. Tampilan tidak boleh diubah tanpa persetujuan tim.
5. Dilarang melakukan commit terhadap `.env`, kunci Google, atau data pribadi.

## Cara Menambahkan Modul Backend

Contoh penambahan modul pesanan:

1. Buat file `server/src/routes/orders.js`.
2. Gunakan `Router`, bungkus handler dengan `asyncHandler`, dan gunakan `requireAuth` atau `requireRole('owner')` sesuai kebutuhan.
3. Daftarkan route di `server/src/routes/index.js`:

```javascript
router.use('/orders', orderRoutes);
```

4. Buat pemanggil API di `client/src/lib/api.ts`.
5. Ganti pemakaian store tiruan pada komponen sesuai modul yang dikerjakan.

## Status Pengembangan

- [x] Fondasi: struktur repository, server modular, MySQL, autentikasi JWT cookie, lapisan API, dan login tersambung.
- [ ] Shift, pesanan, pembayaran — **Dwi**.
- [ ] Menu, laporan, akun, riwayat — **Ilham**.
- [ ] Google Sheets dan pendaftaran HKI — **Karel**.

## Catatan Pengembangan

Bagian aplikasi selain login masih menggunakan data tiruan di:

`client/src/store/posStore.tsx`

Data tersebut akan diganti dengan integrasi backend sesuai pembagian modul masing-masing anggota tim.

---

**Tongkrongan Hiroo POS**  
*Developed collaboratively by the Tongkrongan Hiroo team.*