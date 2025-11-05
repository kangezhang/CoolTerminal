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

// 初始化
window.onload = async function() {
    console.log('CoolTerminal 初始化...');

    // 初始化终端
    if (typeof TerminalManager !== 'undefined') {
        TerminalManager.init();
    }

    console.log('CoolTerminal 启动完成！');
};
