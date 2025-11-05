// ==== connection.js - 连接管理 ====

const ConnectionManager = {
    isTesting: false,

    async test() {
        if (this.isTesting) return;

        if (!AppState.config.remote_url) {
            alert('请先配对并激活设备\n\n步骤：\n1. 打开"设备管理"标签\n2. 配对远程设备\n3. 点击"激活"按钮');
            if (typeof switchTab === 'function') {
                switchTab('device');
            }
            return;
        }

        this.isTesting = true;
        const dot = document.getElementById('connectionDot');
        const text = document.getElementById('connectionText');
        
        dot.classList.remove('online');
        dot.classList.add('testing');
        text.textContent = '测试中...';

        try {
            const response = await fetch('/api/test_connection', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({remote_url: AppState.config.remote_url})
            });

            const data = await response.json();
            dot.classList.remove('testing');
            
            if (data.success) {
                dot.classList.add('online');
                text.textContent = '已连接';
            } else {
                text.textContent = '连接失败';
                setTimeout(() => {
                    if (!document.getElementById('connectionDot').classList.contains('online')) {
                        text.textContent = '未连接';
                    }
                }, 2000);
            }
            this.updateStatus();
        } catch (e) {
            dot.classList.remove('testing');
            text.textContent = '连接异常';
            setTimeout(() => {
                if (!document.getElementById('connectionDot').classList.contains('online')) {
                    text.textContent = '未连接';
                }
            }, 2000);
        } finally {
            this.isTesting = false;
        }
    },

    async updateStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();

            const dot = document.getElementById('connectionDot');
            const text = document.getElementById('connectionText');

            if (data.is_connected) {
                dot.classList.add('online');
                // 如果有激活设备，显示设备名称
                if (data.active_device && data.active_device.name) {
                    text.textContent = `已连接 · ${data.active_device.name}`;
                } else {
                    text.textContent = '已连接';
                }
            } else {
                dot.classList.remove('online');
                if (text.textContent !== '测试中...') {
                    // 如果有激活设备但未连接，显示设备名称
                    if (data.active_device && data.active_device.name) {
                        text.textContent = `未连接 · ${data.active_device.name}`;
                    } else {
                        text.textContent = '未连接';
                    }
                }
            }
        } catch (e) {
            console.error('更新连接状态失败:', e);
        }
    }
};

// 全局函数（供HTML调用）
function testConnection() {
    ConnectionManager.test();
}

function checkConnectionStatus() {
    ConnectionManager.updateStatus();
}

// 导出到window
window.checkConnectionStatus = checkConnectionStatus;
