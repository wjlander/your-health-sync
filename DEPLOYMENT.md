# Health & Wellness App Deployment Guide

## Prerequisites

1. Ubuntu server with sudo access
2. Domain pointing to your server (health.ringing.org.uk)

## Step 1: Fix NPM Conflicts

If you encounter npm installation conflicts:

```bash
chmod +x fix-npm.sh
./fix-npm.sh
```

## Step 2: Install Required Packages

```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx
```

## Step 3: Prepare Deployment

1. **Move to your home directory:**
```bash
cd ~
cp -r /var/tmp/public/your-health-sync ./health-app-source
cd health-app-source
```

2. **Make scripts executable:**
```bash
chmod +x deploy.sh update.sh fix-npm.sh
```

3. **Clean npm cache (if needed):**
```bash
npm cache clean --force
```

## Step 4: Deploy

```bash
./deploy.sh
```

This will:
- Clear npm cache and fix permissions
- Build the application
- Configure Nginx with SSL
- Set up auto-renewal for SSL certificates
- Create systemd services for updates

## Step 5: Update (Future Updates)

For future updates, simply run:

```bash
./update.sh
```

## Troubleshooting

### Permission Issues
- Ensure you're not running as root
- Clear npm cache: `npm cache clean --force`
- Fix ownership: `sudo chown -R $USER:$USER ~/.npm`

### Nginx Configuration Issues
- The script now uses the correct Supabase URL
- API proxy section has been removed (not needed for client-side Supabase calls)
- Test configuration manually: `sudo nginx -t`

### Build Issues
- Make sure you're in the project directory
- Install dependencies first: `npm install`
- Check for permission issues in node_modules

## Important Notes

- The app will be deployed to `/var/www/health-app`
- Backups are stored in `~/health-app-backups`
- SSL certificates are automatically managed by Let's Encrypt
- The deployment includes security headers and proper caching