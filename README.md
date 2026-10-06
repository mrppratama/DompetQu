# DompetQu 👛

> **Personal Finance Management Progressive Web App (PWA)**  
> *Simple, Calm, Fast, Practical.*

DompetQu adalah aplikasi manajemen keuangan pribadi berbasis **Progressive Web App (PWA)** yang mengusung konsep **Pundi-Pundi** (*envelope budgeting*). Dirancang dengan tema *Calm Dark Finance*, DompetQu memberikan pengalaman finansial yang tenang, aman, ringan, dan cepat tanpa framework berat atau visual yang berlebihan.

---

## 🌟 Fitur Utama

- **Pundi-Pundi (Envelope Budgeting):** Alokasi anggaran bulanan per pos kebutuhan (Makan, Transport, Tagihan, Tabungan, dll).
- **Saldo Non-Negatif:** Saldo setiap pundi terlindungi dari pengeluaran berlebih (*overdraft protection*).
- **Peringatan Budget Otomatis:**
  - `75%`: *Peringatan* — Penggunaan budget sudah mencapai 75%.
  - `90%`: *Kritis* — Budget hampir habis.
  - `100%+`: *Batas Terlampaui* — Pengeluaran mencapai limit.
- **Transaksi Konsisten:** Mendukung `INCOME`, `EXPENSE`, dan `TRANSFER` antar pundi dengan Firestore Atomic Transactions.
- **Dashboard Ringkas:** Total saldo akumulasi, pemasukan & pengeluaran bulanan, grafik donat persentase, dan 5 riwayat transaksi terakhir.
- **Target Keuangan (Goals):** Catat target tabungan (DP Rumah, Kendaraan, Liburan) dengan visualisasi progres.
- **Laporan Finansial:** Ringkasan periode (Bulan Ini, Bulan Lalu, 7 Hari, Hari Ini) dengan fitur **Salin Laporan** teks siap kirim.
- **PWA Siap Pasang:** Mendukung instalasi di Android & iOS sebagai standalone app dengan dukungan offline service worker.
- **Isolasi Data Firestore:** Keamanan per-UID dengan aturan Cloud Firestore ketat.

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3 (Vanilla Dark Mode), Vanilla JavaScript (ES6+ Modules)
- **Backend & Database:** Firebase Authentication, Cloud Firestore
- **Hosting:** Firebase Hosting
- **Grafik & Ikon:** Chart.js, Lucide Icons
- **PWA:** Web App Manifest & Service Worker

---

## 📂 Struktur Project

```text
DompetQu/
├── index.html              # Main SPA view
├── login.html              # Autentikasi masuk
├── register.html           # Pendaftaran akun & onboarding
├── forgot-password.html    # Pemulihan kata sandi
├── 404.html                # Halaman not found
│
├── manifest.webmanifest    # PWA Web App Manifest
├── sw.js                   # PWA Service Worker
│
├── firebase.json           # Firebase Hosting & Firestore config
├── firestore.rules         # Security Rules per-UID
├── firestore.indexes.json  # Query composite indexes
│
├── css/
│   ├── variables.css       # Design tokens & color palette
│   ├── style.css           # Layout shell & desktop/mobile structure
│   ├── components.css      # Reusable UI components & modals
│   └── responsive.css      # Responsive breakpoints
│
├── js/
│   ├── firebase-config.js  # Firebase SDK initialization
│   ├── auth.js             # Auth service & route guards
│   ├── app.js              # SPA controller & modal handlers
│   ├── dashboard.js        # Data aggregator & dashboard view
│   ├── pundi.js            # Pundi envelope budgeting service
│   ├── transaction.js      # Atomic transaction manager
│   ├── category.js         # Income & Expense categories
│   ├── goals.js            # Target tabungan service
│   ├── reports.js          # Financial reports & plain text builder
│   ├── settings.js         # Preferensi widget & profil
│   ├── charts.js           # Chart.js integration
│   ├── notifications.js    # Budget alerts, toast & network listener
│   ├── validation.js       # Form validation logic
│   └── utils.js            # Currency (IDR), Date, & Debounce
│
└── assets/
    ├── icons/              # Vector PWA icons
    └── favicon/            # Favicon SVG
```

---

## 🚀 Panduan Menjalankan & Deployment

### 1. Menjalankan Secara Lokal

Karena DompetQu menggunakan ES Modules murni, jalankan menggunakan local server statis apa saja (misalnya Node `npx serve`, VS Code Live Server, atau Python):

```bash
# Menggunakan npx serve
npx serve .

# Atau menggunakan Python 3
python -m http.server 8080
```

Buka `http://localhost:8080` atau `http://localhost:3000` di browser Anda.

### 2. Konfigurasi Firebase

1. Buka [Firebase Console](https://console.firebase.google.com) dan buat project baru.
2. Aktifkan **Authentication** (Metode Email/Password).
3. Buat database **Cloud Firestore** dalam production mode.
4. Salin konfigurasi web app Anda dan masukkan ke file [js/firebase-config.js](file:///c:/Users/ASUS/pratama/DompetQu/js/firebase-config.js).

### 3. Deploy ke Firebase Hosting

```bash
# Login ke Firebase CLI jika belum
firebase login

# Inisialisasi atau deploy langsung
firebase deploy
```

---

## 📄 Lisensi

MIT License © 2026 DompetQu
