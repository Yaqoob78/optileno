#!/bin/bash
set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."
  
  # Check AWS CLI
  if ! command -v aws &> /dev/null; then
    log_error "AWS CLI not found. Install from: https://aws.amazon.com/cli/"
    exit 1
  fi
  
  # Check Docker
  if ! command -v docker &> /dev/null; then
    log_error "Docker not found. Install from: https://www.docker.com/products/docker-desktop"
    exit 1
  fi
  
  # Check jq
  if ! command -v jq &> /dev/null; then
    log_warning "jq not found. Some features may not work. Install from: https://stedolan.github.io/jq/download/"
  fi
  
  log_success "All prerequisites met"
}

# Get AWS account ID
get_account_id() {
  aws sts get-caller-identity --query Account --output text
}

# Create ECR repositories
create_ecr_repos() {
  log_info "Creating ECR repositories..."
  
  REGION=${AWS_REGION:-us-east-1}
  
  for repo in optileno-backend optileno-frontend; do
    if aws ecr describe-repositories --repository-names $repo --region $REGION &> /dev/null; then
      log_warning "Repository $repo already exists, skipping"
    else
      aws ecr create-repository --repository-name $repo --region $REGION
      log_success "Created repository $repo"
    fi
  done
}

# Build and push Docker images
build_and_push_images() {
  log_info "Building and pushing Docker images..."
  
  REGION=${AWS_REGION:-us-east-1}
  ACCOUNT_ID=$(get_account_id)
  
  # Login to ECR
  log_info "Logging in to ECR..."
  aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com
  log_success "Logged in to ECR"
  
  # Backend
  log_info "Building backend image..."
  docker build -t optileno-backend:latest -f Dockerfile.backend .
  docker tag optileno-backend:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/optileno-backend:latest
  
  log_info "Pushing backend image..."
  docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/optileno-backend:latest
  log_success "Backend image pushed"
  
  # Frontend
  log_info "Building frontend image..."
  docker build -t optileno-frontend:latest -f Dockerfile.frontend .
  docker tag optileno-frontend:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/optileno-frontend:latest
  
  log_info "Pushing frontend image..."
  docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/optileno-frontend:latest
  log_success "Frontend image pushed"
}

# Create secrets in Secrets Manager
create_secrets() {
  log_info "Creating AWS Secrets Manager secrets..."
  
  REGION=${AWS_REGION:-us-east-1}
  
  # Read env file
  if [ ! -f "env.example" ]; then
    log_error "env.example not found"
    exit 1
  fi
  
  # Create secrets
  secrets=(
    "optileno/prod/database-url:DATABASE_URL"
    "optileno/prod/redis-url:REDIS_URL"
    "optileno/prod/secret-key:SECRET_KEY"
    "optileno/prod/groq-api-key:GROQ_API_KEY"
    "optileno/prod/nvidia-api-key:NVIDIA_API_KEY"
  )
  
  for secret in "${secrets[@]}"; do
    secret_name="${secret%%:*}"
    env_var="${secret##*:}"
    
    value=$(grep "^${env_var}=" env.example | cut -d'=' -f2-)
    
    if [ -z "$value" ]; then
      log_warning "Skipping $secret_name - value not found in env.example"
      continue
    fi
    
    if aws secretsmanager describe-secret --secret-id $secret_name --region $REGION &> /dev/null; then
      log_warning "Secret $secret_name already exists, skipping"
    else
      aws secretsmanager create-secret \
        --name $secret_name \
        --secret-string "$value" \
        --region $REGION
      log_success "Created secret $secret_name"
    fi
  done
}

