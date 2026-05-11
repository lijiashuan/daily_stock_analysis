@echo off
REM ========================================
REM wkhtmltopdf Installation Helper (Windows)
REM ========================================

echo.
echo ========================================
echo wkhtmltopdf Installation Helper
echo ========================================
echo.

REM Check if already installed
where wkhtmltopdf >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] wkhtmltopdf is already installed
    echo.
    wkhtmltopdf --version
    echo.
    echo You can now use PDF export feature!
    pause
    exit /b 0
)

echo [INFO] wkhtmltopdf is not installed
echo.
echo Please choose installation method:
echo.
echo 1. Auto download and install (Recommended)
echo 2. Manual installation guide
echo 3. Open documentation
echo 4. Exit
echo.

set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" goto auto_install
if "%choice%"=="2" goto manual_install
if "%choice%"=="3" goto show_docs
if "%choice%"=="4" goto end
goto end

:auto_install
echo.
echo [INFO] Downloading wkhtmltopdf...
echo.
echo URL: https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-2/wkhtmltox-0.12.6.1-2.msvc2015-win64.exe
echo.
echo Note: If download fails, please try manual installation (option 2)
echo.

powershell -Command "& {Invoke-WebRequest -Uri 'https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-2/wkhtmltox-0.12.6.1-2.msvc2015-win64.exe' -OutFile 'wkhtmltox-installer.exe'}"

if exist wkhtmltox-installer.exe (
    echo [OK] Download completed
    echo.
    echo Starting installer...
    echo Please follow the installation wizard
    echo.
    start "" wkhtmltox-installer.exe
    
    echo.
    echo After installation, please restart this script to verify
    echo Or manually add wkhtmltopdf to system PATH
    echo.
    pause
) else (
    echo [ERROR] Download failed
    echo Please try manual installation (option 2)
    pause
)
goto end

:manual_install
echo.
echo [INFO] Manual Installation Steps:
echo.
echo 1. Visit: https://wkhtmltopdf.org/downloads.html
echo.
echo 2. Download Windows version
echo.
echo 3. Run the installer
echo.
echo 4. Remember installation path (usually C:\Program Files\wkhtmltopdf\)
echo.
echo 5. Add bin directory to system PATH:
echo    C:\Program Files\wkhtmltopdf\bin
echo.
echo 6. Reopen command prompt
echo.
echo 7. Verify installation:
echo    where wkhtmltopdf
echo.
pause
goto end

:show_docs
echo.
echo [INFO] Opening documentation...
echo.
if exist docs\PDF_SETUP_GUIDE.md (
    start "" docs\PDF_SETUP_GUIDE.md
) else (
    echo [ERROR] Documentation not found
    echo Please visit: https://wkhtmltopdf.org/
)
pause
goto end

:end
echo.
echo ========================================
echo Thank you for using!
echo ========================================
echo.
