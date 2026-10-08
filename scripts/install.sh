#!/bin/bash
# Install dependencies
cd /var/www/cloudstock/backend
npm ci --omit=dev
