#!/bin/bash
# Hostinger Auto-Deployment Script for MFI Management System

echo "=========================================="
echo " Starting MFI Management System Deployment"
echo "=========================================="

# 1. Install dependencies
echo "[1/4] Installing dependencies..."
npm install --production

# 2. Run Database Migrations
echo "[2/4] Running database migrations..."
npm run migrate

# 3. Seed initial database data
echo "[3/4] Running initial database seeds..."
npm run seed

# 4. Restart Process
echo "[4/4] Restarting Application..."
if command -v pm2 &> /dev/null; then
    pm2 restart mfi-management 2>/dev/null || pm2 start app.js --name "mfi-management"
    pm2 save 2>/dev/null
fi

# Touch Passenger restart file for Hostinger Passenger compatibility
mkdir -p tmp
touch tmp/restart.txt

echo "=========================================="
echo " Deployment Completed Successfully!       "
echo "=========================================="
