@echo off
REM CoolTerminal 生产环境部署脚本 - Windows
chcp 65001 >nul
setlocal EnableDelayedExpansion

set APP_NAME=CoolTerminal
set APP_DIR=%~dp0
set VENV_DIR=%APP_DIR%.venv
set PORT=5001
set LOG_DIR=%APP_DIR%logs
set PID_FILE=%APP_DIR%.pid

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║     CoolTerminal 生产环境部署             ║
echo  ╚══════════════════════════════════════════╝
echo.

REM ── 解析参数 ──────────────────────────────────
set ACTION=start
if "%1"=="stop"    set ACTION=stop
if "%1"=="restart" set ACTION=restart
if "%1"=="status"  set ACTION=status
if "%1"=="logs"    set ACTION=logs

if "%ACTION%"=="stop"    goto :do_stop
if "%ACTION%"=="restart" goto :do_restart
if "%ACTION%"=="status"  goto :do_status
if "%ACTION%"=="logs"    goto :do_logs

REM ── START ─────────────────────────────────────
:do_start

REM 检查是否已在运行
if exist "%PID_FILE%" (
    set /p OLD_PID=<"%PID_FILE%"
    tasklist /FI "PID eq !OLD_PID!" 2>nul | find "!OLD_PID!" >nul
    if !errorlevel! equ 0 (
        echo  ⚠️  服务已在运行 (PID: !OLD_PID!)
        echo  使用 start.bat restart 重启
        exit /b 0
    ) else (
        del "%PID_FILE%" >nul 2>&1
    )
)

REM 检查 Python
echo  [1/5] 检查 Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ❌ 未找到 Python，请安装 Python 3.8+
    echo     下载: https://www.python.org/downloads/
    pause & exit /b 1
)
for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PY_VER=%%i
echo  ✅ %PY_VER%

REM 创建/激活虚拟环境
echo  [2/5] 准备虚拟环境...
if not exist "%VENV_DIR%\Scripts\activate.bat" (
    echo      创建虚拟环境...
    python -m venv "%VENV_DIR%"
    if !errorlevel! neq 0 (
        echo  ❌ 虚拟环境创建失败
        pause & exit /b 1
    )
)
call "%VENV_DIR%\Scripts\activate.bat"
echo  ✅ 虚拟环境已激活

REM 安装/更新依赖
echo  [3/5] 安装依赖...
pip install -r "%APP_DIR%requirements.txt" -q --disable-pip-version-check
if %errorlevel% neq 0 (
    echo  ❌ 依赖安装失败，尝试详细输出:
    pip install -r "%APP_DIR%requirements.txt"
    pause & exit /b 1
)
echo  ✅ 依赖已就绪

REM 检查端口占用
echo  [4/5] 检查端口 %PORT%...
netstat -ano | find ":%PORT% " | find "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo  ⚠️  端口 %PORT% 已被占用
    echo     可修改脚本顶部 PORT 变量使用其他端口
    pause & exit /b 1
)
echo  ✅ 端口 %PORT% 可用

REM 创建日志目录
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM 启动服务（后台）
echo  [5/5] 启动服务...
set LOG_FILE=%LOG_DIR%\coolterminal_%date:~0,4%%date:~5,2%%date:~8,2%.log
start /B "" python "%APP_DIR%main.py" %PORT% >> "%LOG_FILE%" 2>&1

REM 等待启动并获取 PID
timeout /t 2 /nobreak >nul
for /f "tokens=5" %%p in ('netstat -ano ^| find ":%PORT% " ^| find "LISTENING"') do (
    echo %%p > "%PID_FILE%"
    set SVC_PID=%%p
)

if defined SVC_PID (
    echo.
    echo  ╔══════════════════════════════════════════╗
    echo  ║  ✅ CoolTerminal 已启动                  ║
    echo  ║                                          ║
    echo  ║  地址: http://localhost:%PORT%              ║
    echo  ║  PID:  !SVC_PID!                            ║
    echo  ║  日志: logs\                              ║
    echo  ╚═���════════════════════════════════════════╝
    echo.
) else (
    echo  ❌ 启动失败，查看日志: %LOG_FILE%
    pause & exit /b 1
)
goto :eof

REM ── STOP ──────────────────────────────────────
:do_stop
echo  停止 %APP_NAME%...
if not exist "%PID_FILE%" (
    echo  ⚠️  未找到 PID 文件，服务可能未运行
    goto :eof
)
set /p STOP_PID=<"%PID_FILE%"
taskkill /PID %STOP_PID% /F >nul 2>&1
if %errorlevel% equ 0 (
    del "%PID_FILE%" >nul 2>&1
    echo  ✅ 服务已停止 (PID: %STOP_PID%)
) else (
    echo  ⚠️  进程不存在，清理 PID 文件
    del "%PID_FILE%" >nul 2>&1
)
goto :eof

REM ── RESTART ───────────────────────────────────
:do_restart
call "%~f0" stop
timeout /t 1 /nobreak >nul
call "%~f0" start
goto :eof

REM ── STATUS ────────────────────────────────────
:do_status
echo  %APP_NAME% 状态:
if not exist "%PID_FILE%" (
    echo  ● 未运行
    goto :eof
)
set /p CHK_PID=<"%PID_FILE%"
tasklist /FI "PID eq %CHK_PID%" 2>nul | find "%CHK_PID%" >nul
if %errorlevel% equ 0 (
    echo  ● 运行中 (PID: %CHK_PID%)
    echo  ● 地址:  http://localhost:%PORT%
) else (
    echo  ● 已停止 (残留 PID 文件)
    del "%PID_FILE%" >nul 2>&1
)
goto :eof

REM ── LOGS ──────────────────────────────────────
:do_logs
if not exist "%LOG_DIR%" (
    echo  暂无日志
    goto :eof
)
REM 显示最新日志文件的最后50行
for /f "delims=" %%f in ('dir /b /o-d "%LOG_DIR%\*.log" 2^>nul') do (
    echo  最新日志: %LOG_DIR%\%%f
    echo  ─────────────────────────────────────────
    powershell -Command "Get-Content '%LOG_DIR%\%%f' -Tail 50"
    goto :eof
)
echo  暂无日志文件
goto :eof
