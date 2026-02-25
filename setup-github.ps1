# PowerShell script to setup GitHub repository
# Run: .\setup-github.ps1

Write-Host "`n🚀 Setting up GitHub repository...`n" -ForegroundColor Cyan

# Check if git is installed
try {
    $gitVersion = git --version
    Write-Host "✅ Git is installed: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git is not installed. Please install Git first:" -ForegroundColor Red
    Write-Host "   Download from: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

# Check if already a git repository
if (Test-Path ".git") {
    Write-Host "⚠️  Git repository already initialized`n" -ForegroundColor Yellow
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y") {
        exit 0
    }
} else {
    # Initialize git
    Write-Host "📦 Initializing git repository...`n" -ForegroundColor Cyan
    git init
}

# Add all files
Write-Host "`n📝 Adding files to git...`n" -ForegroundColor Cyan
git add .

# Show status
Write-Host "Files to be committed:" -ForegroundColor Yellow
git status --short

# Create commit
Write-Host "`n💾 Creating initial commit...`n" -ForegroundColor Cyan
git commit -m "Initial commit: Droppsoft HR application"

Write-Host "`n✅ Local git repository ready!`n" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Go to https://github.com and create a new repository" -ForegroundColor White
Write-Host "2. Copy the repository URL" -ForegroundColor White
Write-Host "3. Run these commands:" -ForegroundColor White
Write-Host "   git remote add origin https://github.com/your-username/repo-name.git" -ForegroundColor Yellow
Write-Host "   git branch -M main" -ForegroundColor Yellow
Write-Host "   git push -u origin main" -ForegroundColor Yellow
Write-Host "`n📚 See GITHUB_TO_VERCEL.md for detailed instructions`n" -ForegroundColor Cyan
