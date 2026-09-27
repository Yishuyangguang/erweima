/**
 * 文件名: url-engine-enhancer.js
 * 作用: 独立外挂 - 网址活码/静态码高级 UI 与交互增强引擎
 * 说明: 零侵入劫持 index.html 原生 app 对象，动态重绘 URL 配置面板，完美还原图示设计
 */

(function() {
    'use strict';

    const mountUrlEngine = () => {
        // 双重寻址兼容：兼容 window.app 或全局 const app
        let targetApp = null;
        if (typeof window.app !== 'undefined') {
            targetApp = window.app;
        } else if (typeof app !== 'undefined') {
            targetApp = app;
        }

        // 等待核心 app 挂载完毕
        if (!targetApp || typeof targetApp.renderInputArea !== 'function') {
            setTimeout(mountUrlEngine, 50);
            return;
        }

        // 保存原生的渲染函数
        const originalRenderInputArea = targetApp.renderInputArea;

        // 【核心拦截与重绘】
        targetApp.renderInputArea = function() {
            // 1. 优先执行原生渲染，保证其他模块 (如文本、图片等) 的正常运作
            originalRenderInputArea.call(this);

            // 2. 仅当处于 "网址" 模式时，实施点对点的深度 UI 重组
            if (this.state.currentMode === 'url') {
                const area = document.getElementById('dynamic-input-area');
                if (!area) return;

                const isStatic = this.state.urlConfig.mode === 'static';
                
                // 3. 构建 1:1 完美复刻的 HTML 模板
                area.innerHTML = `
                    <!-- 顶部双轨制切换 Tab -->
                    <div class="flex justify-center gap-12 mb-8 border-b border-gray-100 pb-0">
                        <div onclick="app.switchUrlMode('static')" class="cursor-pointer font-bold pb-3 border-b-[3px] transition-all px-2 ${isStatic ? 'text-gray-500 border-gray-400' : 'text-gray-400 border-transparent hover:text-gray-500'}">
                            网址静态码
                        </div>
                        <div onclick="app.switchUrlMode('live')" class="cursor-pointer font-bold pb-3 border-b-[3px] transition-all px-2 ${!isStatic ? 'text-primary border-primary' : 'text-gray-400 border-transparent hover:text-primary'}">
                            网址活码
                        </div>
                    </div>

                    <!-- 居中高亮网址输入框 -->
                    <div class="flex items-center bg-gray-50 border border-gray-200 rounded-xl p-4 px-6 focus-within:ring-4 focus-within:ring-primary/20 focus-within:border-primary transition-all shadow-sm mb-8">
                        <span class="text-gray-500 mr-3 font-black text-lg tracking-wider">https://</span>
                        <input type="text" id="input-data" class="flex-1 bg-transparent border-none outline-none py-1 text-gray-800 font-medium text-[16px] placeholder-gray-400" 
                            placeholder="请输入目标网址..." 
                            value="${isStatic ? this.state.urlConfig.staticUrl.replace(/^https?:\/\//,'') : ''}" 
                            onkeyup="${isStatic ? 'app.handleStaticUrlInput(this.value)' : ''}">
                    </div>

                    <!-- 进阶教程 / 特性说明精美卡片 -->
                    <div class="p-6 rounded-[14px] ${isStatic ? 'bg-gray-50 border border-gray-200' : 'bg-[#f4f9ff] border border-blue-100 shadow-sm'}">
                        <h4 class="font-bold mb-4 text-[17px] flex items-center ${isStatic ? 'text-gray-700' : 'text-[#2563eb]'}">
                            <i class="fas ${isStatic ? 'fa-bolt text-gray-500' : 'fa-chart-line text-[#3b82f6]'} mr-2.5 text-xl"></i>
                            ${isStatic ? '静态码特性说明' : '网址活码进阶教程'}
                        </h4>
                        
                        ${isStatic ? `
                            <p class="text-[14px] leading-relaxed text-gray-600">
                                生成速度快，扫码后手机直接强行跳转到该网页。<br>
                                <span class="inline-block mt-3 px-3 py-1.5 bg-red-50 text-red-500 rounded-md font-medium text-[13px] border border-red-100">
                                    <i class="fas fa-exclamation-triangle mr-1"></i> 注意：生成后内容与链接物理锁定，不可修改，无法统计扫码量。
                                </span>
                            </p>
                        ` : `
                            <div class="text-[14px] leading-[1.85] text-[#1d4ed8] font-medium tracking-wide">
                                <p class="mb-1">可以把网址链接做成活码。制作活码的优点是：</p>
                                <p class="pl-1">1. 可以后台随时统计二维码的扫码次数、来源区域等数据。</p>
                                <p class="pl-1">2. 万一原网址失效或被微信恶意拦截，您可以随时在这里替换新链接，而<span class="text-red-500 font-bold mx-1">原二维码图案永久不变</span>，无需重新印刷！</p>
                            </div>
                        `}
                    </div>
                `;
            }
        };

        // 如果用户一进页面就在网址栏，或者刷新页面，则立刻进行一次无感重绘
        if (targetApp.state && targetApp.state.currentMode === 'url') {
            targetApp.renderInputArea();
        }
    };

    // 启动挂载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountUrlEngine);
    } else {
        mountUrlEngine();
    }
})();
