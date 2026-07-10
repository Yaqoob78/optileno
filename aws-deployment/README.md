# 🚀 Optileno AWS Deployment Package

This package contains everything you need to deploy Optileno to AWS.

## 📦 What's Included

```
aws-deployment/
├── AWS_DEPLOYMENT_GUIDE.md          # Complete step-by-step guide
├── README.md                        # This file
├── deploy.sh                        # Automated deployment script (Bash)
├── deploy.ps1                       # Automated deployment script (PowerShell)
├── ecs-task-definition.json         # ECS task configuration
├── cloudformation-template.yaml     # Infrastructure-as-code template
├── github-actions-deploy.yml        # CI/CD pipeline
├── env.example                      # Environment variables template
└── .dockerignore                    # Docker build ignore file
```

## 🎯 Quick Start (5 Minutes)

### Prerequisites
- AWS Account (free tier eligible)
- AWS CLI installed and configured
- Docker installed
- Git

### Step 1: Configure AWS
```bash
aws configure
# Enter your AWS credentials
```

### Step 2: Run Deployment Script
```bash
# On macOS/Linux
chmod +x deploy.sh
./deploy.sh

# On Windows (PowerShell)
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope CurrentUser
.\deploy.ps1
```

### Step 3: Follow the prompts
The script will:
1. ✅ Create ECR repositories
2. ✅ Build and push Docker images
3. ✅ Create AWS Secrets
4. ✅ Deploy CloudFormation stack

**Total time: ~10-15 minutes**

---

## 🤔 AWS Service Options

### Compute (Pick One)

| Option | Best For | Cost | Complexity |
|--------|----------|------|-----------|
| **ECS Fargate** ⭐ | Containerized apps | $30/mo | Easy |
| **Elastic Beanstalk** | Simple deployments | $30/mo | Very Easy |
| **App Runner** | Simple containers | $40/mo | Very Easy |
| **EC2** | Full control | $10-50/mo | Hard |
| **Lambda** | Serverless | $0.20/M | Medium |

**Recommendation: ECS Fargate** - Best balance of cost and features

### Database (Pick One)

| Option | Best For | Cost | Backup |
|--------|----------|------|--------|
| **RDS PostgreSQL** ⭐ | Managed SQL | $16/mo | Automatic |
| **Aurora PostgreSQL** | High availability | $50/mo | Automatic |
| **DynamoDB** | NoSQL | Pay-per-request | Automatic |
| **Self-hosted EC2** | Full control | $10-30/mo | Manual |

**Recommendation: RDS PostgreSQL** - Managed, automatic backups, free tier eligible

### Cache (Pick One)

| Option | Best For | Cost |
|--------|----------|------|
| **ElastiCache Redis** ⭐ | In-memory cache | $12/mo |
| **MemoryDB** | Persistent Redis | $30/mo |
| **DynamoDB DAX** | DynamoDB cache | $20/mo |

**Recommendation: ElastiCache Redis** - Simple, cost-effective, same as app

### Load Balancer

| Option | Cost | Features |
|--------|------|----------|
| **Application Load Balancer** ⭐ | $18/mo | Layer 7 routing, WebSocket, best for web apps |
| **Network Load Balancer** | $18/mo | Ultra-high performance |
| **Classic Load Balancer** | $15/mo | Legacy, not recommended |

**Recommendation: ALB** - Best for web applications

---

## 📋 Complete Deployment Checklist

Follow this to deploy manually or verify automated deployment:

### Before Deployment
- [ ] AWS account created
- [ ] AWS CLI installed: `aws --version`
- [ ] AWS credentials configured: `aws sts get-caller-identity`
- [ ] Docker installed: `docker --version`
- [ ] Domain registered
- [ ] API keys gathered (Groq, Nvidia, OpenAI, etc.)

### Phase 1: AWS Setup
- [ ] Create VPC or use default
- [ ] Create RDS PostgreSQL database
- [ ] Create ElastiCache Redis cluster
- [ ] Get database and Redis endpoints
- [ ] Create ECR repositories
- [ ] Create security groups

### Phase 2: Secrets Management
- [ ] Generate SECRET_KEY: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- [ ] Create AWS Secrets for:
  - DATABASE_URL
  - REDIS_URL
  - SECRET_KEY
  - GROQ_API_KEY
  - NVIDIA_API_KEY

### Phase 3: Container Images
- [ ] Build backend: `docker build -t optileno-backend:latest -f Dockerfile.backend .`
- [ ] Build frontend: `docker build -t optileno-frontend:latest -f Dockerfile.frontend .`
- [ ] Push to ECR
- [ ] Verify images in ECR console

### Phase 4: Infrastructure
- [ ] Deploy CloudFormation stack or create manually:
  - [ ] ECS cluster
  - [ ] ECS task definitions
  - [ ] ECS services
  - [ ] Application Load Balancer
  - [ ] Target groups
  - [ ] Auto Scaling policies

### Phase 5: Networking & SSL
- [ ] Get ALB DNS name
- [ ] Create CNAME record: `your-domain.com -> alb-dns-name`
- [ ] Request SSL certificate via ACM
- [ ] Validate certificate via DNS
- [ ] Update ALB listener for HTTPS

### Phase 6: Application
- [ ] Run database migrations: `alembic upgrade head`
- [ ] Create owner account
- [ ] Test `/health` endpoint
- [ ] Test `/docs` (should be disabled in production)

### Phase 7: Monitoring
- [ ] Setup CloudWatch dashboards
- [ ] Configure CloudWatch alarms
- [ ] Enable RDS enhanced monitoring
- [ ] Setup log groups retention

