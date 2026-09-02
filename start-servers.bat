@echo off
REM Start both dev server and HTTPS proxy

echo.
echo ========================================
echo MetroCount PRO - Startup Script
echo ========================================
echo.

REM Start the dev server in one terminal
echo Starting development server on port 3000...
start "MetroCount PRO - Dev Server" npm run dev

REM Wait 3 seconds for dev server to start
timeout /t 3 /nobreak

REM Start HTTPS proxy in another terminal  
echo Starting HTTPS proxy on port 3443...
start "MetroCount PRO - HTTPS Proxy" node https-server.js

echo.
echo ✅ Both servers started!
echo.
echo Access the app at:
echo   HTTP:  http://192.168.155.16:3000
echo   HTTPS: https://192.168.155.16:3443 (camera will work here)
echo.
echo Note: HTTPS will show a certificate warning - this is normal
echo Press Ctrl+C in both terminal windows to stop
echo.
pause
