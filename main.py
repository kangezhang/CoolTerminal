#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CoolTerminal - 现代化终端模拟器
Flask 后端服务 - 支持 Windows/Mac/Linux
"""

import os
import sys
import subprocess
import platform
import shlex
from pathlib import Path
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS

# 创建 Flask 应用
app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 应用版本
VERSION = "1.0.0"

# 配置
app.config['SECRET_KEY'] = 'coolterminal-secret-key-2024'
app.config['JSON_AS_ASCII'] = False  # 支持中文

# 当前工作目录（用户可以通过 cd 改变）
CURRENT_DIR = os.path.expanduser('~')  # 默认用户主目录


# ============ 跨平台工具函数 ============

def get_platform_info():
    """获取平台信息"""
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
    """获取当前平台的默认 shell"""
    system = platform.system()

    if system == 'Windows':
        # Windows 优先使用 PowerShell，否则 cmd
        if os.path.exists('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'):
            return 'powershell'
        return 'cmd'
    elif system == 'Darwin':  # macOS
        return os.environ.get('SHELL', '/bin/zsh')
    else:  # Linux
        return os.environ.get('SHELL', '/bin/bash')


def is_dangerous_command(command):
    """检查是否为危险命令"""
    dangerous_patterns = [
        'rm -rf /',
        'rm -rf *',
        'format',
        'del /f /s /q',
        'shutdown',
        'reboot',
        'init 0',
        'init 6',
        ':(){:|:&};:',  # fork bomb
        'mkfs',
        'dd if=/dev/zero',
        '> /dev/sda',
    ]

    command_lower = command.lower()
    return any(pattern in command_lower for pattern in dangerous_patterns)


def execute_command_cross_platform(command, cwd=None):
    """
    跨平台执行命令

    Args:
        command: 要执行的命令
        cwd: 工作目录

    Returns:
        dict: {success, output, exit_code, error}
    """
    system = platform.system()

    try:
        # 安全检查
        if is_dangerous_command(command):
            return {
                'success': False,
                'output': '⚠️ 安全限制：此命令已被阻止（危险操作）',
                'exit_code': -1,
                'error': '危险命令'
            }

        # 根据平台选择执行方式
        if system == 'Windows':
            # Windows 使用 cmd 或 PowerShell
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30,
                cwd=cwd,
                encoding='gbk',  # Windows 中文编码
                errors='ignore'
            )
        else:
            # Linux/Mac 使用 bash/zsh
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30,
                cwd=cwd,
                executable='/bin/bash'  # 明确指定 bash
            )

        # 合并 stdout 和 stderr
        output = result.stdout if result.stdout else ''
        if result.stderr:
            output += '\n' + result.stderr

        return {
            'success': result.returncode == 0,
            'output': output.strip() if output else '命令执行成功（无输出）',
            'exit_code': result.returncode,
            'error': None
        }

    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'output': '⏱️ 命令执行超时（>30秒），已被终止',
            'exit_code': -1,
            'error': '执行超时'
        }
    except Exception as e:
        return {
            'success': False,
            'output': f'❌ 执行错误: {str(e)}',
            'exit_code': -1,
            'error': str(e)
        }


# ============ 路由定义 ============

@app.route('/')
def index():
    """主页"""
    return render_template('index.html', version=VERSION, active_tab='terminal')


@app.route('/static/<path:filename>')
def static_files(filename):
    """静态文件服务"""
    return send_from_directory('static', filename)


# ============ 终端 API ============

@app.route('/api/terminal/execute', methods=['POST'])
def terminal_execute():
    """执行终端命令（真实命令执行）"""
    global CURRENT_DIR

    try:
        data = request.get_json()
        command = data.get('command', '').strip()

        if not command:
            return jsonify({
                'success': False,
                'error': '命令不能为空'
            })

        # 特殊处理 cd 命令
        if command.startswith('cd '):
            path = command[3:].strip()

            # 处理特殊路径
            if path == '~':
                path = os.path.expanduser('~')
            elif path == '..':
                path = os.path.dirname(CURRENT_DIR)
            elif not os.path.isabs(path):
                path = os.path.join(CURRENT_DIR, path)

            # 检查路径是否存在
            if os.path.isdir(path):
                CURRENT_DIR = os.path.abspath(path)
                return jsonify({
                    'success': True,
                    'output': f'切换到: {CURRENT_DIR}',
                    'exit_code': 0
                })
            else:
                return jsonify({
                    'success': False,
                    'output': f'目录不存在: {path}',
                    'exit_code': 1
                })

        # 特殊处理 pwd 命令
        if command == 'pwd':
            return jsonify({
                'success': True,
                'output': CURRENT_DIR,
                'exit_code': 0
            })

        # 执行命令
        result = execute_command_cross_platform(command, cwd=CURRENT_DIR)

        return jsonify({
            'success': result['success'],
            'output': result['output'],
            'exit_code': result['exit_code'],
            'error': result.get('error')
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'请求处理失败: {str(e)}',
            'output': f'❌ 服务器错误: {str(e)}'
        })


@app.route('/api/terminal/platform', methods=['GET'])
def terminal_platform():
    """获取平台信息"""
    try:
        info = get_platform_info()
        info['shell'] = get_shell_for_platform()
        info['cwd'] = CURRENT_DIR

        return jsonify({
            'success': True,
            'data': info
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })


@app.route('/api/terminal/sysinfo', methods=['GET'])
def terminal_sysinfo():
    """获取系统信息"""
    try:
        # 尝试导入 psutil
        try:
            import psutil
            has_psutil = True
        except ImportError:
            has_psutil = False

        info = get_platform_info()

        if has_psutil:
            # 增强系统信息
            info['cpu'] = {
                'count': psutil.cpu_count(),
                'percent': psutil.cpu_percent(interval=1)
            }

            memory = psutil.virtual_memory()
            info['memory'] = {
                'total': memory.total,
                'available': memory.available,
                'percent': memory.percent,
                'total_gb': round(memory.total / (1024**3), 2),
                'available_gb': round(memory.available / (1024**3), 2)
            }

            disk = psutil.disk_usage('/')
            info['disk'] = {
                'total': disk.total,
                'used': disk.used,
                'free': disk.free,
                'percent': disk.percent,
                'total_gb': round(disk.total / (1024**3), 2),
                'free_gb': round(disk.free / (1024**3), 2)
            }

        return jsonify({
            'success': True,
            'data': info,
            'has_psutil': has_psutil
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })


# ============ 健康检查 ============

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    return jsonify({
        'status': 'healthy',
        'version': VERSION,
        'platform': platform.system(),
        'timestamp': datetime.now().isoformat()
    })


# ============ 错误处理 ============

@app.errorhandler(404)
def not_found(error):
    """404 错误处理"""
    return jsonify({
        'success': False,
        'error': 'Not Found',
        'message': '请求的资源不存在'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """500 错误处理"""
    return jsonify({
        'success': False,
        'error': 'Internal Server Error',
        'message': '服务器内部错误'
    }), 500


# ============ 主程序入口 ============

def check_permissions():
    """检查并提示权限"""
    system = platform.system()

    if system == 'Windows':
        # 检查是否以管理员身份运行
        try:
            import ctypes
            is_admin = ctypes.windll.shell32.IsUserAnAdmin()
            if not is_admin:
                print("\n⚠️  警告：未以管理员身份运行")
                print("某些命令可能需要管理员权限")
                print("建议：右键选择 '以管理员身份运行'\n")
        except:
            pass
    else:
        # Linux/Mac 检查 sudo 权限
        if os.geteuid() != 0:
            print("\n⚠️  提示：未以 root 权限运行")
            print("某些命令可能需要 sudo 权限")
            print("建议：使用 sudo python main.py\n")


def main():
    """主函数"""
    # 检查权限
    check_permissions()

    # 获取端口参数
    port = 5001
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"⚠️ 无效的端口号: {sys.argv[1]}，使用默认端口 5001")

    # 检查是否是 Electron 模式
    electron_mode = '--electron' in sys.argv

    # 获取平台信息
    platform_info = get_platform_info()

    print(f"""
╔════════════════════════════════════════════╗
║     CoolTerminal v{VERSION}              ║
║     现代化终端模拟器                      ║
╚════════════════════════════════════════════╝

🚀 Flask 服务器正在端口 {port} 上启动...
📂 工作目录: {os.getcwd()}
💻 操作系统: {platform_info['system']} {platform_info['version']}
🏗️  架构: {platform_info['machine']}
🐍 Python: {platform_info['python_version']}
🖥️  Shell: {get_shell_for_platform()}

💡 使用提示：
   - 模拟模式：安全的预设命令（无需后端）
   - 真实模式：执行真实系统命令（需要权限）
   - 支持平台：Windows / macOS / Linux

""")

    # 启动 Flask 服务器
    try:
        app.run(
            host='0.0.0.0',
            port=port,
            debug=False,  # 禁用 debug 模式加快启动
            use_reloader=False,  # 禁用自动重载
            threaded=True
        )
    except KeyboardInterrupt:
        print("\n\n👋 服务器已停止")
    except Exception as e:
        print(f"\n❌ 服务器启动失败: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
