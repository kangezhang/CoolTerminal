@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

set APP_NAME=CoolTerminal
set APP_DIR=%~dp0
set VENV_DIR=%APP_DIR%.venv
set PORT=5001
set LOG_DIR=%APP_DIR%logs
set PID_FILE=%APP_DIR%.pid

echo.
echo  +------------------------------------------+
echo  ^|     CoolTerminal  管理脚本               ^|
echo  +------------------------------------------+
echo.

REM ── 解析参数 ──────────────────────────────────
set ACTION=start
if /i "%1"=="start"     set ACTION=start
if /i "%1"=="stop"      set ACTION=stop
if /i "%1"=="restart"   set ACTION=restart
if /i "%1"=="status"    set ACTION=status
if /i "%1"=="logs"      set ACTION=logs
if /i "%1"=="open"      set ACTION=open
if /i "%1"=="build"     set ACTION=build
if /i "%1"=="deploy"    set ACTION=build
if /i "%1"=="package"   set ACTION=build
if /i "%1"=="installer" set ACTION=build
if /i "%1"=="help"      set ACTION=help
if /i "%1"=="/?"        set ACTION=help
if /i "%1"=="-h"        set ACTION=help

if "%ACTION%"=="start"   goto :do_start
if "%ACTION%"=="stop"    goto :do_stop
if "%ACTION%"=="restart" goto :do_restart
if "%ACTION%"=="status"  goto :do_status
if "%ACTION%"=="logs"    goto :do_logs
if "%ACTION%"=="open"    goto :do_open
if "%ACTION%"=="build"   goto :do_build
if "%ACTION%"=="help"    goto :do_help

if not "%~1"=="" (
    if /i not "%~1"=="start" if /i not "%~1"=="stop" if /i not "%~1"=="restart" if /i not "%~1"=="status" if /i not "%~1"=="logs" if /i not "%~1"=="open" if /i not "%~1"=="build" if /i not "%~1"=="deploy" if /i not "%~1"=="package" if /i not "%~1"=="installer" if /i not "%~1"=="help" if /i not "%~1"=="/?" if /i not "%~1"=="-h" (
        echo  [X] 未知参数: %~1
        goto :do_help
    )
)

:do_help
echo  用法:
echo    start.bat                启动服务
echo    start.bat start          启动服务
echo    start.bat stop           停止服务
echo    start.bat restart        重启服务
echo    start.bat status         查看状态
echo    start.bat logs           查看日志
echo    start.bat open           打开浏览器
echo    start.bat build          构建安装包（同 build_installer.bat）
echo    start.bat deploy         构建安装包（别名）
echo    start.bat package        构建安装包（别名）
echo.
goto :eof

REM ── START ─────────────────────────────────────
:do_start

REM 检查是否已在运行
if exist "%PID_FILE%" (
    set /p OLD_PID=<"%PID_FILE%"
    tasklist /FI "PID eq !OLD_PID!" 2>nul | find "!OLD_PID!" >nul
    if !errorlevel! equ 0 (
        echo  [^^!] 服务已在运行 ^(PID: !OLD_PID!^)
        echo      使用 start.bat restart 重启
        goto :do_open
    ) else (
        del "%PID_FILE%" >nul 2>&1
    )
)

REM (1-5) 检查 Python
echo  (1-5) 检查 Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [X] 未找到 Python，请安装 Python 3.8+
    echo      https://www.python.org/downloads/
    pause & exit /b 1
)
for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PY_VER=%%i
echo  [OK] !PY_VER!

REM (2-5) 虚拟环境
echo  (2-5) 准备虚拟环境...
if not exist "%VENV_DIR%\Scripts\python.exe" (
    echo       创建虚拟环境...
    python -m venv "%VENV_DIR%"
    if !errorlevel! neq 0 (
        echo  [X] 虚拟环境创建失败
        pause & exit /b 1
    )
)
echo  [OK] 虚拟环境就绪

REM (3-5) 安装/更新依赖
echo  (3-5) 安装依赖...
"%VENV_DIR%\Scripts\pip.exe" install -r "%APP_DIR%requirements.txt" -q --disable-pip-version-check
if %errorlevel% neq 0 (
    echo  [X] 依赖安装失败
    "%VENV_DIR%\Scripts\pip.exe" install -r "%APP_DIR%requirements.txt"
    pause & exit /b 1
)
echo  [OK] 依赖已就绪