# Deploy with CloudFormation
deploy_cloudformation() {
  log_info "Deploying CloudFormation stack..."
  
  REGION=${AWS_REGION:-us-east-1}
  ACCOUNT_ID=$(get_account_id)
  STACK_NAME="optileno-prod"
  
  # Update template with account ID
  sed "s/YOUR_AWS_ACCOUNT_ID/$ACCOUNT_ID/g" cloudformation-template.yaml > /tmp/cf-template.yaml
  
  aws cloudformation create-stack \
    --stack-name $STACK_NAME \
    --template-body file:///tmp/cf-template.yaml \
    --region $REGION \
    --parameters \
      ParameterKey=DockerImageBackend,ParameterValue=$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/optileno-backend:latest \
      ParameterKey=DockerImageFrontend,ParameterValue=$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/optileno-frontend:latest \
    --capabilities CAPABILITY_NAMED_IAM
  
  log_info "CloudFormation stack creation initiated"
  log_info "Stack name: $STACK_NAME"
  log_info "Monitor progress: https://console.aws.amazon.com/cloudformation"
}

# Show next steps
show_next_steps() {
  REGION=${AWS_REGION:-us-east-1}
  ACCOUNT_ID=$(get_account_id)
  
  cat << EOF

${GREEN}==================================${NC}
${GREEN}Deployment Complete!${NC}
${GREEN}==================================${NC}

${YELLOW}Next steps:${NC}

1. ${BLUE}Monitor CloudFormation Stack${NC}
   https://console.aws.amazon.com/cloudformation/home?region=$REGION

2. ${BLUE}Update environment variables${NC}
   Edit env.example and create secrets:
   aws secretsmanager update-secret --secret-id optileno/prod/database-url --secret-string "your-real-url"

3. ${BLUE}Get ALB DNS name${NC}
   aws cloudformation describe-stacks --stack-name optileno-prod --region $REGION --query 'Stacks[0].Outputs[?OutputKey==\`LoadBalancerDNS\`].OutputValue' --output text

4. ${BLUE}Point your domain to ALB${NC}
   Create CNAME record in your DNS provider pointing to ALB DNS

5. ${BLUE}Setup SSL certificate${NC}
   AWS Certificate Manager -> Request Certificate -> Validate DNS

6. ${BLUE}View logs${NC}
   aws logs tail /aws/ecs/optileno-backend --follow --region $REGION

7. ${BLUE}Test health endpoint${NC}
   curl http://YOUR_ALB_DNS/health

${YELLOW}Cost estimation:${NC}
- ECS Fargate: ~$30/month
- RDS PostgreSQL: ~$16/month
- ElastiCache Redis: ~$12/month
- ALB: ~$18/month
- NAT Gateway: ~$32/month
- Data transfer: ~$10-50/month
- ${BLUE}Total: ~$120-180/month${NC}

${YELLOW}Support:${NC}
- Docs: https://docs.aws.amazon.com
- Troubleshooting: See AWS_DEPLOYMENT_GUIDE.md

EOF
}

# Main script
main() {
  clear
  
  cat << EOF
${BLUE}╔════════════════════════════════════════╗${NC}
${BLUE}║  Optileno AWS Deployment Script       ║${NC}
${BLUE}╚════════════════════════════════════════╝${NC}

EOF

  # Default region
  AWS_REGION="${AWS_REGION:-us-east-1}"
  
  check_prerequisites
  
  log_info "AWS Region: $AWS_REGION"
  log_info "AWS Account: $(get_account_id)"
  
  # Ask what to deploy
  echo ""
  echo -e "${YELLOW}What would you like to do?${NC}"
  echo "1) Build and push Docker images to ECR"
  echo "2) Create ECR repositories"
  echo "3) Create AWS Secrets"
  echo "4) Deploy CloudFormation stack"
  echo "5) All of the above"
  echo "6) Exit"
  echo ""
  
  read -p "Enter choice (1-6): " choice
  
  case $choice in
    1)
      build_and_push_images
      ;;
    2)
      create_ecr_repos
      ;;
    3)
      create_secrets
      ;;
    4)
      deploy_cloudformation
      ;;
    5)
      create_ecr_repos
      build_and_push_images
      create_secrets
      deploy_cloudformation
      ;;
    6)
      log_info "Exiting..."
      exit 0
      ;;
    *)
      log_error "Invalid choice"
      exit 1
      ;;
  esac
  
  show_next_steps
}

# Run main
main "$@"
