#!/usr/bin/env bash
# CoolTerminal 生产环境部署脚本 - Linux/macOS
set -euo pipefail

APP_NAME="CoolTerminal"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$APP_DIR/.venv"
PORT=5001
LOG_DIR="$APP_DIR/logs"
PID_FILE="$APP_DIR/.pid"

# 颜色
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✅ $*${NC}"; }
warn() { echo -e "  ${YELLOW}⚠️  $*${NC}"; }
err()  { echo -e "  ${RED}❌ $*${NC}"; }
info() { echo -e "  ${CYAN}$*${NC}"; }

echo ""
echo -e "${CYAN} ╔══════════════════════════════════════════╗"
echo -e " ║     CoolTerminal 生产环境部署             ║"
echo -e " ╚══════════════════════════════════════════╝${NC}"
echo ""

ACTION="${1:-start}"

# ── 工具函数 ──────────────────────────────────────

find_python() {
    for cmd in python3 python3.12 python3.11 python3.10 python3.9 python3.8 python; do
        if command -v "$cmd" &>/dev/null; then
            local ver
            ver=$("$cmd" -c "import sys; print(sys.version_info[:2] >= (3,8))" 2>/dev/null)
            if [ "$ver" = "True" ]; then
                echo "$cmd"; return 0
            fi
        fi
    done
    return 1
}

is_running() {
    [ -f "$PID_FILE" ] || return 1
    local pid
    pid=$(cat "$PID_FILE")
    kill -0 "$pid" 2>/dev/null
}

get_pid() {
    [ -f "$PID_FILE" ] && cat "$PID_FILE" || echo ""
}

# ── START ─────────────────────────────────────────

do_start() {
    if is_running; then
        warn "服务已在运行 (PID: $(get_pid))"
        info "使用 ./start.sh restart 重启"
        exit 0
    fi

    # 1. 检查 Python
    info "[1/5] 检查 Python..."
    PYTHON=$(find_python) || { err "未找到 Python 3.8+，请先安装"; exit 1; }
    ok "$($PYTHON --version)"

    # 2. 虚拟环境
    info "[2/5] 准备虚拟环境..."
    if [ ! -f "$VENV_DIR/bin/activate" ]; then
        info "     创建虚拟环境..."
        "$PYTHON" -m venv "$VENV_DIR"
    fi
    # shellcheck disable=SC1091
    source "$VENV_DIR/bin/activate"
    ok "虚拟环境已激活 ($VENV_DIR)"

    # 3. 安装依赖
    info "[3/5] 安装依赖..."
    pip install -r "$APP_DIR/requirements.txt" -q --disable-pip-version-check
    ok "依赖已就绪"

    # 4. 检查端口
    info "[4/5] 检查端口 $PORT..."
    if lsof -iTCP:"$PORT" -sTCP:LISTEN -t &>/dev/null 2>&1 || \
       ss -tlnp "sport = :$PORT" 2>/dev/null | grep -q ":$PORT"; then
        err "端口 $PORT 已被占用，修改脚本顶部 PORT 变量"
        exit 1
    fi
    ok "端口 $PORT 可用"

    # 5. 启动
    info "[5/5] 启动服务..."
    mkdir -p "$LOG_DIR"
    local log_file="$LOG_DIR/coolterminal_$(date +%Y%m%d).log"

    nohup "$VENV_DIR/bin/python" "$APP_DIR/main.py" "$PORT" \
        >> "$log_file" 2>&1 &
    local svc_pid=$!
    echo "$svc_pid" > "$PID_FILE"

    # 等待确认启动
    local retries=10
    while [ $retries -gt 0 ]; do
        sleep 0.5
        if kill -0 "$svc_pid" 2>/dev/null; then
            # 检查端口是否已监听
            if lsof -iTCP:"$PORT" -sTCP:LISTEN -t &>/dev/null 2>/dev/null || \
               ss -tlnp 2>/dev/null | grep -q ":$PORT"; then
                break
            fi
        else
            err "进程启动后立即退出，查看日志: $log_file"
            rm -f "$PID_FILE"
            exit 1
        fi
        retries=$((retries - 1))
    done

    echo ""
    echo -e "${GREEN} ╔══════════════════════════════════════════╗"
    echo -e " ║  ✅ CoolTerminal 已启动                  ║"
    echo -e " ║                                          ║"
    echo -e " ║  地址: http://localhost:${PORT}              ║"
    echo -e " ║  PID:  ${svc_pid}                               ║"
    echo -e " ║  日志: logs/                              ║"
    echo -e " ╚══════════════════════════════════════════╝${NC}"
    echo ""
}

# ── STOP ──────────────────────────────────────────

do_stop() {
    if ! is_running; then
        warn "服务未运行"
        rm -f "$PID_FILE"
        return 0
    fi
    local pid
    pid=$(get_pid)
    info "停止服务 (PID: $pid)..."
    kill "$pid" 2>/dev/null || true
    # 等待最多5秒
    local i=0
    while kill -0 "$pid" 2>/dev/null && [ $i -lt 10 ]; do
        sleep 0.5; i=$((i+1))
    done
    if kill -0 "$pid" 2>/dev/null; then
        warn "进程未响应，强制终止..."
        kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
    ok "服务已停止"
}

# ── RESTART ───────────────────────────────────────

do_restart() {
    do_stop
    sleep 1
    do_start
}

# ── STATUS ────────────────────────────────────────

do_status() {
    echo "  $APP_NAME 状态:"
    if is_running; then
        ok "运行中 (PID: $(get_pid))"
        info "地址: http://localhost:$PORT"
        # 显示内存占用
        local pid
        pid=$(get_pid)
        if command -v ps &>/dev/null; then
            local mem
            mem=$(ps -o rss= -p "$pid" 2>/dev/null | awk '{printf "%.1f MB", $1/1024}')
            info "内存: $mem"
        fi
    else
        warn "未运行"
        rm -f "$PID_FILE"
    fi
}

# ── LOGS ──────────────────────────────────────────

do_logs() {
    if [ ! -d "$LOG_DIR" ]; then
        warn "暂无日志目录"
        return 0
    fi
    local latest
    latest=$(ls -t "$LOG_DIR"/*.log 2>/dev/null | head -1)
    if [ -z "$latest" ]; then
        warn "暂无日志文件"
        return 0
    fi
    info "最新日志: $latest"
    echo "  ─────────────────────────────────────────"
    tail -50 "$latest"
}

# ── 入口 ──────────────────────────────────────────

case "$ACTION" in
    start)   do_start   ;;
    stop)    do_stop    ;;
    restart) do_restart ;;
    status)  do_status  ;;
    logs)    do_logs    ;;
    *)
        echo "用法: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
