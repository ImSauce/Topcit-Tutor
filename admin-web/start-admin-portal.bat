@echo off
setlocal
cd /d "%~dp0"
set "PORT=8080"

echo.
echo  TOPCIT Tutor - Admin Portal
echo  ============================================================
echo.
echo  Starting a local web server on http://localhost:%PORT%/
echo.
echo  IMPORTANT: do not open index.html by double-clicking it.
echo  Browsers block JavaScript modules on file:// addresses, so
echo  the Sign in button does nothing. The portal must be served
echo  over http://, which is what this window does.
echo.
echo  Leave this window open while you use the portal.
echo  Press Ctrl+C (or just close this window) to stop it.
echo  ============================================================
echo.

REM Open the browser a couple of seconds after the server starts.
start "" cmd /c "timeout /t 2 >nul & start "" http://localhost:%PORT%/"

where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server %PORT% --bind 127.0.0.1
  goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server %PORT% --bind 127.0.0.1
  goto :end
)

where npx >nul 2>nul
if %errorlevel%==0 (
  npx --yes http-server . -p %PORT% -c-1
  goto :end
)

echo.
echo  Could not find Python or Node.js on this machine.
echo.
echo  Install either one, or run this from the repository root instead:
echo      firebase serve --only hosting
echo.
pause

:end
endlocal
