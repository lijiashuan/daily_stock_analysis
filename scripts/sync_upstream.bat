@echo off
REM ========================================
REM Auto Sync Upstream Repository Script
REM ========================================

echo.
echo ========================================
echo Auto Sync Upstream Updates
echo ========================================
echo.

REM Check if in git repository
if not exist .git (
    echo [ERROR] Not a git repository
    echo Please run this script from the project root directory
    pause
    exit /b 1
)

REM Check if upstream remote exists
git remote | findstr "upstream" >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Upstream remote not found, adding now...
    git remote add upstream https://github.com/ZhuLinsen/daily_stock_analysis.git
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to add upstream remote
        pause
        exit /b 1
    )
    echo [OK] Upstream remote added successfully
    echo.
)

REM Display current branch
for /f "tokens=*" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
echo Current branch: %CURRENT_BRANCH%
echo.

REM Check for uncommitted changes
git diff --quiet
if %errorlevel% neq 0 (
    echo [WARNING] You have uncommitted changes
    echo.
    echo Options:
    echo   1. Commit changes first (recommended)
    echo   2. Stash changes temporarily
    echo   3. Continue anyway (may cause conflicts)
    echo   4. Exit
    echo.
    set /p CHOICE="Enter your choice (1-4): "
    
    if "%CHOICE%"=="1" (
        echo.
        echo Please commit your changes and run this script again
        pause
        exit /b 0
    )
    if "%CHOICE%"=="2" (
        echo.
        echo Stashing changes...
        git stash
        if %errorlevel% neq 0 (
            echo [ERROR] Failed to stash changes
            pause
            exit /b 1
        )
        set STASHED=1
    )
    if "%CHOICE%"=="3" (
        echo.
        echo Continuing with uncommitted changes...
    )
    if "%CHOICE%"=="4" (
        echo.
        echo Exiting...
        pause
        exit /b 0
    )
)

REM Fetch upstream updates
echo.
echo Fetching upstream updates...
git fetch upstream
if %errorlevel% neq 0 (
    echo [ERROR] Failed to fetch upstream updates
    pause
    exit /b 1
)
echo [OK] Upstream updates fetched successfully
echo.

REM Show what will be merged
echo Changes to be merged:
git log --oneline %CURRENT_BRANCH%..upstream/%CURRENT_BRANCH%
echo.

if "%CURRENT_BRANCH%"=="main" (
    REM Choose sync method
    echo ========================================
    echo Select sync method:
    echo ========================================
    echo   1. Merge (recommended, preserves history)
    echo   2. Rebase (cleaner linear history)
    echo   3. Exit
    echo.
    set /p METHOD="Enter your choice (1-3): "
    
    if "%METHOD%"=="3" (
        echo.
        echo Exiting...
        if defined STASHED git stash pop
        pause
        exit /b 0
    )
    
    if "%METHOD%"=="1" (
        echo.
        echo Merging upstream/%CURRENT_BRANCH% into %CURRENT_BRANCH%...
        git merge upstream/%CURRENT_BRANCH%
    ) else if "%METHOD%"=="2" (
        echo.
        echo Rebasing %CURRENT_BRANCH% onto upstream/%CURRENT_BRANCH%...
        git rebase upstream/%CURRENT_BRANCH%
    ) else (
        echo [ERROR] Invalid choice
        if defined STASHED git stash pop
        pause
        exit /b 1
    )
) else (
    echo.
    echo Syncing main branch first, then updating %CURRENT_BRANCH%...
    git checkout main
    git merge upstream/main
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to sync main branch
        if defined STASHED git stash pop
        pause
        exit /b 1
    )
    echo.
    echo Switching back to %CURRENT_BRANCH%...
    git checkout %CURRENT_BRANCH%
    git merge main
)

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Merge/Rebase conflicts detected
    echo Please resolve conflicts manually:
    echo   1. Edit conflicted files
    echo   2. git add ^<resolved_files^>
    echo   3. git commit (for merge) or git rebase --continue (for rebase)
    echo.
    if defined STASHED git stash pop
    pause
    exit /b 1
)

REM Push to origin
echo.
echo Pushing to origin...
if "%METHOD%"=="2" (
    git push origin %CURRENT_BRANCH% --force-with-lease
) else (
    git push origin %CURRENT_BRANCH%
)

if %errorlevel% neq 0 (
    echo [WARNING] Failed to push to origin
    echo You may need to push manually later
) else (
    echo [OK] Successfully pushed to origin
)

REM Restore stashed changes if any
if defined STASHED (
    echo.
    echo Restoring stashed changes...
    git stash pop
    if %errorlevel% neq 0 (
        echo [WARNING] Conflicts when restoring stashed changes
        echo Please resolve conflicts manually
    ) else (
        echo [OK] Stashed changes restored
    )
)

echo.
echo ========================================
echo Sync Complete!
echo ========================================
echo.
echo Summary:
echo   - Fetched updates from upstream
echo   - Merged/Rebased into %CURRENT_BRANCH%
echo   - Pushed to origin
echo.
echo Next steps:
echo   - Test the application: python main.py --webui-only
echo   - Check for any new dependencies: pip install -r requirements.txt
echo   - Rebuild frontend if needed: cd apps/dsa-web ^&^& npm run build
echo.

pause
