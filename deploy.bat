@echo off
echo ==========================================
echo  Starting MFI Management System Deployment
echo ==========================================

call npm install --production
call npm run migrate
call npm run seed

pm2 restart mfi-management || pm2 start app.js --name "mfi-management"
pm2 save

echo ==========================================
echo  Deployment Completed Successfully!
echo ==========================================
