# 📥 Install Git on Windows

## Quick Installation

### Option 1: Download Git for Windows (Recommended)

1. **Download Git**:
   - Go to: https://git-scm.com/download/win
   - Click the download button (it will auto-detect 64-bit or 32-bit)
   - Or direct link: https://github.com/git-for-windows/git/releases/latest

2. **Install Git**:
   - Run the downloaded `.exe` file
   - Click "Next" through the installation
   - **Important**: Keep default options (they're fine)
   - Click "Install"
   - Wait for installation to complete

3. **Verify Installation**:
   - Close and reopen PowerShell
   - Run: `git --version`
   - You should see: `git version 2.x.x`

### Option 2: Install via Winget (If Available)

If you have Windows Package Manager:

```powershell
winget install --id Git.Git -e --source winget
```

### Option 3: Install via Chocolatey (If Available)

If you have Chocolatey:

```powershell
choco install git
```

## After Installation

1. **Close and reopen PowerShell** (important!)
2. **Verify Git works**:
   ```powershell
   git --version
   ```

3. **Configure Git** (first time only):
   ```powershell
   git config --global user.name "Your Name"
   git config --global user.email "your.email@example.com"
   ```

## Then Continue with GitHub Setup

Once Git is installed, you can continue with:
- See `QUICK_GITHUB_SETUP.md` for next steps

---

**Troubleshooting**: If Git still doesn't work after installation:
1. Restart your computer
2. Or add Git to PATH manually:
   - Git is usually installed at: `C:\Program Files\Git\cmd`
   - Add this to your system PATH
