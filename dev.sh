#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

cleanup() {
  echo -e "\n${YELLOW}Menghentikan semua service...${NC}"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  echo -e "${GREEN}Semua service sudah dihentikan.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# Check .env
if [ ! -f "$BACKEND_DIR/.env" ]; then
  echo -e "${RED}ERROR: File backend/.env tidak ditemukan!${NC}"
  echo -e "Buat file ${BOLD}backend/.env${NC} terlebih dahulu. Contoh:"
  echo ""
  echo "  DATABASE_URL=\"postgresql://postgres:password@localhost:5432/whatsapp_crm\""
  echo "  PORT=3001"
  echo "  NODE_ENV=development"
  echo "  FRONTEND_URL=http://localhost:3000"
  echo "  JWT_SECRET=rahasia_kamu_disini"
  echo "  REDIS_URL=redis://localhost:6379"
  echo "  WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id"
  echo "  WHATSAPP_ACCESS_TOKEN=your-access-token"
  echo "  WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-verify-token"
  exit 1
fi

echo -e "${BOLD}==============================${NC}"
echo -e "${BOLD}   WhatsApp CRM - Dev Mode${NC}"
echo -e "${BOLD}==============================${NC}"
echo ""

stream_backend() {
  while IFS= read -r line; do
    echo -e "${BLUE}[backend]${NC} $line"
  done
}

stream_frontend() {
  while IFS= read -r line; do
    echo -e "${GREEN}[frontend]${NC} $line"
  done
}

echo -e "${BLUE}Menjalankan Backend${NC} (port 5000)..."
(cd "$BACKEND_DIR" && npm run dev 2>&1) | stream_backend &
BACKEND_PID=$!

sleep 2

echo -e "${GREEN}Menjalankan Frontend${NC} (port 3000)..."
(cd "$FRONTEND_DIR" && npm run dev 2>&1) | stream_frontend &
FRONTEND_PID=$!

echo ""
echo -e "  ${BLUE}Backend :${NC}  http://localhost:5000"
echo -e "  ${GREEN}Frontend:${NC}  http://localhost:3000"
echo ""
echo -e "${YELLOW}Tekan Ctrl+C untuk menghentikan semua service.${NC}"
echo ""

wait -n "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null

echo -e "\n${RED}Salah satu service berhenti. Menghentikan semua...${NC}"
cleanup
