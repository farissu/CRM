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

## Langkah 2: Clone Project & Konfigurasi File `.env`

1. Clone repository kode Anda ke VPS (misalnya di folder `/var/www/whatsapp-crm`):
   ```bash
   git clone <URL_REPOSITORY_KAMU> /var/www/whatsapp-crm
   cd /var/www/whatsapp-crm
   ```

2. Buat file `.env` untuk production:
   ```bash
   nano .env
   ```

3. Copy dan sesuaikan isi `.env` di bawah ini (ganti domain, password, dan token Anda):

   ```env
   # JWT Secret (Gunakan random string panjang demi keamanan)
   JWT_SECRET=GANTI_DENGAN_RANDOM_STRING_YANG_SANGAT_PANJANG_DAN_AMAN
   
   # Konfigurasi Database PostgreSQL
   DB_USER=postgres
   DB_PASSWORD=PasswordDatabaseYangSangatKuat123!
   DB_NAME=whatsapp_crm
   
   # URL Frontend & Backend untuk CORS dan Client-side Next.js
   # Ubah crm.domainkamu.com dengan domain/subdomain riil Anda
   FRONTEND_URL=https://crm.domainkamu.com
   NEXT_PUBLIC_API_URL=https://crm.domainkamu.com
   NEXT_PUBLIC_WS_URL=wss://crm.domainkamu.com
   
   # Token Integrasi WhatsApp (Wappin / Meta API)
   WHATSAPP_PHONE_NUMBER_ID=1747983816359565
   WHATSAPP_ACCESS_TOKEN=EAAOoZAFqNT0AB... # Token panjang Meta Anda
   WHATSAPP_WEBHOOK_VERIFY_TOKEN=tes_verify_token_kamu

   # App ID & App Secret dari Meta App Dashboard → Settings → Basic
   # WAJIB diisi — dipakai untuk verifikasi signature (X-Hub-Signature-256) di setiap
   # webhook yang masuk. Tanpa ini, endpoint webhook menerima payload apapun tanpa
   # memastikan itu benar-benar dari Meta.
   WHATSAPP_APP_ID=your-meta-app-id
   WHATSAPP_APP_SECRET=your-meta-app-secret
   ```

---

## Langkah 3: Build & Jalankan Docker Container

Jalankan Docker Compose untuk mendownload base image, membuild backend & frontend Next.js untuk production mode, dan menjalankan container secara background (`-d`):

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Inisialisasi Database (Prisma Migration & Seed)
Setelah container menyala, jalankan perintah berikut untuk membuat tabel database PostgreSQL, melakukan generate Prisma client, dan memasukkan data default (seeding):

```bash
# Tunggu beberapa detik agar PostgreSQL siap menerima koneksi, lalu jalankan:

# 1. Jalankan migrasi schema database
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# 2. Seed database untuk admin default
docker compose -f docker-compose.prod.yml exec backend npm run seed
```

*Akun setelah seeding:*
- **Email Super Admin**: `admin@waku.com`
- **Password**: dibuat acak dan **hanya ditampilkan sekali** di output terminal saat `npm run seed` dijalankan pertama kali — catat dari sana. Akun ini **wajib ganti password** di login pertama sebelum bisa mengakses aplikasi.

---

## Langkah 4: Konfigurasi Nginx Reverse Proxy & SSL (HTTPS)

Kita akan menggunakan Nginx di VPS untuk menangani koneksi SSL (HTTPS) dan mengarahkan trafik dari browser/WhatsApp ke container Docker yang berjalan di background.

1. Buat file konfigurasi Nginx baru:
   ```bash
   sudo nano /etc/nginx/sites-available/whatsapp-crm
   ```

2. Paste konfigurasi Nginx berikut (Ganti `crm.domainkamu.com` dengan domain Anda):

   ```nginx
   server {
       listen 80;
       server_name crm.domainkamu.com;

       # Frontend Next.js (Port 3000)
       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       # Backend Express API (Port 3001)
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

       # WebSocket real-time (Port 3001)
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

3. Aktifkan konfigurasi Nginx dengan membuat symbolic link:
   ```bash
   sudo ln -s /etc/nginx/sites-available/whatsapp-crm /etc/nginx/sites-enabled/
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

Jalankan Certbot untuk mendapatkan SSL gratis dan mengonfigurasi auto-redirect dari HTTP ke HTTPS secara otomatis pada file konfigurasi Nginx:

```bash
sudo certbot --nginx -d crm.domainkamu.com
```

- Certbot akan menanyakan alamat email Anda (untuk notifikasi perpanjangan SSL).
- Setujui syarat dan ketentuan.
- Pilih opsi **Redirect** jika ditanya (mengarahkan semua trafik HTTP ke HTTPS otomatis).

Setelah selesai, Certbot akan secara otomatis mengedit konfigurasi Nginx Anda untuk menerapkan SSL.

---

## Langkah 6: Verifikasi Hasil Deployment

Buka browser Anda dan akses domain Anda:
- `https://crm.domainkamu.com` -> Harus memuat halaman login aplikasi WhatsApp CRM.
- Login menggunakan email `admin@waku.com` dan password acak yang dicatat dari output seed (lihat Langkah 3) — Anda akan langsung diminta membuat password baru saat login pertama.
- Buka Inspect Element (F12) -> Console, dan pastikan tidak ada error koneksi WebSocket (koneksi websocket harus sukses terhubung ke `wss://crm.domainkamu.com`).

---

## Lampiran: Cara Update Kode di Masa Mendatang

Jika Anda melakukan perubahan kode di local computer dan ingin memposting perubahan tersebut ke VPS:

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
4. Rebuild container tanpa merusak data database:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
5. Jalankan migrasi database jika ada perubahan schema Prisma:
   ```bash
   docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
   ```
6. Aplikasi Anda selesai diperbarui secara aman!
