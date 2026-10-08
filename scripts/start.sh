#!/bin/bash
# Start the Node.js application using PM2
cd /var/www/cloudstock/backend
pm2 start src/app.js --name cloudstock

# Ensure Nginx serves the new frontend assets
systemctl restart nginx
