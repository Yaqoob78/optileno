# AWS Deployment Guide for Optileno

## 📋 Quick Deployment Checklist

This guide walks you through deploying Optileno to AWS. Expected time: **30-45 minutes**.

---

## Step 1: Create AWS Account & Setup

### If you don't have an AWS account:
1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Click "Create an AWS Account"
3. Choose **Account type: Business**
4. Add payment method (you'll be on free tier for 12 months for most services)

### Setup AWS CLI:
```bash
# Install AWS CLI v2 (if not already installed)
# macOS:
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# Windows:
# Download from: https://awscli.amazonaws.com/AWSCLIV2.msi

# Linux:
curl "https://awscli.amazonaws.com/awscliv2.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Verify installation
aws --version
```

### Configure AWS credentials:
```bash
aws configure
# Enter:
# AWS Access Key ID: [Get from IAM console]
# AWS Secret Access Key: [Get from IAM console]
# Default region: us-east-1 (or your preferred region)
# Default output format: json
```

---

## Step 2: Create RDS Database (PostgreSQL)

### Via AWS Console:
1. Go to **RDS Dashboard** → **Create database**
2. Choose **PostgreSQL** version 14+
3. **Templates**: Choose **"Production"** (includes automated backups, multi-AZ)
4. **DB Instance Identifier**: `optileno-db-prod`
5. **Master username**: `postgres`
6. **Master password**: Generate strong password (save it!)
7. **DB Instance Class**: `db.t3.micro` (eligible for free tier)
8. **Storage**: 20 GB (can increase later)
9. **Backup retention**: 7 days (minimum for production)
10. **Multi-AZ deployment**: Disable for now (cost savings)
11. **Click Create**

**Wait 5-10 minutes for creation.**

### Get Database Endpoint:
1. RDS Dashboard → Databases → Click your database
2. Copy the **Endpoint** (looks like: `optileno-db-prod.xxxxx.us-east-1.rds.amazonaws.com`)
3. Save this for later: `DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@optileno-db-prod.xxxxx.us-east-1.rds.amazonaws.com:5432/optileno`

### Create Database:
```bash
# From your local machine (requires psql installed)
PGPASSWORD='your_password' psql -h optileno-db-prod.xxxxx.us-east-1.rds.amazonaws.com -U postgres -c "CREATE DATABASE optileno;"
```

---

## Step 3: Create ElastiCache (Redis)

### Via AWS Console:
1. Go to **ElastiCache Dashboard** → **Create cluster**
2. **Cluster engine**: Redis
3. **Cluster name**: `optileno-redis`
4. **Node type**: `cache.t3.micro` (free tier eligible)
5. **Number of replicas**: 0 (for cost)
6. **Automatic failover**: Disable
7. **Multi-AZ**: Disable
8. **Click Create**

**Wait 5-10 minutes.**

### Get Redis Endpoint:
1. ElastiCache → Clusters → Click your cluster
2. Copy the **Primary Endpoint** (looks like: `optileno-redis.xxxxx.ng.0001.use1.cache.amazonaws.com:6379`)
3. Save: `REDIS_URL=redis://optileno-redis.xxxxx.ng.0001.use1.cache.amazonaws.com:6379/0`

---

## Step 4: Create ECR Repository (Docker Registry)

### Via AWS Console or CLI:
```bash
# Create repository for backend
aws ecr create-repository \
  --repository-name optileno-backend \
  --region us-east-1

# Create repository for frontend
aws ecr create-repository \
  --repository-name optileno-frontend \
  --region us-east-1

# Login to ECR (run before pushing images)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

**Note**: Replace `YOUR_AWS_ACCOUNT_ID` with your actual AWS Account ID (find in top-right corner of AWS Console)

---

## Step 5: Push Docker Images to ECR

### Build and Push Backend:
```bash
cd /path/to/optileno

# Build
docker build -t optileno-backend:latest -f Dockerfile.backend .

# Tag for ECR
docker tag optileno-backend:latest YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/optileno-backend:latest

# Push
docker push YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/optileno-backend:latest
```

### Build and Push Frontend:
```bash
# Build
docker build -t optileno-frontend:latest -f Dockerfile.frontend .

# Tag for ECR
docker tag optileno-frontend:latest YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/optileno-frontend:latest

# Push
docker push YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/optileno-frontend:latest
```

---

## Step 6: Create VPC & Security Groups

### Option A: Use Default VPC (Easiest for Beginners)
- AWS automatically gives you a default VPC ✓

### Option B: Create Custom VPC (Recommended for Production)
```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16

# Create Public Subnet
aws ec2 create-subnet --vpc-id vpc-xxxxx --cidr-block 10.0.1.0/24

# Create Security Group
aws ec2 create-security-group \
  --group-name optileno-sg \
  --description "Security group for Optileno" \
  --vpc-id vpc-xxxxx

# Allow inbound HTTP/HTTPS
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp --port 80 --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp --port 443 --cidr 0.0.0.0/0
```

---

## Step 7: Deploy to ECS

### Option A: Using AWS Fargate (Recommended - Serverless Containers)

#### 1. Create ECS Cluster
```bash
aws ecs create-cluster --cluster-name optileno-prod
```

#### 2. Register Task Definition
```bash
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json
```

#### 3. Create ECS Service
```bash
aws ecs create-service \
  --cluster optileno-prod \
  --service-name optileno-backend-service \
  --task-definition optileno-backend:1 \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}" \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=backend,containerPort=8000
