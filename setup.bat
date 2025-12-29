@echo off
REM Optional Setup Script
REM Note: Both batch files now auto-install dependencies and create .env automatically
REM This script is optional and provides a guided setup experience

echo.
echo ========================================
echo   Supabase Uploader - Optional Setup
echo ========================================
echo.
echo NOTE: The batch files now auto-install dependencies and create .env automatically.
echo This setup script is optional and provides a guided experience.
echo.
pause

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

REM Install dependencies (if not already installed)
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo [SUCCESS] Dependencies installed!
) else (
    echo [INFO] Dependencies already installed.
)
echo.

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo [INFO] Checking for .env file...
    if exist "env.example" (
        copy env.example .env >nul
        echo [SUCCESS] .env file created from env.example!
        echo.
        echo [IMPORTANT] Please edit .env and add your Supabase credentials:
        echo   - SUPABASE_URL=https://your-project.supabase.co
        echo   - SUPABASE_KEY=your-service-role-key
        echo   - SUPABASE_BUCKET=files (optional)
        echo.
    ) else (
        echo [WARNING] env.example not found! Cannot create .env automatically.
    )
) else (
    echo [INFO] .env file already exists.
)
echo.

echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo You can now use:
echo   - supabase-uploader-interactive.bat (double-click for interactive mode)
echo   - supabase-uploader.bat [arguments] (for command-line usage)
echo.
echo Examples:
echo   supabase-uploader.bat file.pdf
echo   supabase-uploader.bat --list
echo   supabase-uploader.bat --download path/to/file.pdf documents
echo.
pause