---

## 🚀 Deployment Methods

### Method 1: Automated Script (Recommended for Beginners)
```bash
./deploy.sh
# Interactive script guides you through everything
```

### Method 2: CloudFormation CLI
```bash
aws cloudformation create-stack \
  --stack-name optileno-prod \
  --template-body file://cloudformation-template.yaml \
  --capabilities CAPABILITY_NAMED_IAM
```

### Method 3: Manual AWS Console
1. Go to ECS Dashboard
2. Create cluster → optileno-prod
3. Create task definition
4. Create service
5. Point ALB to service

### Method 4: Elastic Beanstalk (Easiest)
```bash
pip install awsebcli
cd optileno
eb init -p docker optileno-prod
eb create optileno-prod-env
eb deploy
```

---

## 💰 Cost Breakdown

### Development (First 12 months with free tier)
- ECS Fargate: **$0** (750 hours free per month)
- RDS t3.micro: **$0** (free tier)
- ElastiCache: **~$12/mo**
- **Total: ~$12/mo**

### Production (After free tier)
| Service | t3.micro | t3.small | Notes |
|---------|----------|----------|-------|
| ECS Fargate | $30/mo | $120/mo | Pay per CPU/memory |
| RDS | $16/mo | $50/mo | Managed backups included |
| ElastiCache | $12/mo | $30/mo | In-memory cache |
| ALB | $18/mo | $18/mo | Fixed cost |
| **Total** | **~$76/mo** | **~$218/mo** | For 5,000 users |

### Cost Optimization Tips
1. Use t3.micro for development
2. Auto-scale to 0 during off-peak
3. Enable RDS storage auto-scaling
4. Use CloudFront for static assets
5. Monitor unused resources

---

## 🔐 Security Best Practices

### Implemented
✅ Environment variables in AWS Secrets Manager  
✅ IAM roles with least privilege  
✅ Security groups for network isolation  
✅ SSL/HTTPS enforced on ALB  
✅ Health checks to auto-replace failed tasks  

### Recommended Additions
- [ ] Enable VPC Flow Logs
- [ ] Enable RDS encryption at rest
- [ ] Enable S3 versioning for backups
- [ ] Setup AWS WAF on ALB
- [ ] Enable CloudTrail for audit logs
- [ ] Use private subnets for RDS
- [ ] Setup VPN for database access

---

## 🆘 Troubleshooting

### ECS Task Won't Start
```bash
# Check logs
aws logs tail /aws/ecs/optileno-backend --follow

# Common fixes:
# - DATABASE_URL not set
# - Image not in ECR
# - SecurityGroup blocking traffic
```

### Database Connection Error
```bash
# Test connection
psql -h YOUR_RDS_ENDPOINT -U postgres -d optileno

# If fails:
# - Check RDS security group allows inbound
# - Verify database name is 'optileno'
# - Check credentials in Secrets Manager
```

### ALB Health Checks Failing
```bash
# Test health endpoint
curl http://YOUR_ALB_DNS/health

# Should return 200
# If not, check:
# - Backend is actually running
# - Logs for errors
# - Port 8000 is open in security group
```

### SSL Certificate Won't Validate
- Check CNAME record is correct
- Wait up to 30 minutes for DNS propagation
- Ensure certificate is attached to ALB listener

---

## 📚 Documentation

### AWS Documentation
- [ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [RDS Documentation](https://docs.aws.amazon.com/rds/)
- [CloudFormation User Guide](https://docs.aws.amazon.com/cloudformation/)
- [Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)

### Guides in This Package
- `AWS_DEPLOYMENT_GUIDE.md` - Step-by-step deployment
- `env.example` - All environment variables explained
- `cloudformation-template.yaml` - Infrastructure template with comments
- `ecs-task-definition.json` - Container configuration

---

## 🔄 Updates & Redeployment

### Update Application Code
```bash
# Push new version
git push origin main

# GitHub Actions auto-deploys (if configured)
# Or manually:
./deploy.sh  # Select "Build and push images"
```

### Rollback to Previous Version
```bash
# ECS automatically keeps task revision history
aws ecs update-service \
  --cluster optileno-prod \
  --service optileno-backend-service \
  --task-definition optileno-backend:PREVIOUS_VERSION
```

---

## 🎓 Learning Resources

1. **AWS Free Tier**: https://aws.amazon.com/free/
2. **ECS Workshop**: https://ecsworkshop.com/
3. **Docker Best Practices**: https://docs.docker.com/develop/dev-best-practices/
4. **Infrastructure as Code**: https://registry.terraform.io/providers/hashicorp/aws/latest/docs

---

## 📞 Support

- **AWS Support**: https://console.aws.amazon.com/support
- **AWS Forums**: https://forums.aws.amazon.com
- **Stack Overflow**: Tag with `amazon-ecs` or `amazon-rds`
- **This Project**: Check GitHub issues

---

## ✅ Success Indicators

Your deployment is successful when:
- ✅ `curl https://yourdomain.com/health` returns 200
- ✅ ECS service shows "Running" state
- ✅ ALB target group shows "Healthy"
- ✅ RDS is "Available"
- ✅ ElastiCache is "Available"
- ✅ Database migrations completed
- ✅ CloudWatch logs show no errors

---

## 📝 Notes

- **Free Tier**: Valid for 12 months from account creation
- **Backup Retention**: Set to 7 days minimum for production
- **Auto-Scaling**: Configured to scale 1-10 instances based on CPU
- **Health Checks**: 30-second interval, 3 retries before replacement
- **Logs Retention**: 30 days in CloudWatch

---

**Good luck with your AWS deployment! 🚀**

