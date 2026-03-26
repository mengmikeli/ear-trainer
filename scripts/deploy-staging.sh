#!/usr/bin/env bash
# Deploy to GitHub Pages staging
# Usage: ./scripts/deploy-staging.sh
set -euo pipefail

echo "=== Staging Deploy ==="
echo "Target: https://mengmikeli.github.io/ear-trainer/"

# Pre-flight checks
echo "Running tests..."
npm test
echo "✅ Tests passed"

echo "Building with BASE_PATH=/ear-trainer..."
BASE_PATH=/ear-trainer npm run build
echo "✅ Build complete"

echo "Deploying to gh-pages..."
npx gh-pages -d build
echo "✅ Deployed to staging"
echo ""
echo "Live at: https://mengmikeli.github.io/ear-trainer/"
