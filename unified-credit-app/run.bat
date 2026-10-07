@echo off
cd /d "%~dp0"
title Unified Credit Engine Launcher
echo ========================================================
echo Starting Unified Credit Engine (Backend and Frontend)...
echo ========================================================
echo.

:: 1. Start the Backend
echo [1/2] Launching Python FastAPI Backend...
if exist "backend\.venv\Scripts\activate.bat" (
    start cmd /k "cd backend && call .venv\Scripts\activate.bat && python -u main.py"
) else (
    start cmd /k "cd backend && python -u main.py"
)

:: 2. Start the Frontend
echo [2/2] Launching React Vite Frontend...
start cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo Services are booting up in separate terminal windows!
echo Please wait a moment for the AI engines to initialize.
echo.
echo Access the website at: http://localhost:5173
echo ========================================================
