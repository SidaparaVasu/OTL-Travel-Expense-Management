#!/bin/bash

# Configuration
DOMAIN="travel.orangebiznext.com"
EMAIL="admin@orangebiznext.com" # Replace with actual admin email
DRY_RUN=1

echo "🛡️ Starting SSL Setup for $DOMAIN..."

if [ "$DRY_RUN" -eq 1 ]; then
    echo "🧪 Running in DRY-RUN mode (staging certificates)..."
    STAGING_FLAG="--staging"
else
    echo "🔐 Running in PRODUCTION mode (real certificates)..."
    STAGING_FLAG=""
fi

# 1. Start Nginx to serve the challenge
echo "🐳 Starting Nginx..."
docker-compose -f docker-compose.prod.yml up -d nginx

# 2. Run Certbot
echo "📜 Requesting certificate..."
docker-compose -f docker-compose.prod.yml run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
  $STAGING_FLAG \
  --email $EMAIL \
  -d $DOMAIN \
  --rsa-key-size 4096 \
  --agree-tos \
  --force-renewal" certbot

echo "🔄 Reloading Nginx..."
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo "✅ SSL setup completed!"
echo "Note: If this was a dry-run, rerun with DRY_RUN=0 in the script to get real certificates."
