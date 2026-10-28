@echo off
setlocal
cd /d "%~dp0"
echo SPECTRA - Employee Salary Outlier Analysis
echo.
py outlier_detector.py datasets\employee_salary.csv --column Salary_INR
if errorlevel 1 (
  echo.
  echo If a package is missing, run: py -m pip install -r requirements.txt
  pause
  exit /b 1
)
echo.
echo Results are saved in the output folder.
pause
endlocal