```

### Option B: Using AWS Elastic Beanstalk (Even Easier)

#### 1. Install EB CLI
```bash
pip install awsebcli
```

#### 2. Initialize Beanstalk
```bash
cd /path/to/optileno
eb init -p docker -r us-east-1 optileno-prod
```

#### 3. Create environment
```bash
eb create optileno-prod-env \
  --instance-type t3.micro \
  --scale 1
```

#### 4. Deploy
```bash
eb deploy
```

---

## Step 8: Setup Application Load Balancer (ALB)

### Via AWS Console:
1. Go to **EC2 Dashboard** → **Load Balancers** → **Create Load Balancer**
2. Choose **Application Load Balancer**
3. **Name**: `optileno-alb`
4. **Scheme**: Internet-facing
5. **IP address type**: IPv4
6. **VPC**: Select your VPC
7. **Subnets**: Select 2+ subnets (for high availability)
8. **Security Group**: Select or create one allowing 80, 443
9. **Target Group**: Create new
   - **Name**: `optileno-backend`
   - **Protocol**: HTTP
   - **Port**: 8000
   - **Target type**: IP (for Fargate)
10. **Click Create**

---

## Step 9: Setup SSL/HTTPS with ACM

### Get Free SSL Certificate:
1. Go to **AWS Certificate Manager** → **Request Certificate**
2. **Domain name**: `yourdomain.com` and `*.yourdomain.com`
3. **Validation method**: DNS (automatic)
4. **Click Request**
5. Follow DNS validation steps (add CNAME records to your domain registrar)
6. Wait for validation ✓

### Attach to ALB:
1. ALB → Edit Listener (Port 443)
2. Choose your certificate
3. Select default action → Target group: `optileno-backend`

---

## Step 10: Configure Environment Variables

### In Elastic Beanstalk or ECS:
Set these environment variables:

```
DATABASE_URL=postgresql://postgres:PASSWORD@optileno-db-prod.xxxxx.us-east-1.rds.amazonaws.com:5432/optileno
REDIS_URL=redis://optileno-redis.xxxxx.ng.0001.use1.cache.amazonaws.com:6379/0
SECRET_KEY=your-super-secret-key-min-32-chars
ENVIRONMENT=production
FRONTEND_URL=https://yourdomain.com
PRODUCTION_FRONTEND_URL=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
COOKIE_SECURE=true
COOKIE_SAMESITE=none
WORKERS_PER_CORE=2
MAX_WORKERS=8
AI_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key
NVIDIA_API_KEY=your-nvidia-api-key
OWNER_EMAIL=your-admin-email@example.com
OWNER_PASSWORD_HASH=hashed-password
```

**Never commit these to Git!** Use AWS Secrets Manager:

```bash
aws secretsmanager create-secret \
  --name optileno/prod/env-vars \
  --secret-string '{"DATABASE_URL":"...", "REDIS_URL":"..."}'
