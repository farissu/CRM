# Deploy & Update — Klien SH (waku.sharinghappiness.org)

Catatan deployment spesifik untuk klien **SH** (Sharing Happiness / Waku Digital).
Untuk proses deploy klien baru dari nol, lihat `DEPLOYMENT_GUIDE.md` di root repo.

## Info Server

| Item | Nilai |
|---|---|
| Server | `admin@43.133.131.232` |
| OS | Ubuntu 24.04 LTS |
| Domain | https://waku.sharinghappiness.org |
| Path project | `/var/www/waku` |
| Docker Compose project name | `sh` (huruf kecil — Compose tidak menerima nama project berhuruf besar) |
| Env file | `clients/SH.env` (tidak ikut ke git, ada di server saja) |
| Port DB / Redis / Backend / Frontend | `32556` / `22499` / `30934` / `30836` (lihat `clients/SH.env`) |
| Nginx config | `/etc/nginx/sites-available/waku-sharinghappiness` |
| SSL | Let's Encrypt via Certbot, auto-renew, expire pertama `2026-11-03` |
| Git remote di server | pakai alias `github.com-crm` (deploy key khusus server ini, read-only, terdaftar di GitHub repo farissu/CRM → Settings → Deploy keys) |

## Update Kode ke Server (rutin, setiap ada perubahan)

1. Push perubahan ke branch `main` di GitHub seperti biasa dari local.
2. SSH ke server:
   ```bash
   ssh admin@43.133.131.232
   cd /var/www/waku
   ```
3. Tarik kode terbaru:
   ```bash
   git pull origin main
   ```
4. Rebuild & restart container (data database & redis aman, volume terpisah per klien):
   ```bash
   ./scripts/compose.sh sh clients/SH.env up -d --build
   ```
5. **Kalau ada perubahan schema Prisma**, jalankan migrasi:
   ```bash
   ./scripts/compose.sh sh clients/SH.env exec backend npx prisma migrate deploy
   ```
6. Cek container sehat:
   ```bash
   docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
   ```
7. Verifikasi dari luar:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://waku.sharinghappiness.org/
   ```
   Harus `200`.

## Perintah Umum Lainnya

```bash
# Lihat log realtime
./scripts/compose.sh sh clients/SH.env logs -f backend
./scripts/compose.sh sh clients/SH.env logs -f frontend

# Restart tanpa rebuild
./scripts/compose.sh sh clients/SH.env restart

# Matikan semua container klien ini
./scripts/compose.sh sh clients/SH.env down

# Masuk shell container backend (debug)
./scripts/compose.sh sh clients/SH.env exec backend sh
```

## Nginx & SSL

- Config Nginx ada di `/etc/nginx/sites-available/waku-sharinghappiness`, proxy ke
  `127.0.0.1:30836` (frontend), `127.0.0.1:30934` (backend + `/socket.io/`).
- Setelah edit config Nginx manapun:
  ```bash
  sudo nginx -t && sudo systemctl restart nginx
  ```
- Sertifikat SSL auto-renew lewat systemd timer certbot. Cek manual:
  ```bash
  sudo certbot renew --dry-run
  ```

## Troubleshooting Cepat

- **Container tidak mau start**: cek `docker logs sh-backend-1` / `sh-frontend-1`.
- **502 Bad Gateway**: pastikan container backend/frontend `Up` (`docker ps`), dan port di
  `clients/SH.env` cocok dengan port di config Nginx.
- **Perubahan `clients/SH.env` tidak kepakai**: harus `up -d --build` ulang (compose baca env file
  saat container dibuat, bukan realtime).
- **Lupa password sudo `admin`**: semua langkah di atas (update kode, restart docker) TIDAK perlu
  sudo karena user `admin` sudah masuk grup `docker`. Sudo cuma dibutuhkan untuk ubah config Nginx
  atau jalankan certbot.

## Kredensial Login Aplikasi

Akun awal (super admin & agent) dibuat sekali saat `npm run seed` pertama kali dijalankan — password
sementara hanya muncul sekali di output terminal saat itu dan **wajib diganti** di aplikasi setelah
login pertama. Kalau lupa dan butuh reset, jalankan ulang seed (hanya aman kalau belum ada data
production penting, karena seed bisa membuat ulang akun default) atau reset password lewat fitur
di aplikasi.
