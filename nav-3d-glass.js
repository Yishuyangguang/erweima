/**
 * 文件名: nav-3d-glass.js
 * 作用: 3D 玻璃拟物化导航栏独立外挂引擎
 * 特性: 兼容全局 const/window 作用域，无损接管 UI 动效与选中反馈
 */
(function() {
    'use strict';

    // 1. 注入 3D 玻璃态物理动画 CSS
    const inject3DStyles = () => {
        if (document.getElementById('glass-3d-theme')) return;
        const style = document.createElement('style');
        style.id = 'glass-3d-theme';
        style.innerHTML = `
            /* 基础 3D 玻璃拟物按钮 (未选中状态) */
            header.admin-only button.glass-btn {
                position: relative !important;
                background: rgba(255, 255, 255, 0.75) !important;
                backdrop-filter: blur(12px) !important;
                -webkit-backdrop-filter: blur(12px) !important;
                border: 1px solid rgba(255, 255, 255, 0.9) !important;
                box-shadow: 0 4px 0px #cbd5e1, 0 8px 15px rgba(0, 0, 0, 0.05) !important;
                transform: translateY(0);
                transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
                color: #4B5563 !important;
                font-weight: 600 !important;
                cursor: pointer;
            }

            /* 鼠标悬浮微上浮，厚度增加 */
            header.admin-only button.glass-btn:hover {
                background: rgba(255, 255, 255, 0.95) !important;
                transform: translateY(-2px) !important;
                box-shadow: 0 6px 0px #cbd5e1, 0 12px 20px rgba(0, 0, 0, 0.08) !important;
                color: #1E90FF !important;
            }

            /* Active 选中状态：物理深度下压 4px，底座厚度隐去，呈现科技蓝凹陷高光 */
            header.admin-only button.glass-btn.glass-active {
                background: rgba(235, 245, 255, 0.9) !important;
                border: 1px solid rgba(30, 144, 255, 0.4) !important;
                transform: translateY(4px) !important;
                box-shadow: 0 0px 0px #cbd5e1, inset 0 3px 6px rgba(30, 144, 255, 0.25) !important;
                color: #1E90FF !important;
            }
            
            header.admin-only button.glass-btn.glass-active:hover {
                transform: translateY(4px) !important;
                box-shadow: 0 0px 0px #cbd5e1, inset 0 3px 6px rgba(30, 144, 255, 0.25) !important;
            }

            /* 独立高亮：组合上传 (炫彩 3D 版) */
            header.admin-only button.glass-btn-primary {
                position: relative !important;
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(99, 102, 241, 0.95)) !important;
                backdrop-filter: blur(12px) !important;
                -webkit-backdrop-filter: blur(12px) !important;
                border: 1px solid rgba(255, 255, 255, 0.3) !important;
                box-shadow: 0 4px 0px #3730a3, 0 8px 15px rgba(59, 130, 246, 0.3) !important;
                transform: translateY(0);
                transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
                color: #ffffff !important;
                font-weight: 600 !important;
                cursor: pointer;
            }

            header.admin-only button.glass-btn-primary:hover {
                background: linear-gradient(135deg, rgba(59, 130, 246, 1), rgba(99, 102, 241, 1)) !important;
                transform: translateY(-2px) !important;
                box-shadow: 0 6px 0px #3730a3, 0 12px 20px rgba(59, 130, 246, 0.4) !important;
            }

            header.admin-only button.glass-btn-primary:active {
                transform: translateY(4px) !important;
                box-shadow: 0 0px 0px #3730a3, inset 0 3px 8px rgba(0, 0, 0, 0.3) !important;
            }
        `;
        document.head.appendChild(style);
    };

    // 2. 安全嗅探并接管导航渲染
    const mount3DEngine = () => {
        // 双重寻址兼容：兼容 window.app 或全局 const app
        let targetApp = null;
        if (typeof window.app !== 'undefined') {
            targetApp = window.app;
        } else if (typeof app !== 'undefined') {
            targetApp = app;
        }

        if (!targetApp || typeof targetApp.updateNavUI !== 'function') {
            setTimeout(mount3DEngine, 50);
            return;
        }

        const originalUpdateNavUI = targetApp.updateNavUI;

        // 劫持并重构导航样式
        targetApp.updateNavUI = function() {
            // 先执行原生逻辑保证数据状态正常流转
            originalUpdateNavUI.call(this);

            const header = document.querySelector('header.admin-only');
            if (!header) return;

            const buttons = header.querySelectorAll('button');
            const currentMode = this.state.currentMode;
            const currentTitleFeature = this.configs[currentMode] ? this.configs[currentMode].title.substring(2).toLowerCase() : '';

            buttons.forEach(btn => {
                const text = btn.innerText.toLowerCase();

                // 清除 Tailwind 原生影响 3D 表现的类名
                btn.classList.remove(
                    'bg-white', 'shadow-sm', 'hover:shadow-md', 'ring-2', 'ring-primary/20', 'bg-blue-50',
                    'bg-gradient-to-r', 'from-blue-500', 'to-indigo-500', 'text-gray-600', 'text-white'
                );

                if (text.includes('组合上传')) {
                    btn.classList.remove('glass-btn', 'glass-active');
                    btn.classList.add('glass-btn-primary');
                } else {
                    btn.classList.add('glass-btn');

                    let isActive = false;
                    if (currentMode === 'uploaded' && text.includes('已上传')) {
                        isActive = true;
                    } else if (currentMode !== 'uploaded' && text.includes(currentTitleFeature)) {
                        isActive = true;
                    }

                    if (isActive) {
                        btn.classList.add('glass-active');
                    } else {
                        btn.classList.remove('glass-active');
                    }
                }
            });
        };

        // 挂载完成后立即触发一次样式渲染
        targetApp.updateNavUI();
    };

    // 3. 执行挂载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            inject3DStyles();
            mount3DEngine();
        });
    } else {
        inject3DStyles();
        mount3DEngine();
    }
})();