```

---

## Step 11: Setup Domain & DNS

### Point Domain to ALB:
1. Go to your domain registrar (GoDaddy, Namecheap, Route53, etc.)
2. Create **CNAME** record:
   - **Name**: `www` or `@`
   - **Value**: Your ALB DNS name (from AWS Console)
   - **TTL**: 3600 (1 hour)
3. Wait for propagation (5-30 minutes)

### Test DNS:
```bash
nslookup yourdomain.com
# Should resolve to ALB IP
```

---

## Step 12: Monitor & Maintain

### CloudWatch Logs:
```bash
# View logs
aws logs tail /aws/ecs/optileno-backend --follow
```

### Auto Scaling (Optional):
```bash
aws appautoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/optileno-prod/optileno-backend-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 1 \
  --max-capacity 10
```

### Monitoring Dashboard:
1. CloudWatch → **Create Dashboard**
2. Add metrics:
   - ECS CPU/Memory
   - RDS CPU/Connections
   - ElastiCache CPU/Evictions
   - ALB Request Count

---

## 💰 Cost Estimation

| Service | Free Tier | Paid | Monthly |
|---------|-----------|------|---------|
| **ECS Fargate** | - | $0.04144/hour | ~$30 |
| **RDS (t3.micro)** | 12 months | $0.022/hour | ~$16 |
| **ElastiCache (t3.micro)** | - | $0.017/hour | ~$12 |
| **ALB** | - | $0.0225/hour + $0.006/LCU | ~$18 |
| **NAT Gateway** | - | $0.045/hour | ~$32 |
| **Data Transfer** | 1GB/month | $0.09/GB | ~$10-50 |
| **Total** | **First 12 months** | **~$120-180/month** |

**💡 Cost Optimization:**
- Use `db.t3.micro` for RDS (free tier eligible)
- Use `cache.t3.micro` for ElastiCache
- Set ALB to auto-scale down during off-peak
- Use CloudFront CDN for static assets (frontend)

---

## 🆘 Troubleshooting

### Issue: ECS task fails to start
```
Check CloudWatch logs:
aws logs tail /aws/ecs/optileno-backend --follow

Common causes:
- DATABASE_URL not set or wrong format
- SecurityGroup not allowing outbound to RDS/Redis
- Image not found in ECR (push again)
```

### Issue: Can't connect to RDS
```bash
# Verify RDS security group allows inbound from ECS security group
aws ec2 authorize-security-group-ingress \
  --group-id sg-rds-xxxxx \
  --protocol tcp --port 5432 \
  --source-security-group-id sg-ecs-xxxxx
```

### Issue: ALB shows unhealthy targets
1. Check ECS task logs: `aws logs tail /aws/ecs/optileno-backend`
2. Verify `/health` endpoint returns 200
3. Check ALB target group health checks

### Issue: Cannot push to ECR
```bash
# Re-authenticate
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

---

## 📚 Next Steps

1. ✅ **Backups**: Enable automated RDS backups (7-30 days retention)
2. ✅ **Monitoring**: Set CloudWatch alarms for errors & high CPU
3. ✅ **Logging**: Enable S3 access logs on ALB
4. ✅ **WAF**: Add AWS WAF to ALB for DDoS protection
5. ✅ **CI/CD**: Setup GitHub Actions to auto-deploy on push (see `github-actions-deploy.yml`)

---

## 🚀 Production Checklist

- [ ] RDS multi-AZ enabled
- [ ] RDS automated backups (7+ days)
- [ ] SSL certificate installed on ALB
- [ ] Domain points to ALB via CNAME/A record
- [ ] CloudWatch alarms configured
- [ ] ECS auto-scaling rules set
- [ ] Environment variables in AWS Secrets Manager
- [ ] Database migrations completed (`alembic upgrade head`)
- [ ] Health endpoint returning 200 (`/health`)
- [ ] Frontend environment variables set (VITE_API_URL pointing to ALB)

---

## 📞 Support

For AWS-specific issues:
- AWS Docs: https://docs.aws.amazon.com
- AWS Support: https://console.aws.amazon.com/support
- CloudFormation templates: https://github.com/aws-samples

For Optileno issues:
- Backend logs: Check ECS CloudWatch logs
- Database logs: Check RDS events
- Health check: `curl https://yourdomain.com/health`
