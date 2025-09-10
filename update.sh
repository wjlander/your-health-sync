#!/bin/bash

# Health & Wellness App Update Script
# Usage: ./update.sh

set -e

echo "🔄 Starting update for Health & Wellness App..."

# Configuration
APP_DIR="/var/www/health-app"
BACKUP_DIR="/var/backups/health-app"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup
print_status "Creating backup..."
sudo mkdir -p $BACKUP_DIR
sudo cp -r $APP_DIR $BACKUP_DIR/$(date +%Y%m%d_%H%M%S)

# Pull latest changes (if using git)
if [ -d ".git" ]; then
    print_status "Pulling latest changes from git..."
    git pull origin main
fi

# Install dependencies and build
print_status "Installing dependencies..."
npm install

print_status "Building application..."
npm run build

# Update application files
print_status "Updating application files..."
sudo cp -r dist/* $APP_DIR/
sudo chown -R www-data:www-data $APP_DIR

# Test Nginx configuration
print_status "Testing Nginx configuration..."
sudo nginx -t

# Reload Nginx (graceful reload without downtime)
print_status "Reloading Nginx..."
sudo systemctl reload nginx

# Clean up old backups (keep last 5)
print_status "Cleaning up old backups..."
sudo find $BACKUP_DIR -maxdepth 1 -type d -name "20*" | sort -r | tail -n +6 | sudo xargs rm -rf

print_status "Update completed successfully! 🎉"
print_status "Application has been updated with zero downtime"