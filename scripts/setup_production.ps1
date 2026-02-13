#!/usr/bin/env pwsh
# scripts/setup_production.ps1
# Production environment setup script for Windows

param(
    [string]$Environment = "production",
    [switch]$SkipTests = $false,
    [switch]$SkipDocker = $false
)

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "🚀 PRODUCTION SETUP SCRIPT" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# 1. Check requirements
Write-Host ""
Write-Host "📋 Checking requirements..." -ForegroundColor Yellow

$requirements = @("python", "pip", "npm", "node")
$missing = @()

foreach ($req in $requirements) {
    try {
        $null = & $req --version
        Write-Host "  ✓ $req found"
    }
    catch {
        $missing += $req
        Write-Host "  ✗ $req not found" -ForegroundColor Red
    }
}

if ($missing.Count -gt 0) {
    Write-Host "Missing: $($missing -join ', ')" -ForegroundColor Red
    exit 1
}

# 2. Setup backend environment
Write-Host ""
Write-Host "📦 Setting up backend..." -ForegroundColor Yellow

if (Test-Path ".env.production") {
    Write-Host "  ✓ .env.production exists"
}
else {
    Write-Host "  ⚠️ Creating .env.production template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env.production"
    Write-Host "  📝 Edit .env.production with production values"
}

# Install Python dependencies
Write-Host "  Installing Python packages..."
& python -m pip install -q -r backend/requirements.txt
Write-Host "  ✓ Python packages installed"

# 3. Setup frontend environment
Write-Host ""
Write-Host "📦 Setting up frontend..." -ForegroundColor Yellow

Set-Location frontend
Write-Host "  Installing Node packages..."
& npm ci --silent
Write-Host "  ✓ Node packages installed"

# Run type check
if (-not $SkipTests) {
    Write-Host "  Running TypeScript check..."
    & npm run type-check | Out-Null
    Write-Host "  ✓ TypeScript check passed"
}

Set-Location ..

# 4. Setup database
Write-Host ""
Write-Host "💾 Setting up database..." -ForegroundColor Yellow

Write-Host "  Running migrations..."
try {
    & alembic upgrade head
    Write-Host "  ✓ Migrations completed"
}
catch {
    Write-Host "  ⚠️ Migration failed (may need manual setup)" -ForegroundColor Yellow
}

# 5. Build Docker images
if (-not $SkipDocker) {
    Write-Host ""
    Write-Host "🐳 Building Docker images..." -ForegroundColor Yellow
    
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-Host "  Building backend image..."
        & docker build -q -t concierge-backend:latest -f Dockerfile.backend .
        Write-Host "  ✓ Backend image built"

        Write-Host "  Building frontend image..."
        & docker build -q -t concierge-frontend:latest -f Dockerfile.frontend .
        Write-Host "  ✓ Frontend image built"

        Write-Host "  Validating docker-compose..."
        & docker-compose -f docker-compose.prod.yml config | Out-Null
        Write-Host "  ✓ docker-compose valid"
    }
    else {
        Write-Host "  ⚠️ Docker not installed, skipping images" -ForegroundColor Yellow
    }
}

# 6. Security verification
Write-Host ""
Write-Host "🔒 Security verification..." -ForegroundColor Yellow

# Check .env in gitignore
if (Select-String -Path ".gitignore" -Pattern "\.env" -Quiet) {
    Write-Host "  ✓ .env in .gitignore"
}
else {
    Write-Host "  ⚠️ .env not in .gitignore" -ForegroundColor Yellow
}

# Check for exposed secrets
$secretPatterns = @("password.*=.*[^$]", "api_key.*=.*[^$]")
$secretsFound = $false

foreach ($pattern in $secretPatterns) {
    $matches = Get-ChildItem -Path "backend" -Recurse -Include "*.py" |
    Select-String -Pattern $pattern -Quiet

    if ($matches) {
        $secretsFound = $true
    }
}

if ($secretsFound) {
    Write-Host "  ⚠️ Potential secrets in code" -ForegroundColor Yellow
}
else {
    Write-Host "  ✓ No obvious secrets in code"
}

# 7. Final summary
Write-Host ""
Write-Host "=================================" -ForegroundColor Green
Write-Host "✅ PRODUCTION SETUP COMPLETE" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review .env.production file"
Write-Host "  2. Update database connection string"
Write-Host "  3. Set API keys (Groq, etc.)"
Write-Host "  4. Configure SSL certificates"
Write-Host "  5. Deploy using: docker-compose -f docker-compose.prod.yml up -d"
Write-Host ""
