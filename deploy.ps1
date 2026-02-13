# Deploy Script for Windows Users
# Instructions:
# 1. Update $ServerIP with your VPS IP address
# 2. Update $User with your VPS username (usually root)
# 3. Use an SSH Key (recommended) or type password when prompted

$ServerIP = "<YOUR_SERVER_IP_HERE>"
$User = "root"
$RemotePath = "/root/optileno"

Write-Host "Starting deployment to $ServerIP..." -ForegroundColor Cyan

# Check if scp is available
if (-not (Get-Command "scp" -ErrorAction SilentlyContinue)) {
    Write-Error "SCP command not found. Please install OpenSSH Client (Settings > Apps > Optional Features)."
    exit 1
}

# Create remote directory
Write-Host "Creating remote directory..."
ssh $User@$ServerIP "mkdir -p $RemotePath"

# Upload files
Write-Host "Uploading Backend..."
scp -r ./backend $User@$ServerIP:$RemotePath

Write-Host "Uploading Frontend..."
scp -r ./frontend $User@$ServerIP:$RemotePath

Write-Host "Uploading Configs..."
scp ./docker-compose.prod.yml $User@$ServerIP:$RemotePath
scp ./nginx.prod.conf $User@$ServerIP:$RemotePath

Write-Host "---------------------------------------------------" -ForegroundColor Green
Write-Host "Upload Complete!" -ForegroundColor Green
Write-Host "Next Steps:"
Write-Host "1. SSH into your server: ssh $User@$ServerIP"
Write-Host "2. Go to directory: cd $RemotePath"
Write-Host "3. Create/Edit .env file: nano .env"
Write-Host "4. Start Docker: docker compose -f docker-compose.prod.yml up -d --build"
Write-Host "---------------------------------------------------" -ForegroundColor Green
