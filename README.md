# Uang Kas - Aplikasi Pencatatan Kas 

Aplikasi web untuk mencatat uang kas, menggantikan pencatatan manual di kertas. Dirancang khusus untuk bendahara & wakil bendahara tanpa memerlukan autentikasi login (cukup jaga kerahasiaan URL).

## Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS


## Fitur Utama
1. **Tabel Grid**: Baris = anggota, kolom = tanggal pertemuan. Klik sel untuk toggle status bayar/belum (update otomatis tersimpan ke database via API).
2. **Manajemen Anggota**: Tambah dan hapus anggota 
3. **Manajemen Pertemuan**: Tambah dan hapus sesi pertemuan (hari + tanggal, dengan seed data bulan Oktober 2026).
4. **Pengaturan Kas**: Edit nama periode (bulan/tahun) dan nominal kas per pertemuan.
5. **Panel Rekap & Tunggakan**: Menampilkan total kas terkumpul secara real-time dan daftar anggota yang masih memiliki tunggakan beserta jumlah pertemuan yang belum dibayar.
6. **Desain**: Mengikuti tema kas fisik (Navy gelap `#141b26`, Merah aksen `#9c1f1f`, Cream `#ece6d6`), font serif tebal untuk judul, serta kolom nama anggota yang *sticky* saat di-scroll horizontal.

---

## Cara Menjalankan Secara Lokal (1 Perintah)

Pastikan Anda sudah menginstal **Node.js** di komputer Anda.

1. Install dependensi root, backend, dan frontend sekaligus (atau jalankan satu per satu jika diperlukan):
   ```bash
   npm install
   npm install --prefix backend
   npm install --prefix frontend
   ```

2. Setup database Prisma & seed data awal:
   ```bash
   npm run prisma:push --prefix backend
   npm run seed --prefix backend
   ```

3. Jalankan aplikasi (Backend Express di port 5000 & Frontend Vite secara bersamaan):
   ```bash
   npm run dev
   ```

4. Buka browser di alamat yang tertera (biasanya `http://localhost:5173`).
