#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CoolTerminal - 现代化终端模拟器
Flask 后端服务
"""

import os
import sys
import json
import subprocess
import platform
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
    try:
        data = request.get_json()
        command = data.get('command', '').strip()

        if not command:
            return jsonify({
                'success': False,
                'error': '命令不能为空'
            })

        # 安全检查：禁止危险命令
        dangerous_commands = ['rm -rf', 'format', 'del /f', 'shutdown', 'reboot']
        if any(dangerous in command.lower() for dangerous in dangerous_commands):
            return jsonify({
                'success': False,
                'error': '禁止执行危险命令',
                'output': '⚠️ 安全限制：此命令已被阻止'
            })

        # 执行命令
        try:
            # 根据操作系统选择 shell
            if platform.system() == 'Windows':
                result = subprocess.run(
                    command,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=10,
                    encoding='utf-8',
                    errors='ignore'
                )
            else:
                result = subprocess.run(
                    command,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=10
                )

            output = result.stdout if result.stdout else result.stderr

            return jsonify({
                'success': True,
                'output': output or '命令执行成功（无输出）',
                'exit_code': result.returncode
            })

        except subprocess.TimeoutExpired:
            return jsonify({
                'success': False,
                'error': '命令执行超时（>10秒）',
                'output': '⏱️ 命令执行时间过长，已被终止'
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e),
                'output': f'❌ 执行错误: {str(e)}'
            })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'请求处理失败: {str(e)}'
        })


@app.route('/api/terminal/sysinfo', methods=['GET'])
def terminal_sysinfo():
    """获取系统信息"""
    try:
        import psutil

        # CPU 信息
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()

        # 内存信息
        memory = psutil.virtual_memory()

        # 磁盘信息
        disk = psutil.disk_usage('/')

        return jsonify({
            'success': True,
            'data': {
                'platform': platform.system(),
                'platform_release': platform.release(),
                'architecture': platform.machine(),
                'hostname': platform.node(),
                'python_version': platform.python_version(),
                'cpu': {
                    'count': cpu_count,
                    'usage_percent': cpu_percent
                },
                'memory': {
                    'total': memory.total,
                    'available': memory.available,
                    'percent': memory.percent
                },
                'disk': {
                    'total': disk.total,
                    'used': disk.used,
                    'free': disk.free,
                    'percent': disk.percent
                }
            }
        })
    except ImportError:
        # 如果没有 psutil，返回基本信息
        return jsonify({
            'success': True,
            'data': {
                'platform': platform.system(),
                'platform_release': platform.release(),
                'architecture': platform.machine(),
                'hostname': platform.node(),
                'python_version': platform.python_version()
            }
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

def main():
    """主函数"""
    # 获取端口参数
    port = 5001
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"⚠️ 无效的端口号: {sys.argv[1]}，使用默认端口 5001")

    # 检查是否是 Electron 模式
    electron_mode = '--electron' in sys.argv

    print(f"""
╔════════════════════════════════════════════╗
║     CoolTerminal v{VERSION}              ║
║     现代化终端模拟器                      ║
╚════════════════════════════════════════════╝

🚀 Flask服务器正在端口 {port} 上启动...
📂 工作目录: {os.getcwd()}
🐍 Python 版本: {platform.python_version()}
💻 操作系统: {platform.system()} {platform.release()}

""")

    # 启动 Flask 服务器
    try:
        app.run(
            host='0.0.0.0',
            port=port,
            debug=not electron_mode,  # Electron 模式下禁用 debug
            threaded=True
        )
    except KeyboardInterrupt:
        print("\n\n👋 服务器已停止")
    except Exception as e:
        print(f"\n❌ 服务器启动失败: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
