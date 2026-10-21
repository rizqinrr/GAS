# Website Sekolah - SD Negeri Semanu III (Google Apps Script)

Prototipe website sekolah berbasis **Google Apps Script** dengan **Google Sheets sebagai database**.
Dibuat untuk keperluan **tugas Analisis Kebutuhan Website**.

- Nama: Mahmud Nida'
- NIM: 24010130110
- Lembaga: SD Negeri Semanu III
- Alamat: Munggi Pasar, Semanu, Kecamatan Semanu, Kabupaten Gunungkidul, DIY

> **Disclaimer**
> Ini bukan website resmi sekolah. Seluruh data, jadwal, nama, prestasi, dan kontak di dalam
> project ini adalah **data contoh** untuk keperluan tugas akademik. Jangan gunakan sebagai
> sumber informasi resmi. Ganti isi spreadsheet dengan data sebenarnya bila ingin dipakai.

## Daftar isi

1. [Kesesuaian dengan requirement](#1-kesesuaian-dengan-requirement)
2. [Struktur file](#2-struktur-file)
3. [Cara pasang (copy-paste manual)](#3-cara-pasang-copy-paste-manual)
4. [Struktur database](#4-struktur-database)
5. [Tutorial penggunaan untuk pengunjung](#5-tutorial-penggunaan-untuk-pengunjung)
6. [Tutorial mengelola konten (admin)](#6-tutorial-mengelola-konten-admin)
7. [Mengubah kode dan deploy ulang](#7-mengubah-kode-dan-deploy-ulang)
8. [Catatan teknis](#8-catatan-teknis)
9. [Troubleshooting](#9-troubleshooting)
10. [Checklist demo/presentasi](#10-checklist-demopresentasi)

---

## 1. Kesesuaian dengan requirement

**Ya, 8 dari 8 kebutuhan pada analisis kebutuhan sudah terwakili di website ini.**

| No | Kebutuhan | Implementasi | Status |
|----|-----------|--------------|--------|
| 1 | Informasi kegiatan & pengumuman terbaru | Section **Pengumuman**: kartu berisi tanggal, kategori, ringkasan, isi lengkap, dan badge "Penting" yang otomatis tampil paling atas | Terpenuhi |
| 2 | Profil sekolah: visi misi, fasilitas, tenaga pendidik, program | Section **Profil**: sambutan kepala sekolah, visi, misi, tabel guru, grid fasilitas, dan grid program | Terpenuhi |
| 3 | Kalender pendidikan & hari libur | Section **Kalender**: daftar tanggal dengan badge **Kegiatan** / **Libur** dan keterangan rentang tanggal | Terpenuhi |
| 4 | Prestasi siswa terkelompok | Section **Prestasi**: nama siswa, kelas, lomba, tingkat, juara, tanggal, dan deskripsi | Terpenuhi |
| 5 | Galeri foto/video per kategori & tanggal | Section **Galeri**: filter kategori, tanggal pada setiap kartu, lightbox, dukungan gambar dan video YouTube | Terpenuhi |
| 6 | Informasi PPDB | Section **PPDB**: status, tahun ajaran, periode, kuota, biaya, kontak panitia, persyaratan, dan alur | Terpenuhi |
| 7 | Kontak sekolah | Section **Kontak**: alamat, telepon, email, jam layanan, tombol Google Maps, WhatsApp, dan formulir kontak | Terpenuhi |
| 8 | Tampilan responsif + pencarian | Layout responsif (diuji di 1280 px dan 390 px), menu drawer di HP, pencarian global di header | Terpenuhi |

Catatan kecil:

- Pencarian berjalan di sisi browser (data sudah dimuat sekali), jadi hasil muncul instan tanpa memanggil server.
- Galeri sudah siap menampilkan foto/video, tetapi **tautan media harus diisi** di kolom `media_url`. Tanpa tautan, kartu memakai placeholder agar layout tetap rapi.
- Semua isi berasal dari spreadsheet. Setelah diganti dengan data asli, tidak perlu mengubah kode.

---

## 2. Struktur file

```
web-sekolah/
├── appsscript.json   # manifest (timezone, runtime V8)
├── Code.gs           # backend: doGet, setup database, API data, simpan pesan
├── Index.html        # struktur halaman (shell + semua section)
├── Styles.html       # CSS (di-include ke Index)
└── JavaScript.html   # render data, pencarian, filter galeri, form
```

---

## 3. Cara pasang (copy-paste manual)

1. Buka <https://script.google.com> → **New project**.
2. Ganti nama project, misal `Website SD Negeri Semanu III`.
3. Buka **Project Settings** (ikon gerigi) → centang **Show "appsscript.json" manifest file**.
4. Buka `appsscript.json` di editor, tempel isi `appsscript.json` dari folder ini.
5. Buka `Code.gs`, tempel seluruh isi `Code.gs`.
6. Tambahkan 3 file HTML: tombol **+** → **HTML**.
   - beri nama `Index` → tempel `Index.html`
   - beri nama `Styles` → tempel `Styles.html`
   - beri nama `JavaScript` → tempel `JavaScript.html`
   - **Nama file harus sama persis** (huruf besar/kecil berpengaruh).
7. Simpan (Ctrl+S), lalu pilih fungsi **`setupDatabase`** pada dropdown → **Run**.
   - Izinkan akses saat diminta (Google Sheets + Drive).
   - Buka **Execution log**: akan muncul URL spreadsheet database.
   - Spreadsheet `DB - Website SD Negeri Semanu III` otomatis dibuat berisi 11 sheet + data contoh.
8. **Deploy** → **New deployment** → pilih **Web app**.
   - Description: `v1`
   - Execute as: **Me**
   - Who has access: **Anyone** (atau *Anyone with Google account*)
   - **Deploy** → salin URL web app.
9. Buka URL tersebut. Kalau muncul "Data gagal dimuat", jalankan `setupDatabase` sekali lagi lalu reload.

> URL spreadsheet juga bisa dilihat kapan saja dengan menjalankan fungsi `showDatabaseUrl()`.

---

## 4. Struktur database

Spreadsheet dibuat otomatis, terdiri dari 11 sheet:

| Sheet | Isi |
|-------|-----|
| `Profil` | key-value: nama sekolah, alamat, kontak, sambutan, visi, misi, dsb. |
| `Pengumuman` | id, tanggal, judul, kategori, ringkasan, isi, penting |
| `Agenda` | id, tanggal_mulai, tanggal_selesai, judul, kategori, lokasi, deskripsi |
| `Kalender` | id, tanggal, judul, jenis (Kegiatan/Libur), keterangan |
| `Prestasi` | id, tanggal, nama, kelas, lomba, tingkat, juara, deskripsi |
| `Galeri` | id, tanggal, judul, kategori, tipe (Foto/Video), media_url, deskripsi |
| `Guru` | id, nama, nip, jabatan, mapel |
| `Fasilitas` | id, nama, deskripsi |
| `Program` | id, nama, deskripsi |
| `PPDB` | key-value: status, periode, kuota, persyaratan, alur, dsb. |
| `Pesan` | timestamp, nama, email, telepon, subjek, pesan, status |

Aturan umum saat mengedit:

- **Jangan mengubah atau menggeser baris header (baris 1).**
- Format tanggal wajib `YYYY-MM-DD` (contoh `2026-10-24`).
- Baris baru ditambahkan di bawah; kolom `id` harus unik (contoh `P-006`).
- Urutan tampilan diatur otomatis oleh kode: pengumuman (penting lalu terbaru), agenda & kalender (terdekat), prestasi & galeri (terbaru).
- Perubahan tampil paling lambat **±2 menit** karena cache. Ingin langsung? Lihat [bagian 6.11](#611-membuat-perubahan-langsung-tampil).

---

## 5. Tutorial penggunaan untuk pengunjung

### 5.1 Membuka website

- Buka URL web app hasil deploy (contoh: `https://script.google.com/macros/s/AKfycb.../exec`).
- Website bisa dibuka tanpa login jika deployment disetel **Anyone**.
- Tampilan otomatis menyesuaikan layar HP, tablet, dan komputer.

### 5.2 Menavigasi halaman

Gunakan menu di bawah header: **Beranda, Profil, Pengumuman, Agenda, Kalender, Prestasi, Galeri, PPDB, Kontak**.

- Di komputer, semua menu tampil mendatar.
- Di HP, menu disembunyikan di balik tombol **garis tiga** di kanan atas. Ketuk untuk membuka, ketuk salah satu menu untuk menuju section terkait.

### 5.3 Mencari informasi

1. Ketuk/klik kolom **"Cari pengumuman, agenda, prestasi..."** di header.
2. Ketik minimal **2 huruf** (contoh: `ppdb`, `pramuka`, `juara`).
3. Daftar hasil muncul lengkap dengan kategorinya.
4. Klik salah satu hasil → halaman otomatis bergulir ke bagian yang dimaksud dan kartunya diberi sorotan.

### 5.4 Membaca pengumuman

- Kartu bertanda **Penting** berada di urutan teratas.
- Klik **"Baca selengkapnya"** untuk membuka isi lengkap.
- Tanggal dan kategori tampil di bagian atas kartu.

### 5.5 Melihat agenda dan kalender

- **Agenda** menampilkan kegiatan dalam bentuk timeline. Kegiatan yang sudah lewat diberi label **Selesai**.
- **Kalender** menampilkan daftar tanggal penting. Badge hijau = **Kegiatan**, badge merah = **Libur**.

### 5.6 Melihat prestasi dan galeri

- **Prestasi**: kartu menampilkan nama siswa, kelas, lomba, tingkat, dan juara.
- **Galeri**: gunakan tombol kategori (Semua, Kegiatan Belajar, Prestasi, Ekstrakurikuler, dst.) untuk memfilter. Klik kartu untuk membuka foto/video pada lightbox.
- Jika media belum diisi, lightbox menampilkan keterangan bahwa dokumentasi masih contoh.

### 5.7 Melihat informasi PPDB

Section **PPDB** memuat status penerimaan, tahun ajaran, periode, kuota, biaya, kontak panitia, daftar persyaratan, dan alur pendaftaran. Status **Dibuka** ditampilkan dengan badge khusus.

### 5.8 Menghubungi sekolah

- Klik **Lihat Lokasi di Google Maps** untuk membuka peta.
- Klik **WhatsApp Sekolah** untuk chat langsung (jika nomor diisi).
- Isi formulir kontak:

| Kolom | Aturan |
|-------|--------|
| Nama | minimal 3 karakter |
| Email | format email valid, wajib |
| Telepon | opsional |
| Subjek | opsional |
| Pesan | minimal 10 karakter |

Klik **Kirim Pesan**. Jika berhasil, muncul notifikasi dan formulir dikosongkan. Pesan tersimpan di sheet `Pesan` dan bisa dibaca admin.

---

## 6. Tutorial mengelola konten (admin)

Bagian ini untuk operator sekolah/guru yang akan memperbarui isi website. **Tidak perlu coding**, cukup edit spreadsheet.

### 6.1 Membuka database

1. Buka editor Apps Script project website.
2. Pilih fungsi **`showDatabaseUrl`** → **Run**.
3. Buka **Execution log** → klik URL spreadsheet yang muncul.
4. Simpan URL tersebut sebagai bookmark, misal folder Drive `Website Sekolah`.

### 6.2 Mengganti profil dan kontak

Buka sheet **`Profil`**. Isinya dua kolom: `kunci` dan `nilai`. Edit kolom `nilai` saja.

| Kunci | Contoh isi | Muncul di |
|-------|------------|-----------|
| `nama_sekolah` | SD Negeri Semanu III | Header, hero, footer, judul tab |
| `npsn` | 2040xxxx | — (dicadangkan) |
| `akreditasi` | B | Chip di hero |
| `alamat` | Munggi Pasar, Semanu, ... | Hero, kontak, footer |
| `telepon` | (0274) 000000 | Hero, kontak |
| `whatsapp` | 6281234567890 | Tombol WhatsApp |
| `email` | info@sekolah.sch.id | Hero, kontak |
| `jam_layanan` | Senin - Jumat, 07.00 - 14.00 WIB | Hero, kontak |
| `kepala_sekolah` | Nama Kepala Sekolah | Tanda tangan sambutan, kontak |
| `tahun_ajaran` | 2026/2027 | Chip di hero |
| `jumlah_siswa` | 186 | Chip di hero |
| `maps_url` | tautan Google Maps sekolah | Tombol lokasi |
| `tagline` | Belajar dengan gembira... | Hero |
| `sambutan` | teks sambutan | Section Profil |
| `visi` | teks visi | Section Profil |
| `misi` | daftar misi | Section Profil |

Tips:

- **Sambutan**: pisahkan paragraf dengan **satu baris kosong**.
- **Misi**: tulis satu poin per baris. Nomor otomatis ditampilkan, jadi tidak perlu menulis "1.", "2.".
- **WhatsApp**: tulis nomor format internasional tanpa `+`, misal `6281234567890`. Nomor `0812...` juga otomatis diubah.
- **Maps**: buka lokasi di Google Maps → **Share/Bagikan** → **Copy link** → tempel di `maps_url`.

### 6.3 Menambah pengumuman

Sheet **`Pengumuman`**, kolom: `id, tanggal, judul, kategori, ringkasan, isi, penting`.

Contoh baris:

| id | tanggal | judul | kategori | ringkasan | isi | penting |
|----|---------|-------|----------|-----------|-----|---------|
| P-006 | 2026-11-10 | Libur Hari Pahlawan | Pengumuman | Sekolah libur pada 10 November 2026. | Kegiatan belajar diliburkan... | Ya |

- `ringkasan` tampil di kartu; `isi` muncul saat "Baca selengkapnya".
- Isi `penting` dengan **Ya** untuk menyematkan di urutan teratas. Selain "Ya" dianggap tidak penting.
- `kategori` bebas (Akademik, Kesiswaan, PPDB, Kegiatan, dst.) dan tampil sebagai badge.

### 6.4 Menambah agenda kegiatan

Sheet **`Agenda`**, kolom: `id, tanggal_mulai, tanggal_selesai, judul, kategori, lokasi, deskripsi`.

- Untuk kegiatan sehari, isi `tanggal_selesai` sama dengan `tanggal_mulai`.
- Kegiatan dengan tanggal lebih lama otomatis diberi label **Selesai**.
- Agenda diurutkan dari tanggal terdekat.

### 6.5 Menambah kalender pendidikan / hari libur

Sheet **`Kalender`**, kolom: `id, tanggal, judul, jenis, keterangan`.

- `jenis` hanya dua pilihan: **Kegiatan** atau **Libur** (badge hijau/merah).
- `keterangan` bisa berisi rentang tanggal, misal `21 Desember 2026 - 2 Januari 2027`.

### 6.6 Menambah prestasi siswa

Sheet **`Prestasi`**, kolom: `id, tanggal, nama, kelas, lomba, tingkat, juara, deskripsi`.

- `juara` ditulis bebas: `Juara 1`, `Juara Harapan 2`, dst. Teks ini tampil pada kotak kiri kartu.
- `tingkat` contoh: Sekolah, Kecamatan, Kabupaten, Provinsi, Nasional.
- Jika satu tim, isi `nama` dengan nama tim atau daftar anggota.

### 6.7 Mengelola guru, fasilitas, dan program

| Sheet | Kolom | Keterangan |
|-------|-------|------------|
| `Guru` | id, nama, nip, jabatan, mapel | Tampil sebagai tabel; `nip` boleh dikosongkan |
| `Fasilitas` | id, nama, deskripsi | Tampil sebagai kartu bernomor otomatis |
| `Program` | id, nama, deskripsi | Tampil sebagai kartu bernomor otomatis |

Nomor urut kartu mengikuti urutan baris di sheet, jadi susun baris sesuai prioritas tampilan.

### 6.8 Mengisi foto/video galeri

Sheet **`Galeri`**, kolom: `id, tanggal, judul, kategori, tipe, media_url, deskripsi`.

Langkah mengisi foto dari Google Drive:

1. Upload foto ke Google Drive.
2. Klik kanan file → **Share/Bagikan** → **General access** → **Anyone with the link** (Viewer).
3. Copy link. Bentuknya: `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`
4. Ubah menjadi: `https://drive.google.com/uc?export=view&id=FILE_ID`
5. Tempel hasilnya di kolom `media_url`, isi `tipe` dengan **Foto**.
6. Simpan, lalu jalankan `refreshCache` (lihat 6.11).

Untuk video YouTube:

- Tempel link biasa, misal `https://www.youtube.com/watch?v=VIDEO_ID`.
- Isi `tipe` dengan **Video**; website otomatis menampilkan player YouTube.
- Link video non-YouTube tetap bisa dipakai, tetapi hanya muncul sebagai tautan.

Catatan: `media_url` boleh dikosongkan. Kartu galeri tetap tampil dengan placeholder warna dan inisial kategori.

### 6.9 Memperbarui informasi PPDB

Sheet **`PPDB`** (key-value), kunci yang tersedia:

| Kunci | Contoh isi |
|-------|-----------|
| `tahun_ajaran` | 2027/2028 |
| `status` | Dibuka |
| `periode` | 1 - 30 April 2027 |
| `kuota` | 28 siswa |
| `persyaratan` | satu syarat per baris |
| `alur` | satu langkah per baris |
| `biaya` | Tidak dipungut biaya |
| `kontak` | Panitia PPDB - (0274) 000000 |
| `catatan` | catatan tambahan |

- Tulis `status` **Dibuka** saat penerimaan berlangsung, **Ditutup** setelah selesai; badge di halaman ikut berubah.
- Persyaratan dan alur otomatis menjadi daftar bernomor; tidak perlu menulis angka sendiri.

### 6.10 Membaca pesan dari formulir kontak

Buka sheet **`Pesan`**. Setiap kiriman berisi: timestamp, nama, email, telepon, subjek, pesan, status.

- Status awal **Baru**. Setelah dibalas, ubah menjadi **Sudah dibalas** sebagai penanda internal.
- Balasan dilakukan manual lewat email yang dicantumkan pengirim (email otomatis tidak diaktifkan).
- Ada batas 3 pesan per jam untuk alamat email yang sama.

### 6.11 Membuat perubahan langsung tampil

Data di-cache 120 detik. Supaya perubahan langsung terlihat:

1. Di editor Apps Script, pilih fungsi **`refreshCache`** → **Run**.
2. Muat ulang halaman web app (Ctrl+F5 / tarik ke bawah pada HP).

Tidak perlu deploy ulang karena hanya data spreadsheet yang berubah.

---

## 7. Mengubah kode dan deploy ulang

Kalau mengubah `Code.gs`, `Index.html`, `Styles.html`, atau `JavaScript.html`:

1. Simpan file (Ctrl+S).
2. **Deploy** → **Manage deployments**.
3. Klik ikon pensil pada deployment aktif.
4. Pada **Version**, pilih **New version**.
5. Klik **Deploy**. URL web app tetap sama.

Cara cepat untuk uji coba: **Deploy** → **Test deployments** → buka URL `/dev`.

---

## 8. Catatan teknis

- Runtime Apps Script dibatasi ±6 menit per eksekusi; project ini ringan karena membaca semua sheet sekaligus.
- Data di-cache 120 detik agar cepat dan hemat kuota.
- `doGet` memanggil `ensureDatabase_()`, jadi database tetap dibuat otomatis walau langkah `setupDatabase` terlewat.
- Formulir kontak: validasi di client dan server, escaping sel untuk mencegah formula injection,
  serta pembatasan 3 kiriman per jam per alamat email.
- Email notifikasi otomatis tidak diaktifkan agar tidak memakai kuota Gmail; cek sheet `Pesan` secara berkala.
- URL spreadsheet tidak dikirim ke browser pengunjung; admin melihatnya lewat `showDatabaseUrl()`.

---

## 9. Troubleshooting

| Gejala | Penyebab & solusi |
|--------|-------------------|
| "Data gagal dimuat" | Belum authorize / database belum ada. Jalankan `setupDatabase` di editor, lalu reload. |
| Perubahan sheet tidak muncul | Cache 120 detik. Jalankan `refreshCache`, lalu reload. |
| Gambar galeri kosong | `media_url` salah, file Drive tidak publik, atau ID file keliru. |
| Ikon galeri hanya warna | `media_url` memang belum diisi; isi tautan agar foto tampil. |
| Menu tidak muncul di HP | Pastikan file `Styles.html` terpasang dan nama file include benar. |
| Web app minta login | Ubah deployment access ke **Anyone**, lalu buat deployment baru. |
| Perubahan kode tidak terlihat | Deploy ulang dengan **New version**. |
| Pesan tidak terkirim | Cek validasi: nama ≥3 karakter, email valid, pesan ≥10 karakter, maksimal 3 pesan/jam. |

---

## 10. Checklist demo/presentasi

1. Buka URL web app di jendela **incognito** untuk membuktikan bisa diakses tanpa login.
2. Tunjukkan 8 bagian sesuai requirement: Pengumuman, Profil, Agenda, Kalender, Prestasi, Galeri, PPDB, Kontak.
3. Coba pencarian dengan kata `ppdb` dan `pramuka`.
4. Filter galeri ke kategori **Prestasi**, lalu buka salah satu kartu.
5. Kirim satu pesan lewat formulir, lalu buka sheet `Pesan` untuk menunjukkan data masuk.
6. Tampilkan tampilan HP (DevTools → mode responsif 390 px).
7. Tunjukkan spreadsheet database dan struktur sheet sebagai bukti "database".
8. Tutup dengan disclaimer: semua data masih **data contoh** untuk keperluan tugas.
