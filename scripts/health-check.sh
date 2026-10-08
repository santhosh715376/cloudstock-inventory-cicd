#!/bin/bash
# Call GET /health to verify deployment success
sleep 5

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health)

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo "Health check passed!"
    exit 0
else
    echo "Health check failed with status: $HTTP_STATUS"
    # Stop unhealthy version
    pm2 stop cloudstock || true
    # Exit with non-zero to report deployment failure to CodeDeploy
    exit 1
fi
