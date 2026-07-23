# Panduan Deploy WhatsApp CRM ke Server VPS (Ubuntu)

Dokumen ini menjelaskan langkah-langkah untuk mendeploy aplikasi WhatsApp CRM ke server VPS (Virtual Private Server) menggunakan **Docker Compose** dan **Nginx** sebagai reverse proxy + SSL gratis dari **Certbot (Let's Encrypt)**.

Menggunakan Docker Compose adalah cara terbaik karena mengisolasi database (PostgreSQL), cache (Redis), backend, dan frontend Next.js agar tidak mengalami konflik dependency di server.

---

## Prasyarat (Prerequisites)
1. **Server VPS**: Sistem operasi Ubuntu (disarankan Ubuntu 22.04 atau 24.04 LTS).
2. **Domain/Subdomain**: Satu domain atau subdomain yang diarahkan (A Record) ke IP VPS Anda (misalnya: `crm.domainkamu.com`). Ini sangat penting agar:
   - Webhook WhatsApp (Wappin/Meta) bisa mengirim pesan masuk ke VPS menggunakan HTTPS (wajib SSL).
   - WebSocket berjalan lancar tanpa hambatan mixed content (HTTP vs HTTPS).

---

## Langkah 1: Persiapan VPS (Install Docker & Nginx)

Hubungkan ke VPS Anda melalui SSH:
```bash
ssh root@IP_VPS_ANDA
```

Jalankan perintah berikut untuk mengupdate server dan menginstal Docker, Docker Compose, Nginx, serta Certbot:

```bash
# Update package list & upgrade sistem
sudo apt update && sudo apt upgrade -y

# Install tools pendukung
sudo apt install -y curl git ufw

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose V2 (jika belum terinstall bawaan script docker)
sudo apt install -y docker-compose-v2

# Install Nginx & Certbot (untuk SSL gratis)
sudo apt install -y nginx certbot python3-certbot-nginx
```

Aktifkan firewall sederhana (UFW) untuk keamanan:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

---

## Langkah 2: Clone Project & Konfigurasi Env per Klien

Repo ini adalah monorepo multi-tenant: **setiap klien punya container backend, frontend, dan
database sendiri-sendiri** (terisolasi penuh), dijalankan dari kode yang sama lewat
`scripts/compose.sh`. Deployment tidak lagi pakai 1 `docker-compose.prod.yml` di root — sekarang
dipecah jadi `database/docker-compose.yml`, `backend/docker-compose.yml`, dan
`frontend/docker-compose.yml`, digabung otomatis oleh script tersebut.

1. Clone repository kode Anda ke VPS (misalnya di folder `/var/www/whatsapp-crm`):
   ```bash
   git clone <URL_REPOSITORY_KAMU> /var/www/whatsapp-crm
   cd /var/www/whatsapp-crm
   ```

2. Untuk setiap klien baru, copy template env dan beri nama sesuai klien:
   ```bash
   cp clients/client.env.example clients/nama-klien.env
   nano clients/nama-klien.env
   ```

3. Isi `clients/nama-klien.env` (ganti domain, password, port, dan token milik klien ini):

   ```env
   # JWT Secret (Gunakan random string panjang demi keamanan, beda per klien)
   JWT_SECRET=GANTI_DENGAN_RANDOM_STRING_YANG_SANGAT_PANJANG_DAN_AMAN

   # Konfigurasi Database PostgreSQL milik klien ini
   DB_USER=postgres
   DB_PASSWORD=PasswordDatabaseYangSangatKuat123!
   DB_NAME=whatsapp_crm_nama_klien

   # Port host — WAJIB unik per klien kalau berbagi 1 VPS dengan klien lain
   DB_PORT=5432
   REDIS_PORT=6379
   BACKEND_PORT=3001
   FRONTEND_PORT=3000

   # URL Frontend & Backend untuk CORS dan Client-side Next.js
   # Ubah nama-klien.domainkamu.com dengan domain/subdomain riil klien ini
   FRONTEND_URL=https://nama-klien.domainkamu.com
   NEXT_PUBLIC_API_URL=https://nama-klien.domainkamu.com
   NEXT_PUBLIC_WS_URL=wss://nama-klien.domainkamu.com

   # Token Integrasi WhatsApp (Meta Cloud API) milik klien ini
   WHATSAPP_PHONE_NUMBER_ID=1747983816359565
   WHATSAPP_ACCESS_TOKEN=EAAOoZAFqNT0AB... # Token panjang Meta klien ini
   WHATSAPP_BUSINESS_ACCOUNT_ID=your-waba-id
   WHATSAPP_WEBHOOK_VERIFY_TOKEN=tes_verify_token_kamu

   # App Secret dari Meta App Dashboard → Settings → Basic
   # WAJIB diisi — dipakai untuk verifikasi signature (X-Hub-Signature-256) di setiap
   # webhook yang masuk. Tanpa ini, endpoint webhook menerima payload apapun tanpa
   # memastikan itu benar-benar dari Meta.
   WHATSAPP_APP_SECRET=your-meta-app-secret
   ```

   File `clients/*.env` sudah masuk `.gitignore` (kecuali template-nya) — jangan pernah commit
   file env klien asli karena isinya secret.

---

## Langkah 3: Build & Jalankan Docker Container per Klien

Jalankan `scripts/compose.sh` dengan format `<nama-klien> <file-env> <perintah-docker-compose>`.
Nama klien dipakai sebagai nama project Docker Compose, jadi container/volume/network klien A
tidak akan pernah tabrakan dengan klien B walau host-nya sama:

```bash
chmod +x scripts/compose.sh   # sekali saja
./scripts/compose.sh nama-klien clients/nama-klien.env up -d --build
```

### Inisialisasi Database (Prisma Migration & Seed)
Setelah container menyala, jalankan perintah berikut untuk membuat tabel database PostgreSQL,
melakukan generate Prisma client, dan memasukkan data default (seeding) — khusus untuk klien ini:

```bash
# Tunggu beberapa detik agar PostgreSQL siap menerima koneksi, lalu jalankan:

# 1. Jalankan migrasi schema database
./scripts/compose.sh nama-klien clients/nama-klien.env exec backend npx prisma migrate deploy

# 2. Seed database untuk admin default
./scripts/compose.sh nama-klien clients/nama-klien.env exec backend npm run seed
```

*Akun setelah seeding:*
- **Email Super Admin**: `admin@waku.com`
- **Password**: dibuat acak dan **hanya ditampilkan sekali** di output terminal saat `npm run seed` dijalankan pertama kali — catat dari sana. Akun ini **wajib ganti password** di login pertama sebelum bisa mengakses aplikasi.

---

## Langkah 4: Konfigurasi Nginx Reverse Proxy & SSL (HTTPS)

Kita akan menggunakan Nginx di VPS untuk menangani koneksi SSL (HTTPS) dan mengarahkan trafik dari browser/WhatsApp ke container Docker yang berjalan di background.

Karena setiap klien punya `BACKEND_PORT`/`FRONTEND_PORT` sendiri (lihat `clients/nama-klien.env`),
**buat 1 file konfigurasi Nginx per klien**, dengan `server_name` dan port yang sesuai klien
tersebut.

1. Buat file konfigurasi Nginx baru (nama file mengikuti nama klien):
   ```bash
   sudo nano /etc/nginx/sites-available/whatsapp-crm-nama-klien
   ```

2. Paste konfigurasi Nginx berikut (ganti `nama-klien.domainkamu.com` dengan domain klien ini,
   dan `3000`/`3001` dengan `FRONTEND_PORT`/`BACKEND_PORT` yang diisi di `clients/nama-klien.env`):

   ```nginx
   server {
       listen 80;
       server_name nama-klien.domainkamu.com;

       # Frontend Next.js (ganti dengan FRONTEND_PORT klien ini)
       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       # Backend Express API (ganti dengan BACKEND_PORT klien ini)
       location /api {
           proxy_pass http://127.0.0.1:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }

       # WebSocket real-time (port sama dengan Backend di atas)
       location /socket.io/ {
           proxy_pass http://127.0.0.1:3001/socket.io/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "Upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_read_timeout 86400; # Agar koneksi socket tidak gampang timeout
       }
   }
   ```

3. Aktifkan konfigurasi Nginx dengan membuat symbolic link (ulangi Langkah 1-3 ini untuk setiap klien baru):
   ```bash
   sudo ln -s /etc/nginx/sites-available/whatsapp-crm-nama-klien /etc/nginx/sites-enabled/
   ```

4. Hapus konfigurasi default Nginx agar tidak konflik:
   ```bash
   sudo rm /etc/nginx/sites-enabled/default
   ```

5. Uji konfigurasi Nginx, lalu restart service:
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

---

## Langkah 5: Install SSL HTTPS Gratis dari Let's Encrypt

Jalankan Certbot untuk mendapatkan SSL gratis dan mengonfigurasi auto-redirect dari HTTP ke HTTPS secara otomatis pada file konfigurasi Nginx (ulangi untuk setiap domain klien):

```bash
sudo certbot --nginx -d nama-klien.domainkamu.com
```

- Certbot akan menanyakan alamat email Anda (untuk notifikasi perpanjangan SSL).
- Setujui syarat dan ketentuan.
- Pilih opsi **Redirect** jika ditanya (mengarahkan semua trafik HTTP ke HTTPS otomatis).

Setelah selesai, Certbot akan secara otomatis mengedit konfigurasi Nginx Anda untuk menerapkan SSL.

---

## Langkah 6: Verifikasi Hasil Deployment

Buka browser Anda dan akses domain klien tersebut:
- `https://nama-klien.domainkamu.com` -> Harus memuat halaman login aplikasi WhatsApp CRM.
- Login menggunakan email `admin@waku.com` dan password acak yang dicatat dari output seed (lihat Langkah 3) — Anda akan langsung diminta membuat password baru saat login pertama.
- Buka Inspect Element (F12) -> Console, dan pastikan tidak ada error koneksi WebSocket (koneksi websocket harus sukses terhubung ke `wss://nama-klien.domainkamu.com`).

---

## Lampiran A: Cara Update Kode di Masa Mendatang

Jika Anda melakukan perubahan kode di local computer dan ingin memposting perubahan tersebut ke VPS
untuk **semua klien** (kode monorepo-nya sama untuk semua):

1. Push perubahan Anda ke repository Git (GitHub/GitLab).
2. Hubungi VPS via SSH:
   ```bash
   ssh root@IP_VPS_ANDA
   cd /var/www/whatsapp-crm
   ```
3. Tarik kode terbaru:
   ```bash
   git pull origin main
   ```
4. Rebuild container tiap klien satu per satu (tanpa merusak data database, karena volume
   `postgres_data`/`redis_data` terpisah per nama project dan tidak ikut ke-rebuild):
   ```bash
   ./scripts/compose.sh nama-klien-1 clients/nama-klien-1.env up -d --build
   ./scripts/compose.sh nama-klien-2 clients/nama-klien-2.env up -d --build
   # ...ulangi untuk setiap klien yang aktif
   ```
5. Jalankan migrasi database tiap klien jika ada perubahan schema Prisma:
   ```bash
   ./scripts/compose.sh nama-klien-1 clients/nama-klien-1.env exec backend npx prisma migrate deploy
   ```
6. Aplikasi semua klien selesai diperbarui secara aman!

---

## Lampiran B: Onboarding Klien Baru

Karena setiap klien terisolasi penuh (kode sama, container & database beda), langkah daftar klien
baru cukup:

1. `cp clients/client.env.example clients/nama-klien-baru.env` lalu isi domain, password, port,
   dan token WhatsApp klien baru (pastikan port tidak bentrok dengan klien lain di VPS yang sama).
2. `./scripts/compose.sh nama-klien-baru clients/nama-klien-baru.env up -d --build`
3. `./scripts/compose.sh nama-klien-baru clients/nama-klien-baru.env exec backend npx prisma migrate deploy`
4. `./scripts/compose.sh nama-klien-baru clients/nama-klien-baru.env exec backend npm run seed`
5. Buat konfigurasi Nginx + SSL baru untuk domain klien ini (lihat Langkah 4 & 5 di atas).
