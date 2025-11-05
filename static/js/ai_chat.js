// ==== ai_chat.js - AI 聊天功能 ====

// 确保 escapeHtml 函数可用
if (typeof escapeHtml === 'undefined') {
    window.escapeHtml = function(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
}

const AIChatManager = {
    lastMessagesJson: '',
    isSending: false,
    isComposing: false,
    interval: null,
    config: null,
    currentSessionId: null,
    currentSession: null,

    init() {
        const chatInput = document.getElementById('aiChatInput');
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
                this.send();
            }
        });

        // 加载配置、会话信息和历史消息
        this.loadConfig();
        this.loadCurrentSession();
        this.loadMessages();

        // 定期刷新消息（非发送状态时）
        this.interval = setInterval(() => {
            if (!this.isSending) {
                this.loadMessages();
            }
        }, 3000);

        // 设置模态框点击外部关闭
        const settingsModal = document.getElementById('aiSettingsModal');
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) {
                    this.closeSettings();
                }
            });
        }

        // 历史记录模态框点击外部关闭
        const historyModal = document.getElementById('aiHistoryModal');
        if (historyModal) {
            historyModal.addEventListener('click', (e) => {
                if (e.target === historyModal) {
                    this.closeHistory();
                }
            });
        }
    },

    async loadConfig() {
        try {
            const response = await fetch('/ai_chat/config');
            const data = await response.json();

            if (data.success) {
                this.config = data.config;
                this.updateModelDisplay();
            }
        } catch (e) {
            console.error('加载配置失败:', e);
        }
    },

    updateModelDisplay() {
        const modelDisplay = document.getElementById('aiModelDisplay');
        if (!modelDisplay) return;

        if (this.config && this.config.model) {
            const modelNames = {
                'gemini-2.5-flash': 'Gemini 2.5 Flash',
                'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
                'gemini-2.5-pro': 'Gemini 2.5 Pro'
            };
            const displayName = modelNames[this.config.model] || this.config.model;
            modelDisplay.textContent = displayName;
        } else {
            modelDisplay.textContent = '未配置';
        }
    },

    async loadCurrentSession() {
        try {
            const response = await fetch('/ai_chat/session/current');
            const data = await response.json();

            if (data.success && data.session) {
                this.currentSession = data.session;
                this.currentSessionId = data.session.session_id;
            }
        } catch (e) {
            console.error('加载当前会话失败:', e);
        }
    },

    async send() {
        if (this.isSending) return;

        const input = document.getElementById('aiChatInput');
        const message = input.value.trim();

        if (!message) return;

        this.isSending = true;
        const sendBtn = document.getElementById('aiSendBtn');
        const originalBtnHtml = sendBtn.innerHTML;
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i data-feather="loader" class="spinning" style="width: 16px; height: 16px;"></i><span>生成中...</span>';
        if (typeof feather !== 'undefined') feather.replace();

        input.value = '';

        // 立即显示用户消息
        this.addUserMessage(message);

        // 创建 AI 消息元素（空内容）
        const container = document.getElementById('aiChatMessages');
        const timeStr = new Date().toLocaleTimeString('zh-CN', {hour12: false});
        const messageEl = this.createMessageElement('assistant', '', timeStr, '');
        container.appendChild(messageEl);
        const bubble = messageEl.querySelector('.message-bubble');

        try {
            // 使用流式接口
            const response = await fetch('/ai_chat/stream', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({message: message})
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';
            let currentModel = '';

            while (true) {
                const {done, value} = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, {stream: true});
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;

                    try {
                        const data = JSON.parse(line);

                        if (data.error) {
                            alert('错误: ' + data.error);
                            bubble.textContent = '发生错误，请重试';
                            this.loadMessages();
                            return;
                        }

                        if (data.content) {
                            fullContent += data.content;
                            // 实时渲染 Markdown
                            bubble.innerHTML = this.renderMarkdown(fullContent);
                            // 代码高亮
                            if (typeof hljs !== 'undefined') {
                                bubble.querySelectorAll('pre code').forEach((block) => {
                                    hljs.highlightElement(block);
                                });
                            }
                            // 为代码块添加copy按钮
                            this.addCopyButtonsToCodeBlocks(messageEl);
                            // 自动滚动
                            this.scrollToBottomIfNeeded(container);
                        }

                        if (data.done) {
                            currentModel = data.model || '';
                            // 更新模型标签和copy按钮
                            if (currentModel) {
                                const modelBadge = messageEl.querySelector('.message-time');
                                if (modelBadge) {
                                    const copyBtn = `<button class="btn-copy-message" onclick="AIChatManager.copyMessage(this)" title="复制消息">
                                        <i data-feather="copy" style="width: 14px; height: 14px;"></i>
                                    </button>`;
                                    modelBadge.innerHTML = `${timeStr} <span class="model-badge">${currentModel}</span> ${copyBtn}`;
                                    // 重新渲染 feather 图标
                                    if (typeof feather !== 'undefined') {
                                        feather.replace();
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.error('解析流式数据失败:', e, line);
                    }
                }
            }

            // 最后滚动一次
            this.scrollToBottomIfNeeded(container);

        } catch (e) {
            alert('发送异常: ' + e.message);
            bubble.textContent = '发送失败，请重试';
            this.loadMessages();
        } finally {
            this.isSending = false;
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalBtnHtml;
            if (typeof feather !== 'undefined') feather.replace();
        }
    },

    addUserMessage(content) {
        const container = document.getElementById('aiChatMessages');
        const messageEl = this.createMessageElement('user', content, new Date().toLocaleTimeString('zh-CN', {hour12: false}));
        container.appendChild(messageEl);
        // 只在用户已经在底部附近时才自动滚动
        this.scrollToBottomIfNeeded(container);
    },

    async addAssistantMessage(content, model) {
        const container = document.getElementById('aiChatMessages');
        const timeStr = new Date().toLocaleTimeString('zh-CN', {hour12: false});
        const messageEl = this.createMessageElement('assistant', '', timeStr, model);

        container.appendChild(messageEl);

        // 获取消息气泡元素
        const bubble = messageEl.querySelector('.message-bubble');

        // 打字机效果
        await this.typeWriter(bubble, content);

        // 打字完成后，只在用户在底部附近时才滚动
        this.scrollToBottomIfNeeded(container);
    },

    async typeWriter(element, text, speed = 20) {
        // 首先渲染完整的 Markdown
        const renderedHtml = this.renderMarkdown(text);

        // 创建临时 div 来解析 HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = renderedHtml;

        // 逐字符添加到元素中
        let currentIndex = 0;
        const fullText = tempDiv.textContent;

        // 使用临时文本节点来实现打字效果
        element.innerHTML = '';
        const textNode = document.createTextNode('');
        element.appendChild(textNode);

        return new Promise((resolve) => {
            const timer = setInterval(() => {
                if (currentIndex < fullText.length) {
                    textNode.textContent = fullText.substring(0, currentIndex + 1);
                    currentIndex++;
                    // 只在用户已经在底部附近时才自动滚动
                    const container = document.getElementById('aiChatMessages');
                    this.scrollToBottomIfNeeded(container);
                } else {
                    clearInterval(timer);
                    // 打字完成后，替换为完整的渲染 HTML
                    element.innerHTML = renderedHtml;
                    // 重新渲染代码高亮
                    if (typeof hljs !== 'undefined') {
                        element.querySelectorAll('pre code').forEach((block) => {
                            hljs.highlightElement(block);
                        });
                    }
                    // 为代码块添加copy按钮
                    const messageEl = element.closest('.message');
                    if (messageEl) {
                        this.addCopyButtonsToCodeBlocks(messageEl);
                    }
                    resolve();
                }
            }, speed);
        });
    },

    createMessageElement(role, content, timeStr, model = '') {
        const div = document.createElement('div');
        div.className = `message ${role === 'user' ? 'local' : 'remote'}`;

        const avatar = role === 'user' ? 'U' : 'AI';
        const renderedContent = role === 'user' ? escapeHtml(content) : this.renderMarkdown(content);

        const modelBadge = model ? `<span class="model-badge">${model}</span>` : '';

        // 为AI消息添加copy按钮 (判断非用户消息)
        const copyButton = role !== 'user' ?
            `<button class="btn-copy-message" onclick="AIChatManager.copyMessage(this)" title="复制消息">
                <i data-feather="copy" style="width: 14px; height: 14px;"></i>
            </button>` : '';

        div.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-bubble markdown-content">${renderedContent}</div>
                <div class="message-time">
                    ${timeStr} ${modelBadge}
                    ${copyButton}
                </div>
            </div>
        `;

        return div;
    },

    renderMarkdown(text) {
        if (typeof marked === 'undefined') {
            return escapeHtml(text).replace(/\n/g, '<br>');
        }

        // 配置 marked
        marked.setOptions({
            breaks: true,
            gfm: true,
            highlight: function(code, lang) {
                if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (e) {
                        console.error('代码高亮失败:', e);
                    }
                }
                return escapeHtml(code);
            }
        });

        return marked.parse(text);
    },

    scrollToBottomIfNeeded(container) {
        // 检查用户是否已经在底部附近（距离底部小于100px）
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        const isNearBottom = distanceFromBottom < 100;

        // 只在用户已经在底部附近时才自动滚动
        if (isNearBottom) {
            container.scrollTop = container.scrollHeight;
        }
    },

    async loadMessages() {
        try {
            const response = await fetch('/ai_chat/messages?limit=100');
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
        const container = document.getElementById('aiChatMessages');
        if (!container) return;

        const shouldScroll = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;

        // 保留欢迎消息
        const welcomeMsg = container.querySelector('.message.remote');
        container.innerHTML = '';
        if (welcomeMsg && messages.length === 0) {
            container.appendChild(welcomeMsg);
        }

        messages.forEach(msg => {
            const messageEl = this.createMessageElement(
                msg.role,
                msg.content,
                msg.time_str,
                msg.model
            );
            container.appendChild(messageEl);
        });

        if (shouldScroll) {
            container.scrollTop = container.scrollHeight;
        }

        // 渲染代码高亮
        if (typeof hljs !== 'undefined') {
            container.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }

        // 为代码块添加copy按钮
        this.addCopyButtonsToCodeBlocks(container);

        // 重新渲染 feather 图标
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    },

    // 设置相关方法
    openSettings() {
        const modal = document.getElementById('aiSettingsModal');
        if (!modal) return;

        // 加载当前配置
        this.loadSettingsForm();
        modal.classList.add('active');
    },

    closeSettings() {
        const modal = document.getElementById('aiSettingsModal');
        if (modal) {
            modal.classList.remove('active');
        }
    },

    async loadSettingsForm() {
        try {
            const response = await fetch('/ai_chat/config');
            const data = await response.json();

            if (data.success) {
                const config = data.config;
                // 固定为 Gemini 提供商
                document.getElementById('aiProvider').value = 'gemini';

                // API 密钥特殊处理：如果包含星号（已隐藏），则用 placeholder 提示，不填充 value
                const apiKeyInput = document.getElementById('aiApiKey');
                if (config.api_key && config.api_key.includes('*')) {
                    apiKeyInput.value = '';
                    apiKeyInput.placeholder = '已保存（留空则不修改）';
                } else {
                    apiKeyInput.value = config.api_key || '';
                    apiKeyInput.placeholder = '请输入 Gemini API Key';
                }

                document.getElementById('aiApiBase').value = config.api_base || 'https://generativelanguage.googleapis.com/v1beta';
                document.getElementById('aiModel').value = config.model || 'gemini-2.5-flash';
                document.getElementById('aiMaxTokens').value = config.max_tokens || 2000;
                document.getElementById('aiTemperature').value = config.temperature || 0.7;
                document.getElementById('aiMaxHistory').value = config.max_history || 20;
            }
        } catch (e) {
            console.error('加载设置失败:', e);
        }
    },

    // 提供商变更处理（当前固定为 Gemini，保留函数以备未来扩展）
    onProviderChange() {
        // 当前版本固定使用 Gemini，此函数暂时无需操作
        // 未来支持多提供商时可在此处添加逻辑
    },

    toggleApiKeyVisibility() {
        const input = document.getElementById('aiApiKey');
        const icon = document.getElementById('apiKeyToggleIcon');

        if (input.type === 'password') {
            input.type = 'text';
            icon.setAttribute('data-feather', 'eye-off');
        } else {
            input.type = 'password';
            icon.setAttribute('data-feather', 'eye');
        }

        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    },

    async saveSettings() {
        const apiKeyInput = document.getElementById('aiApiKey').value.trim();

        // 如果 API 密钥输入框为空，先获取当前配置中的密钥
        let finalApiKey = apiKeyInput;
        if (!apiKeyInput) {
            // 输入框为空，使用当前保存的密钥
            try {
                const currentConfigResponse = await fetch('/ai_chat/config');
                const currentConfigData = await currentConfigResponse.json();
                if (currentConfigData.success && currentConfigData.config.api_key) {
                    // 使用隐藏的密钥（后端会自动处理保留原密钥）
                    finalApiKey = currentConfigData.config.api_key;
                }
            } catch (e) {
                console.error('获取当前配置失败:', e);
            }
        }

        const config = {
            provider: 'gemini',  // 固定为 Gemini
            api_key: finalApiKey,
            api_base: document.getElementById('aiApiBase').value,
            model: document.getElementById('aiModel').value,
            max_tokens: parseInt(document.getElementById('aiMaxTokens').value),
            temperature: parseFloat(document.getElementById('aiTemperature').value),
            max_history: parseInt(document.getElementById('aiMaxHistory').value)
        };

        // 验证必填项
        if (!config.api_key) {
            alert('请输入 API 密钥');
            return;
        }

        if (!config.api_base) {
            alert('请输入 API 端点\n\n官方端点: https://generativelanguage.googleapis.com/v1beta\n或使用你的中转服务地址');
            return;
        }

        try {
            const response = await fetch('/ai_chat/config', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(config)
            });

            const data = await response.json();

            if (data.success) {
                alert('✅ 设置已保存');
                // 重新加载配置以更新显示
                await this.loadConfig();
                this.closeSettings();
            } else {
                alert('保存失败: ' + data.message);
            }
        } catch (e) {
            alert('保存异常: ' + e.message);
        }
    },

    async clearHistory() {
        if (!confirm('确定要清空所有聊天历史吗？此操作不可恢复。')) {
            return;
        }

        try {
            const response = await fetch('/ai_chat/clear', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            });

            const data = await response.json();

            if (data.success) {
                this.lastMessagesJson = '';
                this.loadMessages();
            } else {
                alert('清空失败: ' + data.message);
            }
        } catch (e) {
            alert('清空异常: ' + e.message);
        }
    },

    async newChat() {
        if (!confirm('确定要开始新对话吗？\n\n当前对话不会被删除，可以通过"记录"按钮查看历史对话。')) {
            return;
        }

        try {
            // 调用 API 创建新会话
            const response = await fetch('/ai_chat/session/new', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({title: '新对话'})
            });

            const data = await response.json();

            if (data.success) {
                // 更新当前会话信息
                this.currentSession = data.session;
                this.currentSessionId = data.session.session_id;

                // 清空消息显示
                this.lastMessagesJson = '';
                const container = document.getElementById('aiChatMessages');
                if (container) {
                    const modelName = this.config?.model || '未配置';
                    container.innerHTML = `
                        <div class="message remote">
                            <div class="message-avatar">AI</div>
                            <div class="message-content">
                                <div class="message-bubble markdown-content">
                                    你好！这是一个新的对话。你可以向我提问任何问题，我会尽力帮助你。
                                    <br><br>
                                    <strong>提示：</strong>
                                    <ul style="margin: 8px 0; padding-left: 20px;">
                                        <li>我支持 Markdown 格式和代码高亮</li>
                                        <li>之前的对话已保存，可通过"记录"按钮查看</li>
                                        <li>当前使用模型：${modelName}</li>
                                    </ul>
                                </div>
                                <div class="message-time">--:--:--</div>
                            </div>
                        </div>
                    `;
                }

                // 清空输入框
                const input = document.getElementById('aiChatInput');
                if (input) {
                    input.value = '';
                }

                // 显示成功提示
                this.showToast('已创建新对话', 'success');
            } else {
                alert('创建新对话失败: ' + data.message);
            }
        } catch (e) {
            alert('创建新对话异常: ' + e.message);
        }
    },

    async openHistory() {
        // 打开历史记录弹窗
        const modal = document.getElementById('aiHistoryModal');
        if (modal) {
            modal.style.display = 'flex';
            // 加载会话列表
            await this.loadSessions();
            // 重新绘制 feather 图标
            if (typeof feather !== 'undefined') feather.replace();
        }
    },

    closeHistory() {
        const modal = document.getElementById('aiHistoryModal');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    async loadSessions() {
        try {
            const response = await fetch('/ai_chat/sessions');
            const data = await response.json();

            if (data.success) {
                this.renderSessions(data.sessions);
            } else {
                console.error('加载会话列表失败:', data.message);
            }
        } catch (e) {
            console.error('加载会话列表异常:', e);
        }
    },

    renderSessions(sessions) {
        const listContainer = document.getElementById('aiSessionList');
        const emptyContainer = document.getElementById('aiSessionEmpty');

        if (!listContainer) return;

        if (sessions.length === 0) {
            listContainer.innerHTML = '';
            if (emptyContainer) emptyContainer.style.display = 'block';
            return;
        }

        if (emptyContainer) emptyContainer.style.display = 'none';

        listContainer.innerHTML = sessions.map(session => {
            const isActive = session.session_id === this.currentSessionId;
            const activeClass = isActive ? 'active' : '';

            return `
                <div class="session-item ${activeClass}" onclick="AIChatManager.switchSession('${session.session_id}')">
                    <div class="session-info">
                        <div class="session-title">${escapeHtml(session.title)}</div>
                        <div class="session-meta">
                            <span>
                                <i data-feather="message-circle" style="width: 13px; height: 13px;"></i>
                                ${session.message_count} 条消息
                            </span>
                            <span>
                                <i data-feather="clock" style="width: 13px; height: 13px;"></i>
                                ${session.updated_at_str}
                            </span>
                        </div>
                    </div>
                    <div class="session-actions" onclick="event.stopPropagation()">
                        <button class="btn-icon" onclick="AIChatManager.deleteSession('${session.session_id}')" title="删除">
                            <i data-feather="trash-2" style="width: 16px; height: 16px;"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // 重新绘制 feather 图标
        if (typeof feather !== 'undefined') feather.replace();
    },

    async switchSession(sessionId) {
        if (sessionId === this.currentSessionId) {
            // 已经是当前会话，只关闭弹窗
            this.closeHistory();
            return;
        }

        try {
            const response = await fetch(`/ai_chat/session/${sessionId}/switch`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                // 更新当前会话信息
                this.currentSession = data.session;
                this.currentSessionId = data.session.session_id;

                // 重新加载消息
                this.lastMessagesJson = '';
                await this.loadMessages();

                // 关闭弹窗
                this.closeHistory();

                // 显示成功提示
                this.showToast(`已切换到「${data.session.title}」`, 'success');
            } else {
                alert('切换会话失败: ' + data.message);
            }
        } catch (e) {
            alert('切换会话异常: ' + e.message);
        }
    },

    async deleteSession(sessionId) {
        if (!confirm('确定要删除这个会话吗？\n\n删除后将无法恢复。')) {
            return;
        }

        try {
            const response = await fetch(`/ai_chat/session/${sessionId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                // 重新加载会话列表
                await this.loadSessions();

                // 如果删除的是当前会话，重新加载当前会话和消息
                if (sessionId === this.currentSessionId) {
                    await this.loadCurrentSession();
                    this.lastMessagesJson = '';
                    await this.loadMessages();
                    this.showToast('会话已删除，已自动切换到其他会话', 'info');
                } else {
                    this.showToast('会话已删除', 'success');
                }
            } else {
                alert('删除会话失败: ' + data.message);
            }
        } catch (e) {
            alert('删除会话异常: ' + e.message);
        }
    },

    // 复制消息内容
    copyMessage(button) {
        const messageContent = button.closest('.message-content');
        const bubble = messageContent.querySelector('.message-bubble');

        // 获取纯文本内容
        const textContent = bubble.innerText || bubble.textContent;

        this.copyToClipboard(textContent, button);
    },

    // 复制代码块内容
    copyCode(button) {
        const codeBlock = button.closest('pre').querySelector('code');
        const textContent = codeBlock.innerText || codeBlock.textContent;

        this.copyToClipboard(textContent, button);
    },

    // 通用复制到剪贴板方法
    copyToClipboard(text, button) {
        navigator.clipboard.writeText(text).then(() => {
            // 显示复制成功提示
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i data-feather="check" style="width: 14px; height: 14px;"></i>';
            if (typeof feather !== 'undefined') feather.replace();

            button.classList.add('copied');

            setTimeout(() => {
                button.innerHTML = originalHTML;
                if (typeof feather !== 'undefined') feather.replace();
                button.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('复制失败:', err);
            alert('复制失败，请重试');
        });
    },

    // 为代码块添加copy按钮
    addCopyButtonsToCodeBlocks(container) {
        const codeBlocks = container.querySelectorAll('pre code');
        codeBlocks.forEach(block => {
            const pre = block.parentElement;

            // 检查是否已经添加了copy按钮
            if (pre.querySelector('.btn-copy-code')) {
                return;
            }

            // 创建copy按钮
            const copyBtn = document.createElement('button');
            copyBtn.className = 'btn-copy-code';
            copyBtn.title = '复制代码';
            copyBtn.innerHTML = '<i data-feather="copy" style="width: 14px; height: 14px;"></i>';
            copyBtn.onclick = () => this.copyCode(copyBtn);

            // 将按钮添加到pre元素
            pre.style.position = 'relative';
            pre.appendChild(copyBtn);

            // 重新渲染feather图标
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        });
    },

    // 显示toast提示
    showToast(message, type = 'info') {
        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = `ai-toast ai-toast-${type}`;
        toast.textContent = message;

        // 添加到页面
        document.body.appendChild(toast);

        // 触发动画
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // 3秒后移除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }
};

// 添加 spinning 动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    .spinning {
        animation: spin 1s linear infinite;
    }
    .model-badge {
        display: inline-block;
        padding: 2px 6px;
        margin-left: 6px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        font-size: 11px;
        color: var(--text-secondary);
    }
`;
document.head.appendChild(style);
