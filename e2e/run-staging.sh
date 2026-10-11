#!/usr/bin/env bash
# E2E Test Runner against a deployed Staging environment (Vercel / preview / remote server).
# Does NOT start local PGlite, PostgREST, or local Next dev server.
#
# Usage:
#   STAGING_URL=https://ujiksr-staging.vercel.app ADMIN_PASSWORD=supersecret bash e2e/run-staging.sh
#   or:
#   E2E_BASE_URL=https://ujiksr-staging.vercel.app ADMIN_PASSWORD=supersecret bun run e2e:staging

set -euo pipefail

export PATH="$HOME/.bun/bin:$PATH"


TARGET_URL="${STAGING_URL:-${E2E_BASE_URL:-}}"
ADMIN_PASS="${ADMIN_PASSWORD:-}"

if [ -z "$TARGET_URL" ]; then
  echo "❌ Error: Harap tentukan URL staging via environment variable STAGING_URL atau E2E_BASE_URL"
  echo "Contoh:"
  echo "  STAGING_URL=https://ujiksr-staging.vercel.app ADMIN_PASSWORD=rahasia bun run e2e:staging"
  exit 1
fi

if [ -z "$ADMIN_PASS" ]; then
  echo "⚠️ Warning: ADMIN_PASSWORD tidak diisi, menggunakan default fallback ('rahasia-e2e')."
fi

# Pastikan URL tidak diakhiri trailing slash
TARGET_URL="${TARGET_URL%/}"

echo "🚀 Memulai E2E Test terhadap environment Staging:"
echo "   Target URL : $TARGET_URL"

# Cek ketersediaan URL target
if ! curl -sf -o /dev/null -m 10 "$TARGET_URL/"; then
  echo "❌ Error: Target URL $TARGET_URL tidak dapat diakses atau timeout."
  exit 1
fi
echo "   Konektivitas ke $TARGET_URL: OK"

# Cek ketersediaan browser Chromium
if [ -z "${CHROMIUM_PATH:-}" ]; then
  for p in /usr/bin/chromium /usr/bin/chromium-browser /usr/bin/google-chrome; do
    if [ -x "$p" ]; then
      export CHROMIUM_PATH="$p"
      break
    fi
  done
fi

if [ -n "${CHROMIUM_PATH:-}" ]; then
  echo "   Chromium binary: $CHROMIUM_PATH"
else
  echo "   Chromium binary: Menggunakan Playwright default"
fi

cd "$(dirname "$0")"

E2E_BASE_URL="$TARGET_URL" ADMIN_PASSWORD="${ADMIN_PASS:-rahasia-e2e}" bun "${1:-e2e.ts}"
