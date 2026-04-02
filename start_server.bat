@echo off
echo Starting TransitPro Backend Server...
echo Please leave this black console window OPEN while using the application!
echo.

start http://localhost:5000
python app.py

pause
