/**
 * 文件名: nav-3d-glass.js
 * 作用: 外挂式 3D 玻璃拟物化 (Glassmorphism) 导航栏渲染引擎
 * 机制: 无损劫持 index.html 原生 app 对象，提供纯物理沉浸式交互
 */

(function() {
    'use strict';

    // ================= 1. 注入 3D 玻璃态物理动画 CSS =================
    const inject3DStyles = () => {
        const style = document.createElement('style');
        style.id = 'glass-3d-theme';
        style.innerHTML = `
            /* 基础 3D 玻璃按钮 (未选中状态) */
            .glass-btn {
                position: relative;
                background: rgba(255, 255, 255, 0.65) !important;
                backdrop-filter: blur(12px) !important;
                -webkit-backdrop-filter: blur(12px) !important;
                border: 1px solid rgba(255, 255, 255, 0.9) !important;
                /* 构建物理厚度：底部深灰色纯色阴影 + 外围柔和扩散阴影 */
                box-shadow: 
                    0 4px 0px #cbd5e1, 
                    0 8px 15px rgba(0, 0, 0, 0.05) !important;
                transform: translateY(0);
                transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
                color: #4B5563 !important;
                font-weight: 600 !important;
                cursor: pointer;
            }

            /* Hover悬浮：按钮轻轻上浮，厚度增加 */
            .glass-btn:hover {
                background: rgba(255, 255, 255, 0.95) !important;
                transform: translateY(-2px) !important;
                box-shadow: 
                    0 6px 0px #cbd5e1, 
                    0 12px 20px rgba(0, 0, 0, 0.08) !important;
                color: #1E90FF !important;
            }

            /* Active 选中状态：极其明显的物理下压，底部厚度消失，变为内部发光凹陷 */
            .glass-btn.glass-active {
                background: rgba(235, 245, 255, 0.85) !important; /* 透出淡淡科技蓝 */
                border: 1px solid rgba(30, 144, 255, 0.3) !important;
                transform: translateY(4px) !important; /* 物理极限下压 */
                box-shadow: 
                    0 0px 0px #cbd5e1, 
                    inset 0 3px 6px rgba(30, 144, 255, 0.2) !important; /* 凹陷质感阴影 */
                color: #1E90FF !important;
            }
            
            /* 避免选中状态 Hover 时发生抖动 */
            .glass-btn.glass-active:hover {
                transform: translateY(4px) !important;
                box-shadow: 
                    0 0px 0px #cbd5e1, 
                    inset 0 3px 6px rgba(30, 144, 255, 0.2) !important;
            }

            /* 特殊高亮主按钮：组合上传 (炫彩 3D 版) */
            .glass-btn-primary {
                position: relative;
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(99, 102, 241, 0.9)) !important;
                backdrop-filter: blur(12px) !important;
                -webkit-backdrop-filter: blur(12px) !important;
                border: 1px solid rgba(255, 255, 255, 0.25) !important;
                box-shadow: 
                    0 4px 0px #3730a3, /* 深靛蓝物理底座 */
                    0 8px 15px rgba(59, 130, 246, 0.3) !important;
                transform: translateY(0);
                transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
                color: #ffffff !important;
                font-weight: 600 !important;
                cursor: pointer;
            }
            .glass-btn-primary:hover {
                background: linear-gradient(135deg, rgba(59, 130, 246, 1), rgba(99, 102, 241, 1)) !important;
                transform: translateY(-2px) !important;
                box-shadow: 
                    0 6px 0px #3730a3, 
                    0 12px 20px rgba(59, 130, 246, 0.4) !important;
            }
            /* 点击组合上传时的按下反馈 */
            .glass-btn-primary:active {
                transform: translateY(4px) !important;
                box-shadow: 
                    0 0px 0px #3730a3, 
                    inset 0 3px 8px rgba(0, 0, 0, 0.3) !important;
            }
        `;
        document.head.appendChild(style);
    };

    // ================= 2. 拦截并重写 index.html 原生导航更新引擎 =================
    const mount3DEngine = () => {
        // 安全等待底层 app 对象初始化完成
        if (!window.app || !window.app.updateNavUI) {
            setTimeout(mount3DEngine, 50);
            return;
        }

        // 保存原生的更新逻辑备份
        const originalUpdateNavUI = window.app.updateNavUI;

        // 【核心劫持】：覆盖原函数
        window.app.updateNavUI = function() {
            
            // 1. 先让老代码无损执行（用于更新标题、文字提示等内在状态）
            originalUpdateNavUI.call(this);

            // 2. 捕获导航栏 DOM 实施大换血
            const header = document.querySelector('header.admin-only');
            if (!header) return;

            const buttons = header.querySelectorAll('button');
            const currentMode = this.state.currentMode;
            
            // 获取当前所处模块的文字特征 (排除原生"添加"两字)
            const currentTitleFeature = this.configs[currentMode] ? this.configs[currentMode].title.substring(2).toLowerCase() : '';

            buttons.forEach(btn => {
                const text = btn.innerText.toLowerCase();

                // 物理擦除 Tailwind 原生的全部扁平化与颜色类名
                btn.classList.remove(
                    'bg-white', 'shadow-sm', 'hover:shadow-md', 'ring-2', 'ring-primary/20', 'bg-blue-50',
                    'bg-gradient-to-r', 'from-blue-500', 'to-indigo-500', 'text-gray-600', 'text-white'
                );

                // 核心分发：是否为独立的“组合上传”功能键
                if (text.includes('组合上传')) {
                    btn.classList.remove('glass-btn', 'glass-active');
                    btn.classList.add('glass-btn-primary');
                } else {
                    // 赋予普通 3D 玻璃皮肤
                    btn.classList.add('glass-btn');
                    
                    // 【状态判定算法重塑】：精准判定当前是哪一个菜单被点击
                    let isActive = false;
                    
                    if (currentMode === 'uploaded' && text.includes('已上传')) {
                        isActive = true;
                    } else if (currentMode !== 'uploaded' && text.includes(currentTitleFeature)) {
                        isActive = true;
                    }

                    // 控制物理按下状态（让用户一眼就能看出选中的是谁）
                    if (isActive) {
                        btn.classList.add('glass-active');
                    } else {
                        btn.classList.remove('glass-active');
                    }
                }
            });
        };

        // 挂载完毕后，立即无感触发一次极速重绘
        window.app.updateNavUI();
    };

    // ================= 3. 启动生命周期钩子 =================
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
