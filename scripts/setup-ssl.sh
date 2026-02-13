#!/bin/bash

# SSL/TLS Setup Script for Optileno
# This script sets up Let's Encrypt SSL certificates automatically

set -e

# Configuration
DOMAIN_NAME="${DOMAIN_NAME:-yourdomain.com}"
EMAIL="${EMAIL:-admin@${DOMAIN_NAME}}"
NGINX_CONF="./nginx.prod.conf"
SSL_DIR="./ssl"

echo "🔒 Setting up SSL/TLS for Optileno"
echo "Domain: $DOMAIN_NAME"
echo "Email: $EMAIL"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p certbot/conf certbot/www ssl

# Generate initial self-signed certificate for startup
echo "🔐 Generating initial self-signed certificate..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$SSL_DIR/privkey.pem" \
    -out "$SSL_DIR/fullchain.pem" \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN_NAME"

# Create temporary nginx config for Let's Encrypt challenge
echo "📝 Creating temporary nginx config..."
cat > nginx.temp.conf << EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF

# Start nginx with temporary config
echo "🚀 Starting nginx for certificate validation..."
docker-compose -f docker-compose.ssl.yml down
docker-compose -f docker-compose.ssl.yml up -d nginx

# Wait for nginx to start
echo "⏳ Waiting for nginx to start..."
sleep 10

# Request Let's Encrypt certificate
echo "📜 Requesting Let's Encrypt certificate..."
docker-compose -f docker-compose.ssl.yml run --rm certbot \
    certonly --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d $DOMAIN_NAME

# Copy certificates to ssl directory
echo "📋 Copying certificates..."
docker cp $(docker-compose -f docker-compose.ssl.yml ps -q certbot):/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem ./ssl/
docker cp $(docker-compose -f docker-compose.ssl.yml ps -q certbot):/etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem ./ssl/

# Set proper permissions
chmod 600 ./ssl/privkey.pem
chmod 644 ./ssl/fullchain.pem

# Clean up temporary config
rm nginx.temp.conf

# Restart services with SSL
echo "🔄 Restarting services with SSL..."
docker-compose -f docker-compose.ssl.yml down
docker-compose -f docker-compose.ssl.yml up -d

echo "✅ SSL/TLS setup complete!"
echo "🌐 Your site is now available at: https://$DOMAIN_NAME"
echo ""
echo "📋 Certificate renewal is automated via certbot container"
echo "🔍 You can check certificate status with:"
echo "   docker-compose -f docker-compose.ssl.yml exec certbot certificates"
echo ""
echo "📝 To force renewal:"
echo "   docker-compose -f docker-compose.ssl.yml exec certbot renew --force-renewal"
