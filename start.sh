#!/bin/bash
# CoolTerminal 启动脚本 - Linux/Mac

echo "======================================"
echo "    CoolTerminal 启动器"
echo "======================================"
echo ""

# 检查 Python 版本
if command -v python3 &> /dev/null; then
    PYTHON=python3
elif command -v python &> /dev/null; then
    PYTHON=python
else
    echo "❌ 错误：未找到 Python"
    echo "请安装 Python 3.8 或更高版本"
    exit 1
fi

# 显示 Python 版本
PY_VERSION=$($PYTHON --version 2>&1)
echo "🐍 使用: $PY_VERSION"

# 检查依赖
echo "📦 检查依赖..."
if ! $PYTHON -c "import flask" 2>/dev/null; then
    echo "⚠️  未安装 Flask，正在安装依赖..."
    $PYTHON -m pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
fi

echo "✅ 依赖检查完成"
echo ""

# 启动服务器
echo "🚀 启动 CoolTerminal..."
$PYTHON main.py

# 捕获退出状态
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ 服务器异常退出"
    exit 1
fi
