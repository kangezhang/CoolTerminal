@echo off
REM CoolTerminal 启动脚本 - Windows
chcp 65001 >nul

echo ======================================
echo     CoolTerminal 启动器
echo ======================================
echo.

REM 检查 Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误：未找到 Python
    echo 请安装 Python 3.8 或更高版本
    echo 下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM 显示 Python 版本
for /f "tokens=*" %%i in ('python --version') do set PY_VERSION=%%i
echo 🐍 使用: %PY_VERSION%

REM 检查依赖
echo 📦 检查依赖...
python -c "import flask" >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  未安装 Flask，正在安装依赖...
    python -m pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
)

echo ✅ 依赖检查完成
echo.

REM 启动服务器
echo 🚀 启动 CoolTerminal...
python main.py

REM 捕获退出状态
if %errorlevel% neq 0 (
    echo.
    echo ❌ 服务器异常退出
    pause
    exit /b 1
)
