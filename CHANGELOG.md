# Changelog DompetQu

Semua perubahan dan pembaruan penting pada aplikasi DompetQu (Personal Finance PWA) didokumentasikan dalam dokumen ini.

Format pencatatan merujuk pada standar [Keep a Changelog](https://keepachangelog.com/id/1.0.0/).

---

## [1.3.0] - 2026-10-07

### Fitur Baru & Peningkatan (Added & Improved)
- **Format Pemisah Ribuan Otomatis (Live Thousands Separator `.`)**:
  - Kolom input nominal transaksi, anggaran pundi, dan target otomatis diformat dengan tanda titik ribuan secara *real-time* saat mengetik (contoh: `1.000`, `20.000`, `2.000.000`).
  - Penanganan tombol *Backspace* cerdas dan pelacakan kursor dinamis tanpa melompat ke akhir karakter.
  - Form modal edit terisi rapi dengan format pemisah ribuan.
  - Parsing numerik otomatis membersihkan titik separator sebelum dikirim ke database Firestore.
- **Tata Letak Navigasi Mobile Baru (5-Slot Mobile Bottom Bar)**:
  - Tombol **Tambah Transaksi (`+`)** diposisikan di tengah bottom navigation dengan gaya *elevated FAB*.
  - Tab **Target Keuangan** dipindahkan ke slot 2 tepat di sebelah Dashboard.
  - Susunan bottom bar: `Dashboard` &bull; `Target` &bull; `(+) Tambah` &bull; `Transaksi` &bull; `Laporan`.
  - Tombol *floating action button* melayang yang menumpuk di pojok bawah telah dibersihkan.
- **Menu Pundi-Pundi di Profil Modal**:
  - Menu kelola Pundi dipindahkan ke dalam modal Profil (ikon avatar kanan atas) untuk menjaga kerapian mobile bar.
  - Tampilan Pundi dilengkapi tombol kembali (**&larr;**) instan ke Dashboard.
- **Dashboard Mobile Hero Card & Shortcut Cepat**:
  - Kartu hero fintech modern dengan indikator denyut aktif (*live pulse*) dan 3 kartu metrik ringkas: **Pemasukan**, **Pengeluaran**, dan **Saldo Bersih**.
  - 3 tombol aksi cepat di bawah saldo: **Pemasukan**, **Pengeluaran**, dan **Transfer** dengan pemilihan tipe transaksi otomatis.

---

## [1.2.0] - 2026-10-06

### Fitur Baru & UI Kustom
- **Komponen Custom Dropdown UI**:
  - Menggantikan elemen `<select>` bawaan browser dengan custom select dialog bertema Calm Dark Finance.
  - Aksesibilitas keyboard dan navigasi ramah sentuhan layar sentuh mobile.
- **Menu Profil Terpadu**:
  - Ikon avatar profil di pojok kanan atas menggantikan tombol plus lama.
  - Membuka modal ringkas berisi: Kelola Kategori, Pengaturan Aplikasi, Instalasi PWA, Versi & Riwayat Pembaruan, serta Logout.
- **Palet Warna Emerald Vibrant**:
  - Pembaruan aksen hijau utama ke emerald segar (`#10B981`) dengan kontras tinggi dan kenyamanan visual di mode gelap.
- **Validasi Saldo & Peringatan Budget**:
  - Deteksi real-time saldo pundi sumber saat memilih nominal pengeluaran/transfer dengan peringatan jika saldo tidak mencukupi.

---

## [1.1.0] - 2026-10-05

### Fitur Cloud & Laporan
- **Sinkronisasi Cloud Firebase**:
  - Firebase Authentication (Email & Password) dan Cloud Firestore database.
  - Aturan keamanan data per pengguna (`firestore.rules`).
- **Sistem Multi-Pundi (Envelope Budgeting)**:
  - Pemisahan keuangan ke amplop-amplop anggaran mandiri (Kebutuhan Pokok, Tabungan, Hiburan, dll.).
  - Peringatan batas pemakaian anggaran (75%, 90%, 100%).
- **Grafik Interaktif & Ekspor Ringkasan**:
  - Visualisasi grafik donat Chart.js untuk alokasi pengeluaran bulanan.
  - Ekspor dan salin format teks ringkasan keuangan ke clipboard.

---

## [1.0.0] - 2026-10-04

### Rilis Perdana
- Rilis perdana Progressive Web App (PWA) DompetQu.
- Dukungan instalasi perangkat (PWA Standalone) dan Service Worker cache offline.
- Tema Calm Dark Finance modern berbasis CSS Variables tanpa framework eksternal.
- Pelacak Target Keuangan dan pencatatan transaksi harian.
