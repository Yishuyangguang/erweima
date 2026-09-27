/**
 * 文件名: nav-3d-glass.js
 * 作用: 外挂式 3D 玻璃拟物化 (Glassmorphism) 导航栏渲染引擎
 * 修复: 彻底解决按钮选中状态判定错位与背景高光缺失问题
 */

(function() {
    'use strict';

    // ================= 1. 注入 3D 玻璃态物理动画与高亮选中 CSS =================
    const inject3DStyles = () => {
        if (document.getElementById('glass-3d-theme')) return;
        const style = document.createElement('style');
        style.id = 'glass-3d-theme';
        style.innerHTML = `
            /* 基础 3D 玻璃拟物按钮 (未选中状态) */
            header.admin-only button.glass-btn {
                position: relative !important;
                background: rgba(255, 255, 255, 0.8) !important;
                backdrop-filter: blur(12px) !important;
                -webkit-backdrop-filter: blur(12px) !important;
                border: 1px solid rgba(255, 255, 255, 0.95) !important;
                /* 构建物理厚度：底部浅灰色物理厚度 + 柔和扩散投影 */
                box-shadow: 
                    0 4px 0px #cbd5e1, 
                    0 8px 15px rgba(0, 0, 0, 0.05) !important;
                transform: translateY(0) !important;
                transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
                color: #4B5563 !important;
                font-weight: 600 !important;
                cursor: pointer !important;
                outline: none !important;
            }

            /* Hover悬浮：按钮轻微上浮，物理厚度增加 */
            header.admin-only button.glass-btn:hover {
                background: rgba(255, 255, 255, 0.98) !important;
                transform: translateY(-2px) !important;
                box-shadow: 
                    0 6px 0px #cbd5e1, 
                    0 12px 20px rgba(0, 0, 0, 0.08) !important;
                color: #1E90FF !important;
            }

            /* Active 选中状态：所有菜单统一享受显眼的淡蓝科技背景与物理下压凹陷感 */
            header.admin-only button.glass-btn.glass-active {
                background: rgba(219, 234, 254, 0.92) !important; /* 晶莹淡蓝背景色，告别灰暗 */
                border: 1px solid rgba(30, 144, 255, 0.45) !important;
                transform: translateY(4px) !important; /* 物理完全下压 4px */
                box-shadow: 
                    0 0px 0px #cbd5e1, 
                    inset 0 3px 6px rgba(30, 144, 255, 0.25) !important; /* 凹陷质感内部光泽 */
                color: #1E90FF !important; /* 文字亮蓝高光 */
            }
            
            /* 选中后悬浮保持下压状态，防止抖动 */
            header.admin-only button.glass-btn.glass-active:hover {
                background: rgba(219, 234, 254, 0.98) !important;
                transform: translateY(4px) !important;
                box-shadow: 
                    0 0px 0px #cbd5e1, 
                    inset 0 3px 6px rgba(30, 144, 255, 0.25) !important;
                color: #1E90FF !important;
            }

            /* 特殊高亮主操作键：组合上传 (炫彩 3D 版) */
            header.admin-only button.glass-btn-primary {
                position: relative !important;
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(99, 102, 241, 0.95)) !important;
                backdrop-filter: blur(12px) !important;
                -webkit-backdrop-filter: blur(12px) !important;
                border: 1px solid rgba(255, 255, 255, 0.3) !important;
                box-shadow: 
                    0 4px 0px #3730a3, 
                    0 8px 15px rgba(59, 130, 246, 0.3) !important;
                transform: translateY(0) !important;
                transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
                color: #ffffff !important;
                font-weight: 600 !important;
                cursor: pointer !important;
                outline: none !important;
            }
            header.admin-only button.glass-btn-primary:hover {
                background: linear-gradient(135deg, rgba(59, 130, 246, 1), rgba(99, 102, 241, 1)) !important;
                transform: translateY(-2px) !important;
                box-shadow: 
                    0 6px 0px #3730a3, 
                    0 12px 20px rgba(59, 130, 246, 0.4) !important;
            }
            header.admin-only button.glass-btn-primary:active {
                transform: translateY(4px) !important;
                box-shadow: 
                    0 0px 0px #3730a3, 
                    inset 0 3px 8px rgba(0, 0, 0, 0.3) !important;
            }
        `;
        document.head.appendChild(style);
    };

    // ================= 2. 模式与按钮文字全量精确映射字典 =================
    const modeKeywordMap = {
        'text': '文本',
        'url': '网址',
        'document': '文档',
        'image': '图片',
        'audio': '音频',
        'video': '视频',
        'form': '表单',
        'uploaded': '已上传'
    };

    // ================= 3. 渲染接管与精准选中状态控制 =================
    const apply3DStylesToButtons = (currentMode) => {
        const header = document.querySelector('header.admin-only');
        if (!header) return;

        const buttons = header.querySelectorAll('button');
        const activeKeyword = modeKeywordMap[currentMode] || '';

        buttons.forEach(btn => {
            const text = btn.innerText.trim();

            // 彻底清除旧版 Tailwind 产生的内联干扰类
            btn.classList.remove(
                'bg-white', 'shadow-sm', 'hover:shadow-md', 'ring-2', 'ring-primary/20', 'bg-blue-50',
                'bg-gradient-to-r', 'from-blue-500', 'to-indigo-500', 'text-gray-600', 'text-white'
            );

            // 专属处理“组合上传”按钮
            if (text.includes('组合上传')) {
                btn.classList.remove('glass-btn', 'glass-active');
                btn.classList.add('glass-btn-primary');
            } else {
                btn.classList.add('glass-btn');

                // 精准比对关键词，确保选中的每一个按钮都能赋予 glass-active
                if (activeKeyword && text.includes(activeKeyword)) {
                    btn.classList.add('glass-active');
                } else {
                    btn.classList.remove('glass-active');
                }
            }
        });
    };

    // ================= 4. 挂载与原生函数拦截 =================
    const mount3DEngine = () => {
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

        // 劫持 updateNavUI 函数
        targetApp.updateNavUI = function() {
            // 先执行原生逻辑保证其它 DOM 状态流转
            originalUpdateNavUI.call(this);
            // 立即实施 3D 玻璃与全按钮高亮渲染
            apply3DStylesToButtons(this.state.currentMode);
        };

        // 为所有导航栏按钮额外添加点击即时监听，提供双重保障
        const header = document.querySelector('header.admin-only');
        if (header) {
            header.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', function() {
                    const text = this.innerText.trim();
                    for (const [modeKey, keyword] of Object.entries(modeKeywordMap)) {
                        if (text.includes(keyword)) {
                            apply3DStylesToButtons(modeKey);
                            break;
                        }
                    }
                });
            });
        }

        // 首次加载立即执行一次全量更新
        if (targetApp.state && targetApp.state.currentMode) {
            apply3DStylesToButtons(targetApp.state.currentMode);
        } else {
            apply3DStylesToButtons('text');
        }
    };

    // ================= 5. 生命周期自动就绪 =================
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
