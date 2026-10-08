const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// When deployed to EC2 with an IAM role, credentials are automatically resolved.
// When running locally, it uses ~/.aws/credentials if available, or falls back.
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

module.exports = { s3Client, PutObjectCommand };
