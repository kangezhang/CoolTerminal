#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CoolTerminal - 现代化终端
Flask + SocketIO 后端 - 支持实时流式输出、stdin 交互、Ctrl+C 中断
"""

import os
import sys

# Windows 控制台强制 UTF-8，避免 emoji/中文 GBK 编码错误
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import subprocess
import platform
import threading
import signal
import shlex
from pathlib import Path
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room

# 创建 Flask 应用
app = Flask(__name__)
app.config['SECRET_KEY'] = 'coolterminal-secret-key-2024'
app.config['JSON_AS_ASCII'] = False
CORS(app)

# SocketIO（threading 模式，PyInstaller 兼容性最好）
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

VERSION = "2.0.0"

# ============ 终端会话管理 ============
# 每个终端标签对应一个独立的会话，维护独立的 cwd 和进程
class TerminalSession:
    def __init__(self, session_id):
        self.session_id = session_id
        self.cwd = os.path.expanduser('~')
        self.process = None          # 当前运行的子进程
        self.process_lock = threading.Lock()

    def kill_process(self):
        """终止当前进程（Ctrl+C）"""
        with self.process_lock:
            if self.process and self.process.poll() is None:
                try:
                    if platform.system() == 'Windows':
                        self.process.send_signal(signal.CTRL_C_EVENT)
                    else:
                        self.process.send_signal(signal.SIGINT)
                except Exception:
                    try:
                        self.process.terminate()
                    except Exception:
                        pass

    def is_running(self):
        with self.process_lock:
            return self.process is not None and self.process.poll() is None

# 全局会话字典 {session_id: TerminalSession}
sessions: dict[str, TerminalSession] = {}
sessions_lock = threading.Lock()

def get_or_create_session(session_id: str) -> TerminalSession:
    with sessions_lock:
        if session_id not in sessions:
            sessions[session_id] = TerminalSession(session_id)
        return sessions[session_id]

def remove_session(session_id: str):
    with sessions_lock:
        if session_id in sessions:
            sess = sessions.pop(session_id)
            sess.kill_process()

# ============ 跨平台工具函数 ============

def get_platform_info():
    system = platform.system()
    return {
        'system': system,
        'is_windows': system == 'Windows',
        'is_mac': system == 'Darwin',
        'is_linux': system == 'Linux',
        'version': platform.version(),
        'machine': platform.machine(),
        'python_version': platform.python_version()
    }

def get_shell_for_platform():
    system = platform.system()
    if system == 'Windows':
        if os.path.exists(r'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'):
            return 'powershell'
        return 'cmd'
    elif system == 'Darwin':
        return os.environ.get('SHELL', '/bin/zsh')
    else:
        return os.environ.get('SHELL', '/bin/bash')

def is_dangerous_command(command: str) -> bool:
    """精确匹配危险命令，避免误杀正常命令"""
    import re
    dangerous_patterns = [
        r'\brm\s+-rf\s+/',
        r'\brm\s+-rf\s+\*',
        r'\bdel\s+/f\s+/s\s+/q\s+[a-zA-Z]:\\',
        r'\bformat\s+[a-zA-Z]:',       # 只匹配 format C: 这种形式
        r'\bshutdown\b',
        r'\breboot\b',
        r'\binit\s+[06]\b',
        r':\(\)\{:\|:&\};:',           # fork bomb
        r'\bmkfs\b',
        r'\bdd\s+if=/dev/zero',
        r'>\s*/dev/sda',
    ]
    cmd = command.strip()
    for pattern in dangerous_patterns:
        if re.search(pattern, cmd, re.IGNORECASE):
            return True
    return False

def get_tab_completions(partial: str, cwd: str) -> list:
    """获取 Tab 补全候选列表"""
    try:
        parts = partial.split(' ')
        if len(parts) == 1:
            # 补全命令名
            prefix = parts[0]
            candidates = []
            # 从 PATH 中找可执行文件
            for path_dir in os.environ.get('PATH', '').split(os.pathsep):
                try:
                    for f in os.listdir(path_dir):
                        if f.lower().startswith(prefix.lower()):
                            candidates.append(f)
                except Exception:
                    pass
            # 也补全当前目录下的文件
            try:
                for f in os.listdir(cwd):
                    if f.lower().startswith(prefix.lower()):
                        candidates.append(f)
            except Exception:
                pass
            return sorted(set(candidates))[:20]
        else:
            # 补全路径参数
            prefix = parts[-1]
            base_dir = cwd
            if os.sep in prefix or '/' in prefix:
                base_dir = os.path.dirname(os.path.join(cwd, prefix))
                prefix = os.path.basename(prefix)
            try:
                candidates = []
                for f in os.listdir(base_dir):
                    if f.lower().startswith(prefix.lower()):
                        full = os.path.join(base_dir, f)
                        candidates.append(f + ('/' if os.path.isdir(full) else ''))
                return sorted(candidates)[:20]
            except Exception:
                return []
    except Exception:
        return []

# ============ HTTP 路由 ============

@app.route('/')
def index():
    return render_template('index.html', version=VERSION, active_tab='terminal')

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'version': VERSION,
        'platform': platform.system(),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/terminal/platform', methods=['GET'])
def terminal_platform():
    try:
        info = get_platform_info()
        info['shell'] = get_shell_for_platform()
        return jsonify({'success': True, 'data': info})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/terminal/sysinfo', methods=['GET'])
def terminal_sysinfo():
    try:
        try:
            import psutil
            has_psutil = True
        except ImportError:
            has_psutil = False

        info = get_platform_info()

        if has_psutil:
            info['cpu'] = {'count': psutil.cpu_count(), 'percent': psutil.cpu_percent(interval=1)}
            memory = psutil.virtual_memory()
            info['memory'] = {
                'total_gb': round(memory.total / (1024**3), 2),
                'available_gb': round(memory.available / (1024**3), 2),
                'percent': memory.percent
            }
            disk = psutil.disk_usage('/')
            info['disk'] = {
                'total_gb': round(disk.total / (1024**3), 2),
                'free_gb': round(disk.free / (1024**3), 2),
                'percent': disk.percent
            }

        return jsonify({'success': True, 'data': info, 'has_psutil': has_psutil})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

# 保留旧的 REST API 作为降级方案
@app.route('/api/terminal/execute', methods=['POST'])
def terminal_execute_rest():
    """REST 降级接口（无流式输出）"""
    try:
        data = request.get_json()
        command = data.get('command', '').strip()
        session_id = data.get('session_id', 'default')

        if not command:
            return jsonify({'success': False, 'error': '命令不能为空'})

        sess = get_or_create_session(session_id)

        if is_dangerous_command(command):
            return jsonify({
                'success': False,
                'output': '⚠️ 安全限制：此命令已被阻止（危险操作）',
                'exit_code': -1
            })

        if command.startswith('cd ') or command == 'cd':
            path = command[3:].strip() if command.startswith('cd ') else os.path.expanduser('~')
            if path == '~':
                path = os.path.expanduser('~')
            elif not os.path.isabs(path):
                path = os.path.join(sess.cwd, path)
            path = os.path.normpath(path)
            if os.path.isdir(path):
                sess.cwd = path
                return jsonify({'success': True, 'output': f'切换到: {sess.cwd}', 'exit_code': 0, 'cwd': sess.cwd})
            else:
                return jsonify({'success': False, 'output': f'目录不存在: {path}', 'exit_code': 1})

        system = platform.system()
        try:
            result = subprocess.run(
                command, shell=True, capture_output=True,
                text=True, timeout=30, cwd=sess.cwd,
                encoding='gbk' if system == 'Windows' else 'utf-8',
                errors='replace'
            )
            output = result.stdout or ''
            if result.stderr:
                output += result.stderr
            return jsonify({
                'success': result.returncode == 0,
                'output': output.strip() or '命令执行成功（无输出）',
                'exit_code': result.returncode,
                'cwd': sess.cwd
            })
        except subprocess.TimeoutExpired:
            return jsonify({'success': False, 'output': '⏱️ 命令执行超时（>30秒）', 'exit_code': -1})
        except Exception as e:
            return jsonify({'success': False, 'output': f'❌ 执行错误: {e}', 'exit_code': -1})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

# ============ SocketIO 事件处理 ============

@socketio.on('connect')
def on_connect():
    session_id = request.sid
    get_or_create_session(session_id)
    emit('connected', {'session_id': session_id, 'version': VERSION})

@socketio.on('disconnect')
def on_disconnect():
    remove_session(request.sid)

@socketio.on('execute')
def on_execute(data):
    """执行命令（流式输出）"""
    session_id = request.sid
    command = data.get('command', '').strip()
    terminal_id = data.get('terminal_id', 1)

    if not command:
        return

    sess = get_or_create_session(session_id)

    # 如果有进程在运行，先终止
    if sess.is_running():
        sess.kill_process()

    # 危险命令检查
    if is_dangerous_command(command):
        emit('output', {
            'terminal_id': terminal_id,
            'data': '⚠️ 安全限制：此命令已被阻止（危险操作）\r\n',
            'type': 'error'
        })
        emit('command_done', {'terminal_id': terminal_id, 'exit_code': -1, 'cwd': sess.cwd})
        return

    # 处理 cd 命令
    if command.startswith('cd') and (len(command) == 2 or command[2] == ' '):
        path = command[3:].strip() if len(command) > 3 else os.path.expanduser('~')
        if path == '~':
            path = os.path.expanduser('~')
        elif not os.path.isabs(path):
            path = os.path.join(sess.cwd, path)
        path = os.path.normpath(path)
        if os.path.isdir(path):
            sess.cwd = path
            emit('output', {'terminal_id': terminal_id, 'data': '', 'type': 'success'})
            emit('command_done', {'terminal_id': terminal_id, 'exit_code': 0, 'cwd': sess.cwd})
        else:
            emit('output', {
                'terminal_id': terminal_id,
                'data': f'系统找不到指定的路径: {path}\r\n',
                'type': 'error'
            })
            emit('command_done', {'terminal_id': terminal_id, 'exit_code': 1, 'cwd': sess.cwd})
        return

    # 在后台线程中执行命令并流式推送输出
    def _safe_emit(event, data):
        """静默忽略客户端已断开时的发送错误"""
        try:
            socketio.emit(event, data, to=session_id)
        except Exception:
            pass

    def run_command():
        exit_code = -1
        system = platform.system()
        try:
            if system == 'Windows':
                proc = subprocess.Popen(
                    command,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    stdin=subprocess.PIPE,
                    cwd=sess.cwd,
                    encoding='gbk',
                    errors='replace',
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
                )
            else:
                proc = subprocess.Popen(
                    command,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    stdin=subprocess.PIPE,
                    cwd=sess.cwd,
                    encoding='utf-8',
                    errors='replace',
                    executable='/bin/bash'
                )

            with sess.process_lock:
                sess.process = proc

            # 逐行读取输出并推送
            for line in iter(proc.stdout.readline, ''):
                _safe_emit('output', {
                    'terminal_id': terminal_id,
                    'data': line,
                    'type': 'output'
                })

            proc.stdout.close()
            exit_code = proc.wait()

        except Exception as e:
            _safe_emit('output', {
                'terminal_id': terminal_id,
                'data': f'执行错误: {e}\r\n',
                'type': 'error'
            })
        finally:
            # 无论如何都发送 command_done，确保前端能解锁
            with sess.process_lock:
                sess.process = None
            _safe_emit('command_done', {
                'terminal_id': terminal_id,
                'exit_code': exit_code,
                'cwd': sess.cwd
            })

    t = threading.Thread(target=run_command, daemon=True)
    t.start()

@socketio.on('stdin')
def on_stdin(data):
    """向当前进程发送 stdin 输入"""
    session_id = request.sid
    sess = get_or_create_session(session_id)
    input_data = data.get('data', '')

    if sess.is_running() and sess.process.stdin:
        try:
            sess.process.stdin.write(input_data)
            sess.process.stdin.flush()
        except Exception:
            pass

@socketio.on('interrupt')
def on_interrupt(data):
    """Ctrl+C 中断当前进程"""
    session_id = request.sid
    sess = get_or_create_session(session_id)
    terminal_id = data.get('terminal_id', 1)

    if sess.is_running():
        sess.kill_process()
        socketio.emit('output', {
            'terminal_id': terminal_id,
            'data': '^C\r\n',
            'type': 'warning'
        }, to=session_id)
    else:
        # 没有运行中的进程，只输出 ^C
        socketio.emit('output', {
            'terminal_id': terminal_id,
            'data': '^C\r\n',
            'type': 'warning'
        }, to=session_id)
        socketio.emit('command_done', {
            'terminal_id': terminal_id,
            'exit_code': 130,
            'cwd': sess.cwd
        }, to=session_id)

@socketio.on('tab_complete')
def on_tab_complete(data):
    """Tab 补全请求"""
    session_id = request.sid
    sess = get_or_create_session(session_id)
    partial = data.get('partial', '')
    terminal_id = data.get('terminal_id', 1)

    completions = get_tab_completions(partial, sess.cwd)
    emit('tab_completions', {
        'terminal_id': terminal_id,
        'partial': partial,
        'completions': completions
    })

@socketio.on('get_cwd')
def on_get_cwd(data):
    """获取当前工作目录"""
    session_id = request.sid
    sess = get_or_create_session(session_id)
    terminal_id = data.get('terminal_id', 1)
    emit('cwd_update', {'terminal_id': terminal_id, 'cwd': sess.cwd})

# ============ 错误处理 ============

@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Not Found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Internal Server Error'}), 500

# ============ 主程序入口 ============

def check_permissions():
    system = platform.system()
    if system == 'Windows':
        try:
            import ctypes
            if not ctypes.windll.shell32.IsUserAnAdmin():
                print("\n⚠️  警告：未以管理员身份运行，某些命令可能需要管理员权限\n")
        except Exception:
            pass
    else:
        if os.geteuid() != 0:
            print("\n⚠️  提示：未以 root 权限运行，某些命令可能需要 sudo\n")

def main():
    check_permissions()

    port = 5001
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"⚠️ 无效的端口号: {sys.argv[1]}，使用默认端口 5001")

    platform_info = get_platform_info()

    print(f"""
╔════════════════════════════════════════════╗
║     CoolTerminal v{VERSION}            ║
║     现代化终端 (WebSocket 模式)     ║
╚════════════════════════════════════════════╝

🚀 服务器正在端口 {port} 上启动...
💻 操作系统: {platform_info['system']} {platform_info['version']}
🐍 Python: {platform_info['python_version']}
🖥️  Shell: {get_shell_for_platform()}
⚡ 模式: 实时流式输出 + stdin 交互 + Ctrl+C 支持
""")

    try:
        socketio.run(app, host='0.0.0.0', port=port, debug=False, use_reloader=False, allow_unsafe_werkzeug=True)
    except KeyboardInterrupt:
        print("\n\n👋 服务器已停止")
    except Exception as e:
        print(f"\n❌ 服务器启动失败: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
