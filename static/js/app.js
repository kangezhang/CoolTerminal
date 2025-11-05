// ==== app.js - 主应用逻辑 ====

// 全局状态
const AppState = {
    currentTab: 'terminal',
    config: {
        port: 5001,
        remote_url: ''
    }
};

// 标签页切换
function switchTab(tab) {
    AppState.currentTab = tab;

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    event.target.closest('.nav-item').classList.add('active');

    document.getElementById('terminal-tab').classList.toggle('hidden', tab !== 'terminal');
    document.getElementById('ai-chat-tab').classList.toggle('hidden', tab !== 'ai-chat');
    document.getElementById('chat-tab').classList.toggle('hidden', tab !== 'chat');
    document.getElementById('device-tab').classList.toggle('hidden', tab !== 'device');

    // 聊天tab初始化
    if (tab === 'chat') {
        // 确保有 remote_url 配置
        if (!AppState.config.remote_url) {
            fetch('/api/device/active')
                .then(resp => resp.json())
                .then(data => {
                    if (data.success && data.active_device && data.active_device.remote_url) {
                        AppState.config.remote_url = data.active_device.remote_url;
                        console.log('切换到聊天标签，加载 remote_url:', AppState.config.remote_url);
                    }
                })
                .catch(e => console.error('加载激活设备失败:', e));
        }

        ChatManager.loadMessages();
        if (!ChatManager.interval) {
            ChatManager.interval = setInterval(() => ChatManager.loadMessages(), 3000);
        }
    } else {
        if (ChatManager.interval) {
            clearInterval(ChatManager.interval);
            ChatManager.interval = null;
        }
    }

    // 设备管理tab初始化
    if (tab === 'device') {
        DeviceManager.init();
    } else {
        DeviceManager.cleanup();
    }

    // AI 聊天tab初始化
    if (tab === 'ai-chat') {
        if (typeof AIChatManager !== 'undefined') {
            AIChatManager.loadMessages();
            if (!AIChatManager.interval) {
                AIChatManager.interval = setInterval(() => {
                    if (!AIChatManager.isSending) {
                        AIChatManager.loadMessages();
                    }
                }, 3000);
            }
        }
    } else {
        if (typeof AIChatManager !== 'undefined' && AIChatManager.interval) {
            clearInterval(AIChatManager.interval);
            AIChatManager.interval = null;
        }
    }

    // 终端tab初始化
    if (tab === 'terminal') {
        if (typeof TerminalManager !== 'undefined') {
            // 聚焦输入框
            const input = document.getElementById('terminalInput');
            if (input) {
                setTimeout(() => input.focus(), 100);
            }
        }
    }
}

// 设置管理
function openSettings() {
    document.getElementById('settingsModal').classList.add('active');
    document.getElementById('settingsPort').value = AppState.config.port;
}

function closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
}

async function saveSettings() {
    AppState.config.port = parseInt(document.getElementById('settingsPort').value) || 5001;
    alert('✅ 设置已保存！\n\n注意：端口修改需要重启服务才能生效。');
    closeSettings();
}

// 关于弹窗管理
function openAbout() {
    const modal = document.getElementById('aboutModal');
    if (modal) {
        modal.classList.add('active');
        // 重新绘制 feather 图标
        if (typeof feather !== 'undefined') feather.replace();
    }
}

function closeAbout() {
    const modal = document.getElementById('aboutModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function clearChatHistory(daysBefore) {
    let confirmMessage;
    if (daysBefore === 0) {
        confirmMessage = '确定要清除所有聊天记录吗？\n\n此操作不可恢复！';
    } else {
        confirmMessage = `确定要清除 ${daysBefore} 天前的聊天记录吗？\n\n此操作不可恢复！`;
    }

    if (!confirm(confirmMessage)) {
        return;
    }

    try {
        const response = await fetch('/chat/clear_old_messages', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({days_before: daysBefore})
        });

        const data = await response.json();
        if (data.success) {
            if (daysBefore === 0) {
                alert(`已清除所有聊天记录，共 ${data.deleted_count} 条`);
            } else {
                alert(`已清除 ${daysBefore} 天前的聊天记录，共 ${data.deleted_count} 条`);
            }

            // 刷新聊天消息列表
            if (ChatManager && typeof ChatManager.loadMessages === 'function') {
                ChatManager.loadMessages();
            }
        } else {
            alert('清除失败: ' + data.message);
        }
    } catch (e) {
        alert('清除异常: ' + e.message);
    }
}

// 工具函数
function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
        bytes /= 1024;
        i++;
    }
    return bytes.toFixed(2) + ' ' + units[i];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 初始化
window.onload = async function() {
    // 加载配置
    try {
        // 检查是否有激活设备
        try {
            const activeResp = await fetch('/api/device/active');
            const activeData = await activeResp.json();
            if (activeData.success && activeData.active_device && activeData.active_device.remote_url) {
                AppState.config.remote_url = activeData.active_device.remote_url;
                console.log('从激活设备加载 remote_url:', AppState.config.remote_url);
            }
        } catch (e) {
            console.error('加载激活设备失败:', e);
        }

        ConnectionManager.updateStatus();
    } catch (e) {
        console.error('加载配置失败:', e);
    }

    // 初始化终端
    if (typeof TerminalManager !== 'undefined') {
        TerminalManager.init();
    }

    // 初始化聊天输入法监听
    ChatManager.init();

    // 初始化 AI 聊天
    if (typeof AIChatManager !== 'undefined') {
        AIChatManager.init();
    }

    // 定期更新连接状态
    setInterval(() => ConnectionManager.updateStatus(), 5000);
};

// 模态框点击外部关闭
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeSettings();
            }
        });
    }
});
