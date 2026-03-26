#!/usr/bin/env bash
# Deploy to Cloudflare Pages production
# Usage: ./scripts/deploy-production.sh
# Requires: wrangler CLI authenticated with Cloudflare
set -euo pipefail

echo "=== Production Deploy ==="
echo "Target: https://hear.tasteful.work"

# Safety gate
read -p "Deploy to PRODUCTION? (y/N) " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

# Pre-flight checks
echo "Running tests..."
npm test
echo "✅ Tests passed"

echo "Building (no BASE_PATH for production)..."
npm run build
echo "✅ Build complete"

echo "Deploying to Cloudflare Pages..."
npx wrangler pages deploy build --project-name ear-trainer
echo "✅ Deployed to production"
echo ""
echo "Live at: https://hear.tasteful.work"
