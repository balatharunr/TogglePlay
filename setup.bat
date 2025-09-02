@echo off
echo TogglePlay Extension - Quick Setup Guide
echo ========================================
echo.
echo 1. Create icon files in the icons/ folder:
echo    - icon16.png (16x16 pixels)
echo    - icon32.png (32x32 pixels)
echo    - icon48.png (48x48 pixels)
echo    - icon128.png (128x128 pixels)
echo.
echo 2. Load extension in Microsoft Edge:
echo    - Open Edge and go to edge://extensions/
echo    - Enable "Developer mode" toggle
echo    - Click "Load unpacked" button
echo    - Select this folder: %~dp0
echo.
echo 3. Test the extension:
echo    - Open 2+ YouTube video tabs
echo    - Click the TogglePlay extension icon
echo    - Select a secondary tab to pair
echo    - Play/pause videos to test synchronization
echo.
echo Press any key to open Edge extensions page...
pause > nul
start msedge.exe "edge://extensions/"
