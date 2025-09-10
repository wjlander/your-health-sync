#!/bin/bash

# Health & Wellness App Deployment Script
# Usage: ./deploy.sh

set -e

echo "🚀 Starting deployment for Health & Wellness App..."

# Configuration
APP_NAME="health-app"
APP_DIR="$HOME/health-app-deploy"
DOMAIN="health.ringing.org.uk"
PORT=8080

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   exit 1
fi

# Clear npm cache and fix permissions
print_status "Clearing npm cache and fixing permissions..."
npm cache clean --force
sudo chown -R $USER:$USER ~/.npm
sudo chown -R $USER:$USER ./node_modules 2>/dev/null || true

# Create app directory
print_status "Creating application directory..."
mkdir -p $APP_DIR
sudo mkdir -p /var/www/health-app
sudo chown -R $USER:$USER /var/www/health-app

# Build the application
print_status "Building the application..."
npm install
npm run build

# Copy built files
print_status "Copying built files to server directory..."
cp -r dist/* $APP_DIR/
sudo cp -r dist/* /var/www/health-app/
sudo chown -R www-data:www-data /var/www/health-app

# Create Nginx configuration
print_status "Creating Nginx configuration..."
sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL configuration will be added by certbot
    
    root /var/www/health-app;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Handle client-side routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable the site
print_status "Enabling Nginx site..."
sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/

# Test Nginx configuration before restarting
print_status "Testing Nginx configuration..."
if sudo nginx -t; then
    print_status "Nginx configuration is valid"
else
    print_error "Nginx configuration test failed. Please check the configuration."
    exit 1
fi

# Restart Nginx
print_status "Restarting Nginx..."
sudo systemctl restart nginx

# Setup SSL with Let's Encrypt
print_status "Setting up SSL certificate..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@ringing.org.uk --redirect

# Setup auto-renewal
print_status "Setting up SSL auto-renewal..."
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Create systemd service for auto-updates (optional)
print_status "Creating update service..."
sudo tee /etc/systemd/system/health-app-update.service > /dev/null <<EOF
[Unit]
Description=Health App Update Service
After=network.target

[Service]
Type=oneshot
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/update.sh
EOF

sudo tee /etc/systemd/system/health-app-update.timer > /dev/null <<EOF
[Unit]
Description=Health App Update Timer
Requires=health-app-update.service

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
EOF

print_status "Deployment completed successfully! 🎉"
print_status "Your app is now available at: https://$DOMAIN"
print_warning "Make sure to update your Supabase environment variables in production"