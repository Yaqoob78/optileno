# Optileno AWS Deployment Script for Windows (PowerShell)
# Run as Administrator

param(
    [string]$Action = "All",
    [string]$AwsRegion = "us-east-1"
)

# Color codes
$INFO = "Blue"
$SUCCESS = "Green"
$WARNING = "Yellow"
$ERROR_COLOR = "Red"

# Functions
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $INFO
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $SUCCESS
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $WARNING
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $ERROR_COLOR
}

# Check prerequisites
function Test-Prerequisites {
    Write-Info "Checking prerequisites..."
    
    # Check AWS CLI
    try {
        $null = aws --version
        Write-Success "AWS CLI found"
    } catch {
        Write-Error "AWS CLI not found. Install from: https://aws.amazon.com/cli/"
        exit 1
    }
    
    # Check Docker
    try {
        $null = docker --version
        Write-Success "Docker found"
    } catch {
        Write-Error "Docker not found. Install from: https://www.docker.com/products/docker-desktop"
        exit 1
    }
}

# Get AWS Account ID
function Get-AwsAccountId {
    $output = aws sts get-caller-identity --query Account --output text
    return $output
}

# Create ECR repositories
function New-EcrRepositories {
    Write-Info "Creating ECR repositories..."
    
    $repos = @("optileno-backend", "optileno-frontend")
    
    foreach ($repo in $repos) {
        try {
            $existing = aws ecr describe-repositories --repository-names $repo --region $AwsRegion 2>$null
            Write-Warning "Repository $repo already exists, skipping"
        } catch {
            aws ecr create-repository --repository-name $repo --region $AwsRegion
            Write-Success "Created repository $repo"
        }
    }
}

# Build and push Docker images
function Build-AndPushImages {
    Write-Info "Building and pushing Docker images..."
    
    $AccountId = Get-AwsAccountId
    $Registry = "$AccountId.dkr.ecr.$AwsRegion.amazonaws.com"
    
    # Login to ECR
    Write-Info "Logging in to ECR..."
    $LoginCmd = aws ecr get-login-password --region $AwsRegion | 
                docker login --username AWS --password-stdin $Registry
    
    Write-Success "Logged in to ECR"
    
    # Build backend
    Write-Info "Building backend image..."
    docker build -t optileno-backend:latest -f Dockerfile.backend .
    
    Write-Info "Tagging backend image..."
    docker tag optileno-backend:latest "$Registry/optileno-backend:latest"
    
    Write-Info "Pushing backend image..."
    docker push "$Registry/optileno-backend:latest"
    Write-Success "Backend image pushed"
    
    # Build frontend
    Write-Info "Building frontend image..."
    docker build -t optileno-frontend:latest -f Dockerfile.frontend .
    
    Write-Info "Tagging frontend image..."
    docker tag optileno-frontend:latest "$Registry/optileno-frontend:latest"
    
    Write-Info "Pushing frontend image..."
    docker push "$Registry/optileno-frontend:latest"
    Write-Success "Frontend image pushed"
}

