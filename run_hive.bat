@echo off
title H.I.V.E. Orchestration Suite
echo ==========================================================
echo           INITIALIZING H.I.V.E. CORE SYSTEMS             
echo ==========================================================

:: 1. Initialize Ollama Service
echo [1/3] Launching Ollama Engine background loop...
:: Start Ollama app if it isn't running
start "" "C:\Users\LIYANA\AppData\Local\Programs\Ollama\ollama app.exe"
:: Alternatively, pull/verify the model explicitly in the background
start /b ollama run llama3.1

timeout /t 3 >nul

:: 2. Launch FastAPI Backend
echo [2/3] Activating Python Virtual Environment & Backend Gateway...
cd /d C:\Users\LIYANA\Desktop\H.I.V.E\backend
:: Check if venv exists and activate it, adjust name (.venv / venv) if necessary
if exist .venv\Scripts\activate.bat (
    call .venv\Scripts\activate.bat
) else if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)
:: Start the backend in a separate background process so it doesn't block the script
start "H.I.V.E. Backend Server" cmd /k "uvicorn main:app --reload --port 8000"

timeout /t 2 >nul

:: 3. Launch React Frontend
echo [3/3] Deploying React Frontend UI Matrix...
cd /d C:\Users\LIYANA\Desktop\H.I.V.E\frontend
:: Run development server in a separate window
start "H.I.V.E. Frontend Matrix" cmd /k "npm run dev"

echo ==========================================================
echo  SUCCESS: All H.I.V.E nodes are streaming online.
echo  Press any key to minimize this management log hub.
echo ==========================================================
pause >nul