REM (4-5) 检查端口，如占用则尝试释放旧的 CoolTerminal 进程
echo  (4-5) 检查端口 %PORT%...
netstat -ano | find ":%PORT% " | find "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo  [^^!] 端口 %PORT% 被占用，尝试释放...
    REM 找出占用端口的 PID 并杀掉
    for /f "tokens=5" %%p in ('netstat -ano ^| find ":%PORT% " ^| find "LISTENING"') do (
        taskkill /PID %%p /F >nul 2>&1
        echo  [OK] 已释放 PID %%p
    )
    timeout /t 1 /nobreak >nul
    REM 再次检查
    netstat -ano | find ":%PORT% " | find "LISTENING" >nul 2>&1
    if !errorlevel! equ 0 (
        echo  [X] 端口 %PORT% 仍被占用，请手动处理或修改脚本顶部 PORT 变量
        pause & exit /b 1
    )
)
echo  [OK] 端口 %PORT% 可用

REM (5-5) 启动服务
echo  (5-5) 启动服务...
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM 用 PowerShell 生成 ISO 格式日期，避免中文 Windows %date% 乱码
for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd"') do set TODAY=%%d
set LOG_FILE=%LOG_DIR%\coolterminal_%TODAY%.log

REM 通过环境变量传参给 launcher.vbs，避免引号嵌套
set CT_PYTHON=%VENV_DIR%\Scripts\python.exe
set CT_SCRIPT=%APP_DIR%main.py
set CT_PORT=%PORT%
set CT_LOG=%LOG_FILE%
wscript //nologo "%APP_DIR%launcher.vbs"

REM 等待进程初始化后再开始轮询
echo  等待服务就绪
timeout /t 4 /nobreak >nul

REM 健康检查：最多等 30 秒，每 1 秒轮询一次 /health
set /a RETRY=0
:health_loop
timeout /t 1 /nobreak >nul
set /a RETRY+=1
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:%PORT%/health' -TimeoutSec 3 -UseBasicParsing; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>&1
if %errorlevel% equ 0 goto :start_success
if !RETRY! lss 30 goto :health_loop

echo  [X] 服务启动超时，查看日志: %LOG_FILE%
powershell -NoProfile -Command "Get-Content -Encoding UTF8 '%LOG_FILE%' -Tail 30"
pause & exit /b 1

:start_success
REM 记录 PID
for /f "tokens=5" %%p in ('netstat -ano ^| find ":%PORT% " ^| find "LISTENING"') do (
    echo %%p > "%PID_FILE%"
    set SVC_PID=%%p
    goto :pid_done
)
:pid_done

echo.
echo  +------------------------------------------+
echo  ^|  [OK] CoolTerminal 已启动                ^|
echo  ^|                                          ^|
echo  ^|  地址: http://localhost:%PORT%              ^|
echo  ^|  PID:  !SVC_PID!                         ^|
echo  ^|  日志: logs\coolterminal_%TODAY%.log      ^|
echo  +------------------------------------------+
echo.

REM 自动打开浏览器
goto :do_open

REM ── OPEN ──────────────────────────────────────
:do_open
start "" "http://localhost:%PORT%"
goto :eof

REM ── STOP ──────────────────────────────────────
:do_stop
echo  停止 %APP_NAME%...
if not exist "%PID_FILE%" (
    echo  [^^!] 未找到 PID 文件，服务可能未运行
    goto :eof
)
set /p STOP_PID=<"%PID_FILE%"
taskkill /PID %STOP_PID% /F >nul 2>&1
if %errorlevel% equ 0 (
    del "%PID_FILE%" >nul 2>&1
    echo  [OK] 服务已停止 ^(PID: %STOP_PID%^)
) else (
    echo  [^^!] 进程不存在，清理 PID 文件
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
    echo  [*] 未运行
    goto :eof
)
set /p CHK_PID=<"%PID_FILE%"
tasklist /FI "PID eq %CHK_PID%" 2>nul | find "%CHK_PID%" >nul
if %errorlevel% equ 0 (
    echo  [*] 运行中 ^(PID: %CHK_PID%^)
    echo  [*] 地址:  http://localhost:%PORT%
) else (
    echo  [*] 已停止 ^(残留 PID 文件已清理^)
    del "%PID_FILE%" >nul 2>&1
)
goto :eof

REM ── LOGS ──────────────────────────────────────
:do_logs
if not exist "%LOG_DIR%" (
    echo  暂无日志
    goto :eof
)
for /f "delims=" %%f in ('dir /b /o-d "%LOG_DIR%\*.log" 2^>nul') do (
    echo  最新日志: %LOG_DIR%\%%f
    echo  -----------------------------------------
    powershell -NoProfile -Command "Get-Content -Encoding UTF8 '%LOG_DIR%\%%f' -Tail 50"
    goto :eof
)
echo  暂无日志文件
goto :eof

REM ── BUILD ─────────────────────────────────────
:do_build
if not exist "%APP_DIR%build_installer.bat" (
    echo  [X] 未找到 build_installer.bat，无法构建安装包
    pause & exit /b 1
)

echo  进入安装包构建流程（与 build_installer.bat 一致）...
call "%APP_DIR%build_installer.bat"
exit /b %errorlevel%
