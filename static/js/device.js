// ==== device.js - 设备管理功能 ====

const DeviceManager = {
    deviceInfo: null,
    pairedDevices: [],
    pendingPairs: [],
    activeDevice: null,
    checkInterval: null,

    async init() {
        await this.loadDeviceInfo();
        await this.loadPairedDevices();
        await this.loadActiveDevice();
        await this.checkPendingPairs();

        // 每5秒检查一次待确认请求和配对设备列表
        this.checkInterval = setInterval(() => {
            this.checkPendingPairs();
            this.loadPairedDevices();  // 同时刷新配对设备列表
            this.loadActiveDevice();   // 刷新激活设备状态
        }, 5000);
    },

    cleanup() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    },

    async loadDeviceInfo() {
        try {
            const response = await fetch('/api/device/info');
            const data = await response.json();

            if (data.success) {
                this.deviceInfo = data.device;
                this.renderDeviceInfo();
            } else {
                console.error('加载设备信息失败:', data.message);
            }
        } catch (e) {
            console.error('加载设备信息异常:', e);
        }
    },

    renderDeviceInfo() {
        if (!this.deviceInfo) return;

        document.getElementById('deviceName').textContent = this.deviceInfo.device_name;
        document.getElementById('deviceId').textContent = this.deviceInfo.device_id;
        document.getElementById('pairedCount').textContent = this.deviceInfo.paired_count;
    },

    async updateDeviceName(newName) {
        try {
            const response = await fetch('/api/device/update_name', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name: newName})
            });

            const data = await response.json();
            if (data.success) {
                await this.loadDeviceInfo();
                return true;
            } else {
                alert('更新失败: ' + data.message);
                return false;
            }
        } catch (e) {
            alert('更新异常: ' + e.message);
            return false;
        }
    },

    async loadPairedDevices() {
        try {
            const response = await fetch('/api/device/paired');
            const data = await response.json();

            if (data.success) {
                this.pairedDevices = data.devices;
                this.renderPairedDevices();
            } else {
                console.error('加载配对设备失败:', data.message);
            }
        } catch (e) {
            console.error('加载配对设备异常:', e);
        }
    },

    async loadActiveDevice() {
        try {
            const response = await fetch('/api/device/active');
            const data = await response.json();

            if (data.success) {
                this.activeDevice = data.active_device;
                this.renderActiveDevice();
            } else {
                console.error('加载激活设备失败:', data.message);
            }
        } catch (e) {
            console.error('加载激活设备异常:', e);
        }
    },

    renderActiveDevice() {
        const container = document.getElementById('activeDeviceInfo');

        if (!this.activeDevice) {
            container.innerHTML = '<p class="empty-hint">暂无激活的设备，请先配对设备并激活</p>';
            return;
        }

        // Parse device info
        const nameParts = this.activeDevice.name.match(/^(.+?)\s*\((.+?)\)$/);
        const deviceName = nameParts ? nameParts[1] : this.activeDevice.name;
        const deviceOS = nameParts ? nameParts[2] : '';

        // OS icon mapping
        const osIconMap = {
            'Windows': 'monitor',
            'Linux': 'server',
            'Darwin': 'smartphone',
            'Mac': 'smartphone'
        };
        const osIcon = osIconMap[deviceOS] || 'hard-drive';

        container.innerHTML = `
            <div class="active-device-card-content">
                <div class="device-card-header">
                    <div class="device-card-icon" style="background: linear-gradient(135deg, #10b981, #14b8a6); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);">
                        <i data-feather="${osIcon}"></i>
                    </div>
                    <div class="device-card-title">
                        <div class="device-card-name">${escapeHtml(deviceName)}</div>
                        ${deviceOS ? `<div class="device-card-os">${escapeHtml(deviceOS)}</div>` : ''}
                    </div>
                    <div class="device-active-badge">
                        <i data-feather="zap"></i>
                        <span>当前激活</span>
                    </div>
                </div>

                <div class="device-card-body">
                    <div class="device-info-row">
                        <i data-feather="hash" class="info-icon"></i>
                        <span class="info-label">设备ID</span>
                        <span class="info-value device-id-mono">${this.activeDevice.device_id}</span>
                    </div>

                    <div class="device-info-row">
                        <i data-feather="clock" class="info-icon"></i>
                        <span class="info-label">配对时间</span>
                        <span class="info-value">${this.activeDevice.paired_at_str || '未知'}</span>
                    </div>

                    <div class="device-info-row">
                        <i data-feather="activity" class="info-icon"></i>
                        <span class="info-label">最后在线</span>
                        <span class="info-value">${this.activeDevice.last_seen_str || '未知'}</span>
                    </div>

                    ${this.activeDevice.remote_url ? `
                        <div class="device-info-row">
                            <i data-feather="link" class="info-icon"></i>
                            <span class="info-label">远程地址</span>
                            <span class="info-value url-value">${escapeHtml(this.activeDevice.remote_url)}</span>
                        </div>
                    ` : `
                        <div class="device-info-row warning">
                            <i data-feather="alert-circle" class="info-icon"></i>
                            <span class="info-value">未配置远程地址</span>
                        </div>
                    `}
                </div>

                <div class="device-card-actions">
                    ${this.activeDevice.remote_url ? `
                        <button class="btn btn-secondary btn-sm" onclick="testDeviceConnectionById('${this.activeDevice.device_id}', '${escapeHtml(this.activeDevice.name)}', '${escapeHtml(this.activeDevice.remote_url)}')">
                            <i data-feather="wifi"></i>
                            <span>测试连接</span>
                        </button>
                    ` : ''}
                    <button class="btn btn-secondary btn-sm" onclick="updateDeviceUrlById('${this.activeDevice.device_id}', '${escapeHtml(this.activeDevice.name)}')">
                        <i data-feather="${this.activeDevice.remote_url ? 'edit' : 'plus'}"></i>
                        <span>${this.activeDevice.remote_url ? '更新地址' : '设置地址'}</span>
                    </button>
                </div>
            </div>
        `;

        // Re-initialize Feather icons
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    },

    async activateDevice(deviceId, deviceName) {
        // 检查是否有remote_url
        const device = this.pairedDevices.find(d => d.device_id === deviceId);
        if (!device || !device.remote_url) {
            const url = prompt(`设备"${deviceName}"没有保存远程地址，请输入远程地址:`, 'http://');
            if (!url || !url.trim()) {
                return;
            }
            // 先更新URL
            await this.updateDeviceUrl(deviceId, url.trim());
        }

        try {
            const response = await fetch('/api/device/activate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({device_id: deviceId})
            });

            const data = await response.json();
            if (data.success) {
                // 更新 AppState.config.remote_url
                if (data.remote_url && typeof AppState !== 'undefined') {
                    AppState.config.remote_url = data.remote_url;
                    console.log('已更新 AppState.config.remote_url:', data.remote_url);
                }

                let msg = '✅ ' + data.message;
                msg += '\n\n现在可以：';
                msg += '\n• 使用聊天功能与该设备对话';
                msg += '\n• 启动文件同步进行文件传输';
                msg += '\n\n切换到"聊天"或"同步"标签页开始使用';
                alert(msg);
                await this.loadActiveDevice();
                await this.loadPairedDevices();

                // 刷新连接状态
                if (window.checkConnectionStatus) {
                    window.checkConnectionStatus();
                }
            } else {
                alert('❌ 激活失败: ' + data.message);
            }
        } catch (e) {
            alert('激活异常: ' + e.message);
        }
    },

    async updateDeviceUrl(deviceId, remoteUrl) {
        try {
            const response = await fetch('/api/device/update_url', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({device_id: deviceId, remote_url: remoteUrl})
            });

            const data = await response.json();
            if (data.success) {
                alert('✅ URL已更新');
                await this.loadPairedDevices();
                return true;
            } else {
                alert('更新URL失败: ' + data.message);
                return false;
            }
        } catch (e) {
            alert('更新URL异常: ' + e.message);
            return false;
        }
    },

    async testDeviceConnection(deviceId, deviceName, remoteUrl) {
        if (!remoteUrl) {
            alert('⚠️ 该设备没有配置URL，无法测试连接');
            return;
        }

        try {
            const response = await fetch(`${remoteUrl}/api/ping`, { timeout: 5000 });
            if (response.ok) {
                alert(`✅ 连接成功！\n\n设备: ${deviceName}\nURL: ${remoteUrl}\n\n该设备在线且可访问。`);
            } else {
                alert(`❌ 连接失败\n\nHTTP状态码: ${response.status}\n\n请检查：\n1. 对方设备是否在线\n2. URL是否正确\n3. 网络是否互通`);
            }
        } catch (e) {
            alert(`❌ 连接失败\n\n错误: ${e.message}\n\n请检查：\n1. 对方设备是否在线\n2. URL是否正确\n3. 防火墙是否阻止连接\n4. 网络是否互通`);
        }
    },

    renderPairedDevices() {
        const container = document.getElementById('pairedDevicesList');

        if (this.pairedDevices.length === 0) {
            container.innerHTML = '<p class="empty-hint">暂无已配对的设备</p>';
            return;
        }

        container.innerHTML = this.pairedDevices.map(device => {
            const isActive = device.is_active || (this.activeDevice && this.activeDevice.device_id === device.device_id);
            const activeClass = isActive ? 'active' : '';

            // 解析设备信息
            const nameParts = device.name.match(/^(.+?)\s*\((.+?)\)$/);
            const deviceName = nameParts ? nameParts[1] : device.name;
            const deviceOS = nameParts ? nameParts[2] : '';

            // 系统图标映射
            const osIconMap = {
                'Windows': 'monitor',
                'Linux': 'server',
                'Darwin': 'smartphone',
                'Mac': 'smartphone'
            };
            const osIcon = osIconMap[deviceOS] || 'hard-drive';

            return `
                <div class="paired-device-card ${activeClass}">
                    <div class="device-card-header">
                        <div class="device-card-icon">
                            <i data-feather="${osIcon}"></i>
                        </div>
                        <div class="device-card-title">
                            <div class="device-card-name">${escapeHtml(deviceName)}</div>
                            ${deviceOS ? `<div class="device-card-os">${escapeHtml(deviceOS)}</div>` : ''}
                        </div>
                        ${isActive ? '<div class="device-active-badge"><i data-feather="check-circle"></i><span>当前激活</span></div>' : ''}
                    </div>

                    <div class="device-card-body">
                        <div class="device-info-row">
                            <i data-feather="hash" class="info-icon"></i>
                            <span class="info-label">设备ID</span>
                            <span class="info-value device-id-mono">${device.device_id}</span>
                        </div>

                        <div class="device-info-row">
                            <i data-feather="clock" class="info-icon"></i>
                            <span class="info-label">配对时间</span>
                            <span class="info-value">${device.paired_at_str}</span>
                        </div>

                        <div class="device-info-row">
                            <i data-feather="activity" class="info-icon"></i>
                            <span class="info-label">最后在线</span>
                            <span class="info-value">${device.last_seen_str}</span>
                        </div>

                        ${device.remote_url ? `
                            <div class="device-info-row">
                                <i data-feather="link" class="info-icon"></i>
                                <span class="info-label">远程地址</span>
                                <span class="info-value url-value">${escapeHtml(device.remote_url)}</span>
                            </div>
                        ` : `
                            <div class="device-info-row warning">
                                <i data-feather="alert-circle" class="info-icon"></i>
                                <span class="info-value">未配置远程地址</span>
                            </div>
                        `}
                    </div>

                    <div class="device-card-actions">
                        ${!isActive ? `
                            <button class="btn btn-primary btn-sm" onclick="activateDeviceById('${device.device_id}', '${escapeHtml(device.name)}')">
                                <i data-feather="zap"></i>
                                <span>激活</span>
                            </button>
                        ` : ''}
                        ${device.remote_url ? `
                            <button class="btn btn-secondary btn-sm" onclick="testDeviceConnectionById('${device.device_id}', '${escapeHtml(device.name)}', '${escapeHtml(device.remote_url)}')">
                                <i data-feather="wifi"></i>
                                <span>测试连接</span>
                            </button>
                        ` : ''}
                        <button class="btn btn-secondary btn-sm" onclick="updateDeviceUrlById('${device.device_id}', '${escapeHtml(device.name)}')">
                            <i data-feather="${device.remote_url ? 'edit' : 'plus'}"></i>
                            <span>${device.remote_url ? '更新地址' : '设置地址'}</span>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="unpairDevice('${device.device_id}', '${escapeHtml(device.name)}')">
                            <i data-feather="trash-2"></i>
                            <span>取消配对</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // 重新初始化Feather图标
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    },

    validateUrl(url) {
        // 检查URL格式
        if (!url || !url.trim()) {
            return { valid: false, message: '地址不能为空' };
        }

        // 检查是否包含端口号
        const portPattern = /:\d+/;
        if (!portPattern.test(url)) {
            return {
                valid: false,
                message: '❌ URL必须包含端口号！\n\n正确格式示例：\nhttp://192.168.1.100:5001\n\n请确认对方设备的端口号（默认5001）'
            };
        }

        // 检查格式
        try {
            const urlObj = new URL(url);
            if (!urlObj.protocol.startsWith('http')) {
                return { valid: false, message: 'URL必须以 http:// 或 https:// 开头' };
            }
            return { valid: true };
        } catch (e) {
            return { valid: false, message: 'URL格式错误，正确格式：http://IP:端口\n例如：http://192.168.1.100:5001' };
        }
    },

    async sendPairRequest(remoteUrl, localCallbackUrl) {
        // 验证URL
        const validation = this.validateUrl(remoteUrl);
        if (!validation.valid) {
            alert(validation.message);
            return false;
        }

        // 如果指定了本机回调地址，验证它
        if (localCallbackUrl) {
            const callbackValidation = this.validateUrl(localCallbackUrl);
            if (!callbackValidation.valid) {
                alert('本机回调地址格式错误：\n' + callbackValidation.message);
                return false;
            }
        }

        try {
            const requestBody = {remote_url: remoteUrl};
            if (localCallbackUrl) {
                requestBody.local_callback_url = localCallbackUrl;
            }

            const response = await fetch('/api/pair/request', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();
            if (data.success) {
                alert('✅ ' + data.message + '\n\n配对请求已发送，等待对方接受后将自动出现在已配对设备列表中（最多5秒）。');
                // 清空输入框
                document.getElementById('pairIp').value = '';
                document.getElementById('pairPort').value = '5001';
                document.getElementById('pairUrl').value = '';
                return true;
            } else {
                // 检查是否是已配对设备
                if (data.already_paired) {
                    const deviceName = data.device_name || '未知设备';
                    const isActive = data.is_active;

                    let message = `设备 "${deviceName}" 已经配对过了！\n\n`;

                    if (isActive) {
                        message += '✅ 该设备已激活，可以直接使用聊天和同步功能。';
                    } else {
                        message += '提示：您可以在"已配对设备"列表中点击"激活"按钮来使用该设备。\n\n';
                        message += '如需重新配对，请先取消配对该设备。';
                    }

                    alert(message);

                    // 刷新已配对设备列表
                    this.loadPairedDevices();
                } else {
                    alert('❌ ' + data.message);
                }
                return false;
            }
        } catch (e) {
            alert('发送失败: ' + e.message);
            return false;
        }
    },

    async checkPendingPairs() {
        try {
            const response = await fetch('/api/device/pending');
            const data = await response.json();

            if (data.success) {
                this.pendingPairs = data.pending || [];
                this.renderPendingPairs();
            } else {
                console.error('检查待确认请求失败:', data.message);
            }
        } catch (e) {
            console.error('检查待确认请求异常:', e);
        }
    },

    renderPendingPairs() {
        const container = document.getElementById('pendingList');
        const section = document.getElementById('pendingSection');

        // pendingPairs 现在是数组
        if (!Array.isArray(this.pendingPairs) || this.pendingPairs.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        container.innerHTML = this.pendingPairs.map(pair => {
            return `
                <div class="pending-item">
                    <div class="pending-info">
                        <div class="pending-device-name">${escapeHtml(pair.name)}</div>
                        <div class="pending-device-id">${pair.device_id}</div>
                        ${pair.remote_url ? `<div class="pending-device-url">${escapeHtml(pair.remote_url)}</div>` : ''}
                    </div>
                    <div class="pending-actions">
                        <button class="btn btn-primary" onclick="confirmPair('${pair.device_id}', 'accept')">
                            <i data-feather="check"></i>
                            <span>接受</span>
                        </button>
                        <button class="btn btn-secondary" onclick="confirmPair('${pair.device_id}', 'reject')">
                            <i data-feather="x"></i>
                            <span>拒绝</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // 重新初始化图标
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    },

    async confirmPair(deviceId, action) {
        try {
            const response = await fetch('/api/pair/confirm', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({device_id: deviceId, action: action})
            });

            const data = await response.json();
            if (data.success) {
                if (action === 'accept') {
                    let msg = '✅ 配对成功！\n\n';
                    msg += data.message;

                    if (data.notify_success === false) {
                        msg += '\n\n⚠️ 未能自动通知对方完成配对\n\n';

                        if (data.notify_error) {
                            msg += `错误详情：${data.notify_error}\n\n`;
                        }

                        msg += '解决方案：\n';
                        msg += '1. 通知对方打开"设备管理"页面\n';
                        msg += '2. 对方会在5秒内自动看到您的设备\n';
                        msg += '3. 如果对方5秒后仍未看到，让对方点击页面上的"刷新"按钮\n';
                        msg += '4. 双方都需要确保应用正在运行';
                    }

                    alert(msg);
                    await this.loadPairedDevices();
                    await this.loadDeviceInfo();
                } else {
                    alert('已拒绝配对请求');
                }
                await this.checkPendingPairs();
            } else {
                alert('操作失败: ' + data.message);
            }
        } catch (e) {
            alert('操作异常: ' + e.message);
        }
    },

    async unpairDevice(deviceId, deviceName) {
        if (!confirm(`确定要取消与"${deviceName}"的配对吗？\n\n取消后将无法使用聊天和同步功能，需要重新配对。`)) {
            return;
        }

        try {
            const response = await fetch('/api/device/unpair', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({device_id: deviceId})
            });

            const data = await response.json();
            if (data.success) {
                let msg = '✅ 已取消配对';

                if (data.notify_success) {
                    msg += '\n\n对方设备已收到通知并同步取消配对。';
                } else {
                    msg += '\n\n⚠️ 对方设备可能不在线，未能通知取消配对。';
                    msg += '\n\n对方设备会在下次连接时自动检测到配对已取消。';
                }

                alert(msg);
                await this.loadPairedDevices();
                await this.loadDeviceInfo();

                // 检查是否取消了激活设备，如果是则清空配置
                const activeResp = await fetch('/api/device/active');
                const activeData = await activeResp.json();
                if (activeData.success && !activeData.active_device && typeof AppState !== 'undefined') {
                    AppState.config.remote_url = '';
                    console.log('已清空 AppState.config.remote_url（取消了激活设备）');
                }

                // 刷新连接状态
                if (window.checkConnectionStatus) {
                    window.checkConnectionStatus();
                }
            } else {
                alert('取消失败: ' + data.message);
            }
        } catch (e) {
            alert('操作异常: ' + e.message);
        }
    }
};

