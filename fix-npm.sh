#!/bin/bash

# Fix NPM installation conflicts on Ubuntu with NodeSource
echo "🔧 Fixing NPM installation conflicts..."

# Remove conflicting npm package
sudo apt remove npm -y

# Install npm via NodeJS (since you have NodeSource NodeJS)
curl -L https://www.npmjs.com/install.sh | sudo sh

# Alternative: Install npm directly
# sudo npm install -g npm@latest

# Verify installation
echo "✅ Checking versions:"
node --version
npm --version

echo "🎉 NPM conflict resolved!"
echo "You can now run: sudo apt install nginx certbot python3-certbot-nginx"