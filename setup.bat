@echo off
echo.
echo ========================================
echo   Supabase Uploader - Setup
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Minimum version: 14.0.0
    echo.
    pause
    exit /b 1
)

echo [INFO] Node.js version:
node --version
echo.

REM Install dependencies
echo [INFO] Installing dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [INFO] Checking for .env file...
if not exist ".env" (
    echo [WARNING] .env file not found!
    echo.
    echo Creating .env from env.example...
    if exist "env.example" (
        copy env.example .env >nul
        echo [SUCCESS] .env file created!
        echo.
        echo [IMPORTANT] Please edit .env and add your Supabase credentials:
        echo   - SUPABASE_URL
        echo   - SUPABASE_KEY
        echo   - SUPABASE_BUCKET (optional)
        echo.
    ) else (
        echo [ERROR] env.example not found!
    )
) else (
    echo [SUCCESS] .env file exists
)

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Usage:
echo   - Interactive mode: supabase-uploader-interactive.bat
echo   - CLI mode: supabase-uploader.bat [arguments]
echo.
echo Examples:
echo   supabase-uploader.bat file.pdf
echo   supabase-uploader.bat --list
echo   supabase-uploader.bat --download path/to/file.pdf
echo.
pause