// 全局函数（供HTML调用）
function editDeviceName() {
    const currentName = DeviceManager.deviceInfo.device_name;
    const newName = prompt('请输入新的设备名称:', currentName);

    if (newName && newName.trim() && newName !== currentName) {
        DeviceManager.updateDeviceName(newName.trim());
    }
}

function copyDeviceId() {
    const deviceId = DeviceManager.deviceInfo.device_id;
    navigator.clipboard.writeText(deviceId).then(() => {
        alert('设备ID已复制到剪贴板');
    }).catch(() => {
        // 降级方案
        const input = document.createElement('textarea');
        input.value = deviceId;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        alert('设备ID已复制到剪贴板');
    });
}

function sendPairRequest() {
    const url = document.getElementById('pairUrl').value.trim();
    const localCallbackUrl = document.getElementById('localCallbackUrl').value.trim();

    if (!url) {
        alert('请输入远程设备地址');
        return;
    }

    DeviceManager.sendPairRequest(url, localCallbackUrl);
}

function confirmPair(deviceId, action) {
    DeviceManager.confirmPair(deviceId, action);
}

function unpairDevice(deviceId, deviceName) {
    DeviceManager.unpairDevice(deviceId, deviceName);
}

function refreshPairedDevices() {
    DeviceManager.loadPairedDevices();
}

function activateDeviceById(deviceId, deviceName) {
    DeviceManager.activateDevice(deviceId, deviceName);
}

function updateDeviceUrlById(deviceId, deviceName) {
    const url = prompt(`请输入设备"${deviceName}"的远程地址:`, 'http://');
    if (url && url.trim()) {
        DeviceManager.updateDeviceUrl(deviceId, url.trim());
    }
}

function testDeviceConnectionById(deviceId, deviceName, remoteUrl) {
    DeviceManager.testDeviceConnection(deviceId, deviceName, remoteUrl);
}

function updatePairUrl() {
    const ip = document.getElementById('pairIp').value.trim();
    const port = document.getElementById('pairPort').value.trim();
    const urlInput = document.getElementById('pairUrl');

    if (ip && port) {
        urlInput.value = `http://${ip}:${port}`;
    } else if (ip) {
        urlInput.value = `http://${ip}:`;
    } else {
        urlInput.value = '';
    }
}
