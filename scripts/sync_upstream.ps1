# ========================================
# Auto Sync Upstream Repository Script (PowerShell)
# ========================================

$ErrorActionPreference = "Stop"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Auto Sync Upstream Updates" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if in git repository
if (-not (Test-Path ".git")) {
    Write-Host "[ERROR] Not a git repository" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory"
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if upstream remote exists
$remotes = git remote
if ($remotes -notcontains "upstream") {
    Write-Host "[INFO] Upstream remote not found, adding now..." -ForegroundColor Yellow
    git remote add upstream https://github.com/ZhuLinsen/daily_stock_analysis.git
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to add upstream remote" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "[OK] Upstream remote added successfully`n" -ForegroundColor Green
}

# Display current branch
$currentBranch = git branch --show-current
Write-Host "Current branch: $currentBranch`n" -ForegroundColor Green

# Check for uncommitted changes
$hasChanges = (git diff --quiet) -eq $false
if ($hasChanges) {
    Write-Host "[WARNING] You have uncommitted changes" -ForegroundColor Yellow
    Write-Host "`nOptions:" -ForegroundColor Yellow
    Write-Host "  1. Commit changes first (recommended)" -ForegroundColor White
    Write-Host "  2. Stash changes temporarily" -ForegroundColor White
    Write-Host "  3. Continue anyway (may cause conflicts)" -ForegroundColor White
    Write-Host "  4. Exit" -ForegroundColor White
    
    $choice = Read-Host "`nEnter your choice (1-4)"
    
    switch ($choice) {
        "1" {
            Write-Host "`nPlease commit your changes and run this script again" -ForegroundColor Yellow
            Read-Host "Press Enter to exit"
            exit 0
        }
        "2" {
            Write-Host "`nStashing changes..." -ForegroundColor Yellow
            git stash
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[ERROR] Failed to stash changes" -ForegroundColor Red
                Read-Host "Press Enter to exit"
                exit 1
            }
            $stashed = $true
        }
        "3" {
            Write-Host "`nContinuing with uncommitted changes..." -ForegroundColor Yellow
        }
        "4" {
            Write-Host "`nExiting..." -ForegroundColor Yellow
            exit 0
        }
        default {
            Write-Host "[ERROR] Invalid choice" -ForegroundColor Red
            exit 1
        }
    }
}

# Fetch upstream updates
Write-Host "`nFetching upstream updates..." -ForegroundColor Cyan
git fetch upstream
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to fetch upstream updates" -ForegroundColor Red
    if ($stashed) { git stash pop }
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "[OK] Upstream updates fetched successfully`n" -ForegroundColor Green

# Show what will be merged
Write-Host "Changes to be merged:" -ForegroundColor Cyan
git log --oneline --no-decorate "$currentBranch..upstream/$currentBranch"
Write-Host ""

# Choose sync method
if ($currentBranch -eq "main") {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Select sync method:" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  1. Merge (recommended, preserves history)" -ForegroundColor White
    Write-Host "  2. Rebase (cleaner linear history)" -ForegroundColor White
    Write-Host "  3. Exit" -ForegroundColor White
    
    $method = Read-Host "`nEnter your choice (1-3)"
    
    switch ($method) {
        "3" {
            Write-Host "`nExiting..." -ForegroundColor Yellow
            if ($stashed) { git stash pop }
            Read-Host "Press Enter to exit"
            exit 0
        }
        "1" {
            Write-Host "`nMerging upstream/$currentBranch into $currentBranch..." -ForegroundColor Cyan
            git merge "upstream/$currentBranch"
        }
        "2" {
            Write-Host "`nRebasing $currentBranch onto upstream/$currentBranch..." -ForegroundColor Cyan
            git rebase "upstream/$currentBranch"
        }
        default {
            Write-Host "[ERROR] Invalid choice" -ForegroundColor Red
            if ($stashed) { git stash pop }
            Read-Host "Press Enter to exit"
            exit 1
        }
    }
} else {
    Write-Host "`nSyncing main branch first, then updating $currentBranch..." -ForegroundColor Cyan
    git checkout main
    git merge upstream/main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to sync main branch" -ForegroundColor Red
        if ($stashed) { git stash pop }
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "`nSwitching back to $currentBranch..." -ForegroundColor Cyan
    git checkout $currentBranch
    git merge main
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[ERROR] Merge/Rebase conflicts detected" -ForegroundColor Red
    Write-Host "Please resolve conflicts manually:" -ForegroundColor Yellow
    Write-Host "  1. Edit conflicted files" -ForegroundColor White
    Write-Host "  2. git add <resolved_files>" -ForegroundColor White
    Write-Host "  3. git commit (for merge) or git rebase --continue (for rebase)" -ForegroundColor White
    if ($stashed) { git stash pop }
    Read-Host "Press Enter to exit"
    exit 1
}

# Push to origin
Write-Host "`nPushing to origin..." -ForegroundColor Cyan
if ($method -eq "2") {
    git push origin $currentBranch --force-with-lease
} else {
    git push origin $currentBranch
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] Failed to push to origin" -ForegroundColor Yellow
    Write-Host "You may need to push manually later"
} else {
    Write-Host "[OK] Successfully pushed to origin" -ForegroundColor Green
}

# Restore stashed changes if any
if ($stashed) {
    Write-Host "`nRestoring stashed changes..." -ForegroundColor Cyan
    git stash pop
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[WARNING] Conflicts when restoring stashed changes" -ForegroundColor Yellow
        Write-Host "Please resolve conflicts manually"
    } else {
        Write-Host "[OK] Stashed changes restored" -ForegroundColor Green
    }
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Sync Complete!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  - Fetched updates from upstream" -ForegroundColor White
Write-Host "  - Merged/Rebased into $currentBranch" -ForegroundColor White
Write-Host "  - Pushed to origin`n" -ForegroundColor White

Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  - Test the application: python main.py --webui-only" -ForegroundColor White
Write-Host "  - Check for new dependencies: pip install -r requirements.txt" -ForegroundColor White
Write-Host "  - Rebuild frontend if needed: cd apps/dsa-web && npm run build`n" -ForegroundColor White

Read-Host "Press Enter to exit"
