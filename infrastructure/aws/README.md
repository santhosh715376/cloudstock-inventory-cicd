# AWS Cloud Infrastructure - CLOUDSTOCK

This document details the production AWS architecture and resource configuration for the CLOUDSTOCK inventory management system.

## Architecture Overview
```text
Internet
   ↓
Route 53
   ↓
Application Load Balancer (ALB)
   ↓
EC2 (Auto Scaling Group / Standalone)
   ↓
Amazon RDS MySQL 8+
```

## VPC (Virtual Private Cloud)
- **CIDR Block**: `10.0.0.0/16`
- **Availability Zones**: Multi-AZ deployment (e.g., `us-east-1a`, `us-east-1b`).
- **Subnets**:
  - **Public Subnets**: 2 Subnets (`10.0.1.0/24`, `10.0.2.0/24`) for ALB and NAT Gateways.
  - **Private Application Subnets**: 2 Subnets (`10.0.3.0/24`, `10.0.4.0/24`) for EC2 Instances. Outbound internet access via NAT Gateway.
  - **Private Database Subnets**: 2 Subnets (`10.0.5.0/24`, `10.0.6.0/24`) for RDS MySQL. No direct internet access.

## Security Groups (Firewalls)
1. **ALB-SG**:
   - Inbound: Port `80` & `443` from `0.0.0.0/0` (Internet).
   - Outbound: All traffic to EC2-SG.
2. **EC2-SG**:
   - Inbound: Application ports (e.g., `80` for Nginx, `5000` for Node) from `ALB-SG` ONLY.
   - Outbound: All outbound traffic (for NPM, APIs, and RDS).
3. **RDS-SG**:
   - Inbound: Port `3306` from `EC2-SG` ONLY.
   - Outbound: No outbound rules strictly needed, but typically all allowed for patches.
   - *RDS is strictly blocked from the public internet.*

## EC2 Configuration
Instances are deployed in the Private Application Subnet.
**Software Stack**:
- Node.js & NPM
- PM2 (Process Manager)
- Nginx (Reverse Proxy for Frontend/Backend)
- Git
- AWS CodeDeploy Agent
**Application Directory**: `/var/www/cloudstock`

*(See `ec2-setup.sh` for the exact initialization script).*

## Amazon RDS (MySQL)
- **Engine**: MySQL 8.0+
- **Instance Type**: `db.t3.micro` (or larger for production).
- **Storage**: InnoDB (critical for row-level locking and atomic `UPDATE` concurrency logic).
- **Network**: Deployed exclusively in the Private Database Subnet.
- **Backups**: Automated backups enabled with a 7-day retention period.

## Amazon S3
- **Bucket**: `cloudstock-artifacts-<account-id>`
- **Usage**: Deployment artifacts (CodeDeploy), product images, backups, reports.
- **Security**: Strictly private (Block Public Access enabled). Versioning is enabled to preserve historical artifacts.

## AWS IAM Roles
**Principle of Least Privilege**:
- **EC2 Role**: Access to read artifacts from the S3 bucket and upload logs to CloudWatch.
- **CodeDeploy Role**: Access to manage EC2 deployments.
- **CodeBuild/CodePipeline Roles**: To be configured in Phase 5 for CI/CD operations.
- *No hard-coded AWS keys or database passwords exist in the source code.*

## Amazon CloudWatch
- **EC2 Monitoring**: CPU Utilization, Memory (via unified agent).
- **RDS Monitoring**: CPU Utilization, Database Connections, Disk IOPS.
- **Application Logs**: PM2 logs stream directly to CloudWatch log groups (`/cloudstock/backend`, `/cloudstock/frontend`).
- **Health Checks**: ALB health checks ping `/health` continuously.

## How to Provision
The provided `main.tf` and related Terraform files contain the exact configuration to deploy this infrastructure. 
1. Install Terraform.
2. Run `terraform init`.
3. Run `terraform apply`.

## Phase 5: AWS Integrations (RDS & S3)
Once the EC2 and RDS instances are running, you must initialize the database and configure environment variables.

### Environment Configuration
Switch between Local and AWS environments seamlessly by setting the following environment variables in PM2 or directly on the EC2 shell:
```bash
# Database Configuration
DATABASE_HOST=<your-rds-endpoint>.rds.amazonaws.com
DATABASE_PORT=3306
DATABASE_NAME=cloudstock_db
DATABASE_USER=admin
DATABASE_PASSWORD=<your-secure-password>

# S3 Configuration
S3_BUCKET_NAME=cloudstock-artifacts-<account-id>
AWS_REGION=us-east-1
```
*Note: AWS credentials (Access Keys) are NOT required because the application utilizes the assigned EC2 IAM Role to seamlessly interact with S3.*

### Database Initialization
We have provided an initialization script that connects to the configured RDS instance and runs the exact `schema.sql` and `seed.sql` required for CLOUDSTOCK.
From the EC2 instance, run:
```bash
cd /var/www/cloudstock
node scripts/db-init.js
```
This automatically handles schema creation, seeding data, indexes, and constraints.
