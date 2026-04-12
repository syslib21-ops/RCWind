@echo off
cd /d "%~dp0"
REM 8080은 다른 프로그램·Windows 예약과 충돌하면 WinError 10013이 납니다. 필요하면 set PORT=8080 등으로 바꾸세요.
if "%PORT%"=="" set PORT=8765
echo Starting http://127.0.0.1:%PORT% ...
python -m uvicorn serve:app --host 127.0.0.1 --port %PORT% --reload
pause
