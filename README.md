# Uang Kas - Aplikasi Pencatatan Kas Kelompok Kecil

Aplikasi web untuk mencatat uang kas kelompok kecil (6 anggota), menggantikan pencatatan manual di kertas. Dirancang khusus untuk bendahara & wakil bendahara tanpa memerlukan sistem login (keamanan mengandalkan kerahasiaan URL).

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS, di-hosting di GitHub Pages (base path `/kassh/`).
- **Backend**: Google Apps Script (`apps-script/Code.gs`) yang membaca dan menulis data ke Google Sheets sebagai database.
- **Deploy Otomatis**: GitHub Actions (`.github/workflows/deploy.yml`) untuk build & publish ke GitHub Pages setiap push ke branch `main`.

## Fitur Utama

1. **Tabel Grid Pembayaran**: Baris = anggota, kolom = tanggal pertemuan. Klik sel untuk toggle status bayar/belum (terhubung langsung ke Google Sheets).
2. **Manajemen Anggota**: Tambah dan hapus anggota kelompok.
3. **Manajemen Pertemuan**: Tambah dan hapus sesi pertemuan (hari & tanggal).
4. **Pencatatan Pengeluaran**: Catat pengeluaran kas dengan tanggal, keterangan, dan nominal.
5. **Pengaturan Kas**: Edit nama periode (bulan/tahun) dan nominal kas per pertemuan.
6. **Panel Rekap & Tunggakan**: Menampilkan total pemasukan, total pengeluaran, saldo kas, serta daftar tunggakan anggota secara real-time.
7. **Keamanan & Kemudahan Mobile**: Proteksi PIN untuk aksi tulis, koneksi Google Sheets via parameter link `?gas=`, serta saran rotasi layar (*landscape*) dan mode layar penuh untuk pengguna HP.

---

## Cara Menjalankan Secara Lokal

Pastikan Anda sudah menginstal **Node.js** di komputer Anda dan memiliki URL Web App Google Apps Script yang sudah di-deploy (lihat bagian **Setup Backend**).

1. Masuk ke direktori frontend dan install dependensi:
   ```bash
   cd frontend
   npm install
   ```

2. Jalankan server development frontend:
   ```bash
   npm run dev
   ```

3. Buka browser di alamat yang tertera (biasanya `http://localhost:5173/kassh/`), lalu sambungkan ke Google Sheets dengan menyertakan parameter URL Apps Script pada kunjungan pertama, contoh:
   `http://localhost:5173/kassh/?gas=URL_WEB_APP_ANDA`
   (URL akan otomatis tersimpan di `localStorage` browser Anda).

---

## Setup Backend (Google Apps Script)

Kode sumber backend tersedia di file `apps-script/Code.gs`. Untuk menghubungkannya ke Google Sheets:

1. Buat Google Spreadsheet baru dengan 5 tab lembar kerja:
   - `Anggota`
   - `Pertemuan`
   - `Pembayaran`
   - `Pengaturan`
   - `Pengeluaran`
   *(Pastikan nama tab dan header kolom menggunakan huruf kecil sesuai ketentuan backend).*
2. Buka menu **Extensions > Apps Script** di spreadsheet Anda.
3. Salin seluruh isi kode dari `apps-script/Code.gs` ke editor Apps Script.
4. Lakukan **Deploy** sebagai **Web App** dengan pengaturan:
   - **Execute as**: *Me* (Akun Anda)
   - **Who has access**: *Anyone* (Siapa saja, termasuk anonim untuk akses API web)
5. Salin URL Web App yang dihasilkan dan gunakan untuk menghubungkan aplikasi frontend.