# Create secrets
function New-AwsSecrets {
    Write-Info "Creating AWS Secrets Manager secrets..."
    
    # Read env file
    if (-not (Test-Path "env.example")) {
        Write-Error "env.example not found"
        exit 1
    }
    
    $secrets = @(
        @{Name = "optileno/prod/database-url"; EnvVar = "DATABASE_URL"},
        @{Name = "optileno/prod/redis-url"; EnvVar = "REDIS_URL"},
        @{Name = "optileno/prod/secret-key"; EnvVar = "SECRET_KEY"},
        @{Name = "optileno/prod/groq-api-key"; EnvVar = "GROQ_API_KEY"},
        @{Name = "optileno/prod/nvidia-api-key"; EnvVar = "NVIDIA_API_KEY"}
    )
    
    foreach ($secret in $secrets) {
        $value = (Get-Content env.example | Select-String "^$($secret.EnvVar)=" | ForEach-Object {$_ -replace "^$($secret.EnvVar)=", ""})
        
        if ([string]::IsNullOrEmpty($value)) {
            Write-Warning "Skipping $($secret.Name) - value not found"
            continue
        }
        
        try {
            $existing = aws secretsmanager describe-secret --secret-id $secret.Name --region $AwsRegion 2>$null
            Write-Warning "Secret $($secret.Name) already exists, skipping"
        } catch {
            aws secretsmanager create-secret `
                --name $secret.Name `
                --secret-string $value `
                --region $AwsRegion
            Write-Success "Created secret $($secret.Name)"
        }
    }
}

# Deploy CloudFormation
function Deploy-CloudFormation {
    Write-Info "Deploying CloudFormation stack..."
    
    $StackName = "optileno-prod"
    $AccountId = Get-AwsAccountId
    
    # Read and update template
    $template = Get-Content cloudformation-template.yaml
    $template = $template -replace "YOUR_AWS_ACCOUNT_ID", $AccountId
    
    # Save temp template
    $template | Set-Content -Path "$env:TEMP\cf-template.yaml"
    
    # Deploy
    aws cloudformation create-stack `
        --stack-name $StackName `
        --template-body "file://$env:TEMP\cf-template.yaml" `
        --region $AwsRegion `
        --parameters `
            "ParameterKey=DockerImageBackend,ParameterValue=$AccountId.dkr.ecr.$AwsRegion.amazonaws.com/optileno-backend:latest" `
            "ParameterKey=DockerImageFrontend,ParameterValue=$AccountId.dkr.ecr.$AwsRegion.amazonaws.com/optileno-frontend:latest" `
        --capabilities CAPABILITY_NAMED_IAM
    
    Write-Success "CloudFormation stack creation initiated"
    Write-Info "Stack name: $StackName"
    Write-Info "Monitor: https://console.aws.amazon.com/cloudformation"
}

# Show next steps
function Show-NextSteps {
    $AccountId = Get-AwsAccountId
    
    Clear-Host
    Write-Host @"
╔════════════════════════════════════════╗
║  AWS Deployment Complete!             ║
╚════════════════════════════════════════╝

$([char]27)[92mNext Steps:$([char]27)[0m

1. Monitor CloudFormation Stack
   https://console.aws.amazon.com/cloudformation/home?region=$AwsRegion

2. Get ALB DNS name
   aws cloudformation describe-stacks --stack-name optileno-prod --region $AwsRegion --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' --output text

3. Point domain to ALB
   Create CNAME record in DNS provider

4. Setup SSL certificate
   AWS Certificate Manager -> Request Certificate

5. View logs
   aws logs tail /aws/ecs/optileno-backend --follow --region $AwsRegion

6. Test health endpoint
   curl http://YOUR_ALB_DNS/health

$([char]27)[93mCost Estimation:$([char]27)[0m
- ECS Fargate: ~$30/month
- RDS PostgreSQL: ~$16/month  
- ElastiCache Redis: ~$12/month
- ALB: ~$18/month
- NAT Gateway: ~$32/month
- Data transfer: ~$10-50/month
- Total: ~$120-180/month

$([char]27)[94mSupport:$([char]27)[0m
- Docs: https://docs.aws.amazon.com
- Troubleshooting: See AWS_DEPLOYMENT_GUIDE.md

"@
}

# Show menu
function Show-Menu {
    Clear-Host
    Write-Host @"
╔════════════════════════════════════════╗
║  Optileno AWS Deployment              ║
║  Windows PowerShell                    ║
╚════════════════════════════════════════╝

What would you like to do?

1) Build and push Docker images to ECR
2) Create ECR repositories
3) Create AWS Secrets
4) Deploy CloudFormation stack
5) All of the above
6) Exit

"@
    
    $choice = Read-Host "Enter choice (1-6)"
    return $choice
}

# Main script
function Main {
    Write-Info "AWS Region: $AwsRegion"
    Write-Info "AWS Account: $(Get-AwsAccountId)"
    
    Test-Prerequisites
    
    if ($Action -eq "All") {
        Show-Menu
        $choice = $LASTEXITCODE
    } else {
        $choice = $Action
    }
    
    switch ($choice) {
        "1" {
            Build-AndPushImages
        }
        "2" {
            New-EcrRepositories
        }
        "3" {
            New-AwsSecrets
        }
        "4" {
            Deploy-CloudFormation
        }
        "5" {
            New-EcrRepositories
            Build-AndPushImages
            New-AwsSecrets
            Deploy-CloudFormation
        }
        "6" {
            Write-Info "Exiting..."
            exit 0
        }
        default {
            Write-Error "Invalid choice"
            exit 1
        }
    }
    
    Show-NextSteps
}

# Run main
Main
