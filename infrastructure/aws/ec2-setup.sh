#!/bin/bash
# CLOUDSTOCK EC2 Initialization Script

# Exit immediately if a command exits with a non-zero status
set -e

# Update packages
sudo apt-get update -y
sudo apt-get upgrade -y

# Install Git, curl, and Nginx
sudo apt-get install -y git curl nginx ruby wget

# Install Node.js (v20) & npm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install AWS CodeDeploy Agent
cd /home/ubuntu
wget https://aws-codedeploy-us-east-1.s3.us-east-1.amazonaws.com/latest/install
chmod +x ./install
sudo ./install auto
sudo service codedeploy-agent start

# Create application directory
sudo mkdir -p /var/www/cloudstock
sudo chown -R ubuntu:ubuntu /var/www/cloudstock

# Setup basic Nginx config (To be overwritten by deployment scripts)
sudo rm -f /etc/nginx/sites-enabled/default

cat << 'EOF' | sudo tee /etc/nginx/sites-available/cloudstock
server {
    listen 80;
    server_name _;

    # Serve React Frontend
    location / {
        root /var/www/cloudstock/frontend/dist;
        index index.html;
        try_files $uri /index.html;
    }

    # Proxy API to Node Backend
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /health {
        proxy_pass http://localhost:5000/health;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/cloudstock /etc/nginx/sites-enabled/cloudstock
sudo systemctl restart nginx

echo "EC2 Setup Complete. CodeDeploy agent is running."
