@echo off
REM CoolTerminal 安装包构建脚本
chcp 65001 >nul
setlocal EnableDelayedExpansion

set APP_DIR=%~dp0
set VENV_DIR=%APP_DIR%.venv

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║     CoolTerminal 安装包构建               ║
echo  ╚══════════════════════════════════════════╝
echo.

REM ── [1/6] 检查 Python ─────────────────────────
echo  [1/6] 检查 Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: 未找到 Python，请安装 Python 3.8+
    pause & exit /b 1
)
for /f "tokens=*" %%i in ('python --version 2^>^&1') do echo  OK: %%i

REM ── [2/6] 准备虚拟环境 ────────────────────────
echo  [2/6] 准备虚拟环境...
if not exist "%VENV_DIR%\Scripts\activate.bat" (
    python -m venv "%VENV_DIR%"
    if !errorlevel! neq 0 ( echo  ERROR: 虚拟环境创建失败 & pause & exit /b 1 )
)
call "%VENV_DIR%\Scripts\activate.bat"

pip install -r "%APP_DIR%requirements.txt" -q --disable-pip-version-check
if %errorlevel% neq 0 ( echo  ERROR: Python 依赖安装失败 & pause & exit /b 1 )

pip install pyinstaller -q --disable-pip-version-check
if %errorlevel% neq 0 ( echo  ERROR: PyInstaller 安装失败 & pause & exit /b 1 )
echo  OK: Python 环境就绪

REM ── [3/6] PyInstaller 打包 Python 后端 ────────
echo  [3/6] 打包 Python 后端 (PyInstaller)...
if exist "%APP_DIR%dist\server" rmdir /s /q "%APP_DIR%dist\server"
if not exist "%APP_DIR%build" mkdir "%APP_DIR%build"

pyinstaller ^
    --name coolterminal_server ^
    --distpath "%APP_DIR%dist\server" ^
    --workpath "%APP_DIR%build\pyinstaller" ^
    --specpath "%APP_DIR%build" ^
    --onedir ^
    --noconsole ^
    --icon "%APP_DIR%assets\icon_terminal.ico" ^
    --add-data "%APP_DIR%static;static" ^
    --add-data "%APP_DIR%templates;templates" ^
    --add-data "%APP_DIR%assets;assets" ^
    --hidden-import flask_socketio ^
    --hidden-import engineio ^
    --hidden-import socketio ^
    --hidden-import engineio.async_drivers.threading ^
    --hidden-import dns ^
    --hidden-import dns.resolver ^
    --collect-all flask_socketio ^
    --collect-all engineio ^
    --collect-all socketio ^
    "%APP_DIR%main.py" > "%APP_DIR%build\pyinstaller.log" 2>&1

if %errorlevel% neq 0 (
    echo  ERROR: PyInstaller 打包失败，查看 build\pyinstaller.log
    echo  --- 最后20行日志 ---
    powershell -Command "Get-Content '%APP_DIR%build\pyinstaller.log' -Tail 20"
    pause & exit /b 1
)

if not exist "%APP_DIR%dist\server\coolterminal_server\coolterminal_server.exe" (
    echo  ERROR: 未找到生成的 exe，PyInstaller 可能失败
    pause & exit /b 1
)
echo  OK: Python 后端打包完成

REM ── [4/6] 检查 Node.js ────────────────────────
echo  [4/6] 检查 Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: 未找到 Node.js，请安装 Node.js 16+
    pause & exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo  OK: Node.js %%i

REM ── [5/6] 安装 npm 依赖 ───────────────────────
echo  [5/6] 安装 npm 依赖...
cd /d "%APP_DIR%"
if not exist "node_modules\electron" (
    npm install
    if !errorlevel! neq 0 ( echo  ERROR: npm install 失败 & pause & exit /b 1 )
)
echo  OK: npm 依赖就绪

REM ── [6/6] electron-builder 打包 ───────────────
echo  [6/6] 构建 Windows 安装包...
npm run build:win
if %errorlevel% neq 0 (
    echo  ERROR: electron-builder 构建失败
    pause & exit /b 1
)

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║  构建完成！安装包位置: dist\              ║
echo  ╚══════════════════════════════════════════╝
echo.
dir /b "%APP_DIR%dist\*.exe" 2>nul
dir /b "%APP_DIR%dist\*.msi" 2>nul
echo.
pause
