// ==== chat.js - 聊天功能 ====

const ChatManager = {
    lastMessagesJson: '',
    isSending: false,
    isComposing: false,
    interval: null,
    selectedFiles: [],

    init() {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput) return;

        // 监听输入法组合开始
        chatInput.addEventListener('compositionstart', () => {
            this.isComposing = true;
        });

        // 监听输入法组合结束
        chatInput.addEventListener('compositionend', () => {
            this.isComposing = false;
        });

        // 键盘事件
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !this.isComposing) {
                e.preventDefault();
                sendMessage();
            }
        });

        // 拖拽事件
        this.initDragAndDrop();
    },

    initDragAndDrop() {
        const container = document.getElementById('chatContainer');
        const overlay = document.getElementById('dragOverlay');
        if (!container || !overlay) return;

        let dragCounter = 0;

        container.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            overlay.classList.add('active');
        });

        container.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) {
                overlay.classList.remove('active');
            }
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            dragCounter = 0;
            overlay.classList.remove('active');

            const items = e.dataTransfer.items;
            if (items) {
                this.handleDroppedItems(items);
            }
        });
    },

    async handleDroppedItems(items) {
        const files = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                    if (entry.isFile) {
                        const file = item.getAsFile();
                        files.push(file);
                    } else if (entry.isDirectory) {
                        await this.traverseDirectory(entry, files);
                    }
                }
            }
        }

        if (files.length > 0) {
            this.selectedFiles = files;
            this.updateSelectedFilesUI();
        }
    },

    traverseDirectory(directory, files) {
        return new Promise((resolve) => {
            const reader = directory.createReader();
            reader.readEntries(async (entries) => {
                for (const entry of entries) {
                    if (entry.isFile) {
                        const file = await this.getFileFromEntry(entry);
                        files.push(file);
                    } else if (entry.isDirectory) {
                        await this.traverseDirectory(entry, files);
                    }
                }
                resolve();
            });
        });
    },

    getFileFromEntry(entry) {
        return new Promise((resolve) => {
            entry.file(resolve);
        });
    },

    updateSelectedFilesUI() {
        const container = document.getElementById('selectedFiles');
        if (!container) return;

        if (this.selectedFiles.length === 0) {
            container.classList.remove('active');
            container.innerHTML = '';
            return;
        }

        container.classList.add('active');
        container.innerHTML = this.selectedFiles.map((file, index) => `
            <div class="file-chip">
                <i data-feather="${this.getFileIcon(file.name)}" class="file-chip-icon"></i>
                <span>${file.name}</span>
                <span class="file-chip-remove" onclick="ChatManager.removeFile(${index})">
                    <i data-feather="x" style="width: 14px; height: 14px;"></i>
                </span>
            </div>
        `).join('');

        // 渲染新添加的图标
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    },

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.updateSelectedFilesUI();
    },

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const iconMap = {
            'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'svg': 'image',
            'pdf': 'file-text', 'doc': 'file-text', 'docx': 'file-text', 'txt': 'file-text',
            'xls': 'bar-chart-2', 'xlsx': 'bar-chart-2', 'csv': 'bar-chart-2',
            'zip': 'archive', 'rar': 'archive', '7z': 'archive',
            'mp3': 'music', 'wav': 'music', 'flac': 'music',
            'mp4': 'video', 'avi': 'video', 'mkv': 'video',
            'js': 'code', 'py': 'code', 'java': 'code', 'cpp': 'code',
        };
        return iconMap[ext] || 'file';
    },

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    async send() {
        if (this.isSending) return;

        const content = document.getElementById('chatInput').value.trim();
        const hasFiles = this.selectedFiles.length > 0;

        if (!content && !hasFiles) return;

        // 检查是否有激活的设备
        if (!AppState.config.remote_url) {
            alert('请先配对并激活设备\n\n步骤：\n1. 打开"设备管理"标签\n2. 配对远程设备\n3. 点击"激活"按钮');
            if (typeof switchTab === 'function') {
                switchTab('device');
            }
            return;
        }

        this.isSending = true;
        document.getElementById('sendBtn').disabled = true;
        document.getElementById('chatInput').value = '';

        try {
            // 如果有文件，先发送文件
            if (hasFiles) {
                await this.sendFiles(content);
            } else {
                // 只发送文本消息
                const response = await fetch('/chat/send_local', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({content: content, msg_type: 'text'})
                });

                const data = await response.json();
                if (data.success) {
                    this.loadMessages();
                } else {
                    alert('发送失败: ' + data.message);
                }
            }
        } catch (e) {
            alert('发送异常: ' + e.message);
        } finally {
            this.isSending = false;
            document.getElementById('sendBtn').disabled = false;
        }
    },

    async sendFiles(message) {
        const formData = new FormData();

        // 添加所有文件
        for (const file of this.selectedFiles) {
            formData.append('files', file);
        }

        // 添加消息文本
        if (message) {
            formData.append('message', message);
        }

        try {
            const response = await fetch('/chat/send_files', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                this.selectedFiles = [];
                this.updateSelectedFilesUI();
                this.loadMessages();
            } else {
                alert('文件发送失败: ' + data.message);
            }
        } catch (e) {
            alert('文件发送异常: ' + e.message);
        }
    },

    async loadMessages() {
        try {
            const response = await fetch('/chat/messages?limit=100');
            const data = await response.json();

            if (data.success) {
                const messagesJson = JSON.stringify(data.messages);
                if (messagesJson !== this.lastMessagesJson) {
                    this.lastMessagesJson = messagesJson;
                    this.renderMessages(data.messages);
                }
            }
        } catch (e) {
            console.error('加载消息失败:', e);
        }
    },

    renderMessages(messages) {
        const container = document.getElementById('chatMessages');
        if (!container) return;

        const shouldScroll = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;

        container.innerHTML = messages.map(msg => {
            const senderClass = msg.sender === 'local' ? 'local' : 'remote';
            const avatar = msg.sender === 'local' ? 'L' : 'R';

            let statusHtml = '';
            if (msg.sender === 'local') {
                if (msg.status === 'pending') {
                    statusHtml = '<div class="message-status pending">发送中...</div>';
                } else if (msg.status === 'sent') {
                    statusHtml = '<div class="message-status sent">已送达</div>';
                } else if (msg.status === 'failed') {
                    statusHtml = `<div class="message-status failed" onclick="retryMessage('${msg.id}')">失败,点击重试</div>`;
                }
            }

            let contentHtml = '';
            if (msg.msg_type === 'file') {
                // 文件消息
                const files = msg.files || [];
                const messageText = msg.content ? `<div style="margin-bottom: 8px;">${escapeHtml(msg.content)}</div>` : '';

                const filesHtml = files.map(file => `
                    <div class="file-item">
                        <i data-feather="${this.getFileIcon(file.name)}" class="file-icon"></i>
                        <div class="file-info">
                            <div class="file-name">${escapeHtml(file.name)}</div>
                            <div class="file-size">${this.formatFileSize(file.size)}</div>
                        </div>
                        <div class="file-actions">
                            <button class="btn-download" onclick="ChatManager.downloadFile('${file.id}', '${escapeHtml(file.name)}')">
                                <i data-feather="download" style="width: 14px; height: 14px; margin-right: 4px;"></i>
                                另存为
                            </button>
                        </div>
                    </div>
                `).join('');

                contentHtml = `<div class="file-message">${messageText}${filesHtml}</div>`;
            } else {
                // 文本消息
                const content = escapeHtml(msg.content);
                contentHtml = `<div class="message-bubble">${content}</div>`;
            }

            return `
                <div class="message ${senderClass}">
                    <div class="message-avatar">${avatar}</div>
                    <div class="message-content">
                        ${contentHtml}
                        <div class="message-time">${msg.time_str}</div>
                        ${statusHtml}
                    </div>
                </div>
            `;
        }).join('');

        if (shouldScroll) {
            container.scrollTop = container.scrollHeight;
        }

        // 渲染Feather图标
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    },

    async downloadFile(fileId, fileName) {
        try {
            const response = await fetch(`/chat/download_file/${fileId}`);
            if (!response.ok) {
                alert('文件下载失败');
                return;
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (e) {
            alert('文件下载异常: ' + e.message);
        }
    },

    async retry(msgId) {
        try {
            const response = await fetch('/chat/retry', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({msg_id: msgId})
            });

            const data = await response.json();
            if (data.success) {
                this.loadMessages();
            }
        } catch (e) {
            console.error('重试消息失败:', e);
        }
    }
};

// 全局函数（供HTML调用）
function sendMessage() {
    ChatManager.send();
}

function retryMessage(msgId) {
    ChatManager.retry(msgId);
}

function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
        ChatManager.selectedFiles = files;
        ChatManager.updateSelectedFilesUI();
    }
    // 重置input以便能够重复选择相同的文件
    event.target.value = '';
}
