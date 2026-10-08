#!/bin/bash
# Safely stop the previous application version
pm2 stop cloudstock || true
pm2 delete cloudstock || true
exit 0
