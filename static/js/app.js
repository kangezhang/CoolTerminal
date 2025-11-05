// ==== app.js - 主应用逻辑 ====

// 工具函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 关于弹窗
function showAbout() {
    alert(`
╔════════════════════════════════════════╗
║     CoolTerminal v1.0.0              ║
║     现代化终端模拟器                  ║
╚════════════════════════════════════════╝

✨ 功能特性：
- 打字机效果的命令输出
- 智能命令历史（50条不重复）
- 双模式：模拟命令 / 真实命令
- 右侧可开关历史面板
- 上下键快速导航历史

🔒 安全特性：
- 危险命令拦截
- 执行超时保护（10秒）
- 完善的错误处理

🛠️ 技术栈：
- 后端：Python Flask
- 前端：原生 JavaScript + CSS3
- 图标：Feather Icons

Made with ❤️ by CoolTerminal Team
    `);
}

// 命令参考手册模态框
function openCommandReference() {
    const modal = document.getElementById('commandReferenceModal');
    if (modal) {
        modal.classList.add('active');

        // 替换 Feather 图标
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }
}

function closeCommandReference() {
    const modal = document.getElementById('commandReferenceModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// 点击模态框外部区域关闭
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        closeCommandReference();
    }
});

function switchPlatformTab(platform) {
    // 移除所有标签的活动状态
    document.querySelectorAll('.platform-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // 隐藏所有内容
    document.querySelectorAll('.platform-content').forEach(content => {
        content.classList.remove('active');
    });

    // 激活选中的标签和内容
    const selectedTab = document.querySelector(`.platform-tab[onclick*="${platform}"]`);
    const selectedContent = document.getElementById(`content-${platform}`);

    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    if (selectedContent) {
        selectedContent.classList.add('active');
    }
}

// 将命令插入到输入框
function insertCommand(command) {
    const input = document.getElementById('terminalInput');
    if (input) {
        // 追加命令到现有内容后面
        const currentValue = input.value;
        if (currentValue && !currentValue.endsWith(' ')) {
            input.value = currentValue + ' ' + command;
        } else {
            input.value = currentValue + command;
        }

        // 关闭模态框
        closeCommandReference();

        // 聚焦输入框并将光标移到末尾
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }
}

// Sidebar 收缩/展开
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const body = document.body;

    if (sidebar && body) {
        sidebar.classList.toggle('collapsed');
        body.classList.toggle('sidebar-collapsed');

        // 保存状态到 localStorage
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebar-collapsed', isCollapsed);

        // 重新渲染 Feather 图标
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }
}

// 加载 sidebar 状态
function loadSidebarState() {
    const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    if (isCollapsed) {
        const sidebar = document.getElementById('sidebar');
        const body = document.body;
        if (sidebar && body) {
            sidebar.classList.add('collapsed');
            body.classList.add('sidebar-collapsed');
        }
    }
}

// 初始化
window.onload = async function() {
    console.log('CoolTerminal 初始化...');

    // 加载 sidebar 状态
    loadSidebarState();

    // 初始化终端
    if (typeof TerminalManager !== 'undefined') {
        TerminalManager.init();
    }

    console.log('CoolTerminal 启动完成！');
};
