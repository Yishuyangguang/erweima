/**
 * 文件名: tracker.js
 * 作用: 独立扫码统计探针
 * 机制: 仅在游客模式下生效，利用 Session 锁防止刷量
 */
(function() {
    'use strict';
    if (typeof window === 'undefined') return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const viewMode = urlParams.get('view');
    const blockId = urlParams.get('id');

    // 仅在访客浏览活码时触发统计
    if (viewMode === 'live' && blockId) {
        const trackKey = `tracked_${blockId}`;
        // 防刷量机制：同一会话内不重复统计
        if (!sessionStorage.getItem(trackKey)) {
            fetch(`/api/track?id=${blockId}`, { method: 'POST' }).catch(() => {});
            sessionStorage.setItem(trackKey, 'true');
        }
    }
})();
