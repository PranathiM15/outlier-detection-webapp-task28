@echo off
setlocal
cd /d "%~dp0"
echo.
echo ================================================
echo   SPECTRA - Outlier Detection Web App
echo ================================================
echo.
echo If the browser does not open automatically, visit:
echo http://localhost:8000
start "SPECTRA Outlier Lab" http://localhost:8000
py -m http.server 8000
if errorlevel 1 (
  echo.
  echo Could not start the server. Check that Python is installed and port 8000 is free.
  pause
)
endlocal
