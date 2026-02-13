
Write-Host "🚀 Preparing backend deployment..." -ForegroundColor Cyan

# Check if git is available
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git is not installed or not in PATH."
    exit 1
}

# Add all changes
Write-Host "📦 Staging changes..."
git add .

# Commit
Write-Host "💾 Committing changes..."
git commit -m "chore: optimize backend deployment configuration for Railway and Docker"

# Push
Write-Host "⬆️ Pushing to remote..."
git push

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Changes pushed successfully!" -ForegroundColor Green
    Write-Host "PLEASE ENSURE RAILWAY SETTINGS ARE CORRECT:" -ForegroundColor Yellow
    Write-Host "1. Root Directory: / (Empty)"
    Write-Host "2. Dockerfile Path: backend/Dockerfile"
    Write-Host "3. Environment Variables: PORT=8000, DATABASE_URL, REDIS_URL, SECRET_KEY"
}
else {
    Write-Error "❌ Failed to push changes. Please check your git configuration."
}
