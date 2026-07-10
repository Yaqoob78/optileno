# AWS Deployment Quick Reference

## 🚀 5-Minute Quick Start

### 1. Prerequisites
```bash
# Verify installations
aws --version
docker --version
```

### 2. Configure AWS
```bash
aws configure
# Enter: Access Key ID, Secret Access Key, Region (us-east-1), Output format (json)
```

### 3. Run Deployment
```bash
# macOS/Linux
chmod +x deploy.sh
./deploy.sh

# Windows (PowerShell)
.\deploy.ps1
```

### 4. Follow Interactive Prompts
The script handles everything:
- ECR repositories
- Docker image builds & push
- AWS Secrets
- CloudFormation stack

---

## 📋 What To Choose (If You Don't Know)

### Compute
**Choose: ECS Fargate**
- No servers to manage
- Pay for CPU/memory used
- Auto-scaling included
- Free tier: 750 hours/month

### Database
**Choose: RDS PostgreSQL**
- Fully managed
- Automatic backups
- Free tier: db.t3.micro
- Easy to upgrade

### Cache
**Choose: ElastiCache Redis**
- Managed Redis
- 16 GB free tier eligible
- Improves performance 10x+

### Load Balancer
**Choose: Application Load Balancer**
- Layer 7 routing
- SSL/HTTPS support
- WebSocket support
- $18/month

### Storage
**Choose: S3**
- For static assets & backups
- $0.023 per GB stored

---

## 🎯 AWS Account Setup

### Step 1: Create Account
1. Go to aws.amazon.com
2. Click "Create AWS Account"
3. Choose "Business"
4. Verify email

### Step 2: Enable Billing Alerts
1. Go to AWS Console
2. Billing & Cost Management
3. Set alert at $50/month

### Step 3: Create IAM User (Security)
1. IAM → Users → Create User
2. Set permissions: Programmatic access
3. Attach policy: PowerUserAccess (or custom)
4. Download credentials → save safely
5. Use in `aws configure`

---

## 🏗️ Infrastructure Setup Timeline

| Step | Service | Time | Cost |
|------|---------|------|------|
| 1 | RDS PostgreSQL | 5-10 min | $0* |
| 2 | ElastiCache Redis | 5-10 min | $0* |
| 3 | ECR Repositories | 1 min | $0 |
| 4 | Build & Push Images | 10-15 min | $0 |
| 5 | ECS Cluster | 2 min | $0 |
| 6 | CloudFormation Stack | 10-15 min | $0 |
| 7 | SSL Certificate (ACM) | 5 min | $0 |
| 8 | DNS Setup | 5-30 min | varies |
| **TOTAL** | | ~45-60 min | $0 (first year) |

*Free tier eligible

---

## 💰 Cost Calculator

### For 5,000 users
```
ECS Fargate:           $30/month
RDS PostgreSQL:        $16/month  
ElastiCache Redis:     $12/month
ALB:                   $18/month
NAT Gateway:           $32/month
Data Transfer:         $20/month
─────────────────────────────────
Total:                $128/month
```

### Ways to Save
- ✅ Use t3.micro for first year (free)
- ✅ Scale down at night (0 cost off-peak)
- ✅ Use CloudFront for static assets
- ✅ Turn off unused databases
- ✅ Use Spot instances for non-critical workloads

---

## 🔑 Environment Variables You'll Need

```
DATABASE_URL              → RDS endpoint (auto-filled)
REDIS_URL               → ElastiCache endpoint (auto-filled)
SECRET_KEY              → Generate: python -c "import secrets; print(secrets.token_urlsafe(32))"
GROQ_API_KEY            → Get from: https://console.groq.com/keys
NVIDIA_API_KEY          → Get from: https://build.nvidia.com/
FRONTEND_URL            → Your domain: https://yourdomain.com
OWNER_EMAIL             → Your admin email
OWNER_PASSWORD_HASH     → bcrypt hash of password
```

---

## 🆘 Common Issues & Fixes

### "Could not connect to database"
```bash
# Check security group allows outbound
aws ec2 authorize-security-group-egress \
  --group-id sg-xxxxx \
  --protocol tcp --port 5432 --cidr 0.0.0.0/0
```

### "ALB target unhealthy"
```bash
# Check ECS logs
aws logs tail /aws/ecs/optileno-backend --follow

# Check health endpoint
curl http://YOUR_ALB/health
```

### "Cannot push to ECR"
```bash
# Re-authenticate
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

### "SSL Certificate won't validate"
- Wait 30 minutes for DNS propagation
- Check CNAME record is correct
- Verify domain registrar settings

---

## ✅ Post-Deployment Checklist

- [ ] ECS service shows "Running"
- [ ] ALB targets show "Healthy"
- [ ] RDS shows "Available"
- [ ] ElastiCache shows "Available"
- [ ] Database migrations completed
- [ ] `curl /health` returns 200
- [ ] Domain points to ALB
- [ ] SSL certificate installed
- [ ] CloudWatch logs show no errors
- [ ] Monitoring dashboard created

---

## 📊 Monitoring Dashboard Commands

```bash
# View ECS service status
aws ecs describe-services \
  --cluster optileno-prod \
  --services optileno-backend-service

# View recent logs (last hour)
aws logs tail /aws/ecs/optileno-backend \
  --follow \
  --since 1h

# Get RDS status
aws rds describe-db-instances \
  --db-instance-identifier optileno-db-prod

# Get ALB target health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:...
```

---

## 🔐 Security Checklist

- [ ] Never commit secrets to Git
- [ ] Use AWS Secrets Manager (not env files)
- [ ] Enable RDS encryption
- [ ] Use security groups (not open to world)
- [ ] Enable WAF on ALB
- [ ] Enable VPC Flow Logs
- [ ] Setup CloudTrail audit
- [ ] Enable S3 versioning
- [ ] Setup backup retention (7+ days)
- [ ] Enable MFA on AWS account

---

## 📱 Mobile/Frontend Setup

After backend is deployed:

```
VITE_API_URL=https://yourdomain.com/api/v1
VITE_SOCKET_URL=https://yourdomain.com
```

Then deploy frontend to:
- Vercel (recommended, free tier)
- Netlify (free tier)
- CloudFront + S3
- Your ALB

---

## 🚀 Scaling When You Grow

### 100 → 500 users
- Upgrade ECS: t3.small (still cheap)
- Monitor RDS connections
- Add monitoring alerts

### 500 → 1000 users  
- Enable RDS read replicas
- Increase ElastiCache size
- Auto-scale ECS: 2-4 instances

### 1000 → 5000+ users
- Multi-AZ RDS (high availability)
- CloudFront CDN for static assets
- Dedicated NAT gateways
- Consider Aurora PostgreSQL
- Split services (microservices)

---

## 📞 Getting Help

### AWS Free Tier Support
- Account & Billing: AWS Support Console
- Technical: AWS Forums
- Community: Stack Overflow (#amazon-ecs)

### Optileno Specific
- Backend logs: CloudWatch Logs
- Database: RDS Performance Insights
- Metrics: CloudWatch Dashboards

### Documentation
- Full guide: See AWS_DEPLOYMENT_GUIDE.md
- Env vars: See env.example
- Infrastructure: See cloudformation-template.yaml

---

## 🎉 Success Indicators

You're ready for production when:

✅ Health check returns 200  
✅ No errors in logs  
✅ Database migrations completed  
✅ Frontend connects to backend  
✅ Login works  
✅ API endpoints respond  
✅ WebSocket connections work  
✅ Static assets load  
✅ SSL certificate valid  
✅ Monitoring configured  

**You're live! 🎊**

---

## 📝 Quick Commands Reference

```bash
# View deployment status
aws cloudformation describe-stacks --stack-name optileno-prod

# View logs
aws logs tail /aws/ecs/optileno-backend --follow

# Scale service
aws ecs update-service --cluster optileno-prod \
  --service optileno-backend-service --desired-count 3

# View ALB DNS
aws elbv2 describe-load-balancers --query 'LoadBalancers[0].DNSName'

# Restart service
aws ecs update-service --cluster optileno-prod \
  --service optileno-backend-service --force-new-deployment

# View database
psql -h your-rds-endpoint -U postgres -d optileno

# Monitor metrics
aws cloudwatch list-metrics --namespace AWS/ECS

# Check SSL certificate
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443
```

---

**Last Updated**: 2024  
**Version**: AWS Deployment v1.0  
**Status**: Production Ready ✓
