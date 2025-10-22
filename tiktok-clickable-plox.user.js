// ==UserScript==
// @name         TikTok Clickable Plox
// @namespace    tiktok-clickable-plox
// @description  Hace clicables con rueda del raton videos relacionados (miniatura y título) en TikTok Desktop y añade toggle para abrir en nueva pestaña al darles click normal.
// @version      0.0.1
// @author       Alplox
// @match        https://www.tiktok.com/*
// @icon         https://raw.githubusercontent.com/Alplox/StartpagePlox/refs/heads/main/assets/favicon/favicon.ico
// @grant        GM_addStyle
// @run-at       document-end
// @license      MIT
// @homepageURL  https://github.com/Alplox/TikTok-Clickable-Plox
// @supportURL   https://github.com/Alplox/TikTok-Clickable-Plox/issues
// @downloadURL  https://raw.githubusercontent.com/Alplox/TikTok-Clickable-Plox/refs/heads/main/tiktok-clickable-plox.user.js
// @updateURL    https://raw.githubusercontent.com/Alplox/TikTok-Clickable-Plox/refs/heads/main/tiktok-clickable-plox.meta.js
// ==/UserScript==

(function () {
    'use strict';

    const STATE_KEY = 'tiktok_open_related_new_tab_v1';
    let openRelatedInNewTab = (localStorage.getItem(STATE_KEY) === '1');

    const css = `
    .css-ntn9r7-5e6d46e3--LinkNonClickable,
    .css-1rjlivr-LinkNonClickable,
    [class*="LinkNonClickable"],
    a[role="link"] { pointer-events: auto !important; cursor: pointer !important; }
    [data-e2e="user-post-item"], [data-e2e="video-item"], [data-e2e="video-card"],
    a[href*="/video/"], a[href*="/@"] { user-select: text !important; }
    .tiktok-overlay, .overlay, [data-e2e="video-overlay"] { pointer-events: none !important; }

    #tiktok-open-related-toggle { position: fixed; right:14px; bottom:14px; z-index:2147483647;
      background: rgba(0,0,0,0.75); color:#fff; padding:8px 10px; border-radius:8px;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial; font-size:13px; cursor:pointer;
      box-shadow: 0 6px 18px rgba(0,0,0,0.35); user-select:none; }
    #tiktok-open-related-toggle[data-enabled="1"]{ background:#0284c7; }
    #tiktok-open-related-toggle small{ display:block; opacity:0.9; font-size:11px; }
  `;
    if (typeof GM_addStyle === 'function') GM_addStyle(css); else { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }

    const cardSelector = '.css-1m3qc9x-5e6d46e3--DivItemContainer, .css-1ba5yhh-5e6d46e3--DivCoverContainer, [data-e2e="video-item"], [data-e2e="user-post-item"], article';

    function abs(href) {
        if (!href) return null;
        href = href.trim();
        if (href.startsWith('//')) href = location.protocol + href;
        if (href.startsWith('/')) href = location.origin + href;
        if (!/^https?:\/\//i.test(href)) href = 'https://' + href;
        try { return new URL(href).href; } catch (e) { return href; }
    }

    function getHrefFromCard(card) {
        if (!card) return null;

        const preferred = card.querySelector('a.css-ntn9r7-5e6d46e3--LinkNonClickable[href], a[class*="LinkNonClickable"][href], a[href*="/video/"], a[href*="/@"]');
        if (preferred && preferred.getAttribute('href')) return abs(preferred.getAttribute('href'));
        const a = card.querySelector('a[href]');
        if (a && a.getAttribute('href')) return abs(a.getAttribute('href'));
        const vid = card.querySelector('[data-video-id], [data-post-id], [data-id]');
        if (vid) {
            const id = vid.dataset.videoId || vid.dataset.postId || vid.dataset.id;
            if (id) {
                const userA = card.querySelector('a[href*="/@"]');
                if (userA) return abs(userA.getAttribute('href')).replace(/\/$/, '') + '/video/' + id;
                return 'https://www.tiktok.com/video/' + id;
            }
        }
        return null;
    }

    function attachHandlers(card) {
        if (!card || card.__tiktok_attached) return;
        card.__tiktok_attached = true;

        const url = getHrefFromCard(card);
        if (!url) return;

        card.style.cursor = 'pointer';

        const handlerCapture = function (e) {
            if (e.button !== 0) return;
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
            if (!openRelatedInNewTab) return;

            const path = e.composedPath ? e.composedPath() : (e.path || []);
            for (const el of path) {
                if (!el || el === card) continue;
                if (el instanceof HTMLElement) {
                    if (el.closest && el.closest('button, a, input, textarea, select, [role="button"], [role="link"]')) return;
                }
            }

            e.preventDefault();
            e.stopPropagation();
            try { window.open(url, '_blank', 'noopener,noreferrer'); }
            catch (err) {
                const t = document.createElement('a'); t.href = url; t.target = '_blank'; t.rel = 'noopener noreferrer'; document.body.appendChild(t); t.click(); t.remove();
            }
        };

        card.addEventListener('click', handlerCapture, true);
        card.addEventListener('pointerdown', handlerCapture, true);

        try {
            card.querySelectorAll('a[href]').forEach(a => {
                if (a.__tiktok_link_attached) return;
                a.__tiktok_link_attached = true;
                const raw = a.getAttribute('href');
                if (raw) a.href = abs(raw);
                a.addEventListener('click', (e) => {
                    if (openRelatedInNewTab && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                        e.preventDefault(); e.stopPropagation();
                        try { window.open(a.href, '_blank', 'noopener,noreferrer'); }
                        catch (err) { const t = document.createElement('a'); t.href = a.href; t.target = '_blank'; t.rel = 'noopener noreferrer'; document.body.appendChild(t); t.click(); t.remove(); }
                    }
                }, true);
                a.addEventListener('auxclick', (e) => { if (e.button === 1) { try { window.open(a.href, '_blank', 'noopener,noreferrer'); } catch { } } }, true);
            });
        } catch (e) { }
    }

    function scan(root = document) {
        try {
            (root.querySelectorAll ? root.querySelectorAll(cardSelector) : []).forEach(n => attachHandlers(n));
            (root.querySelectorAll ? root.querySelectorAll('a[class*="LinkNonClickable"]') : []).forEach(a => {
                const c = a.closest(cardSelector) || a.parentElement;
                if (c) attachHandlers(c);
            });
        } catch (e) { }
    }

    const mo = new MutationObserver(muts => {
        for (const m of muts) {
            if (m.addedNodes && m.addedNodes.length) m.addedNodes.forEach(n => { if (n.nodeType === 1) scan(n); });
            if (m.type === 'attributes' && m.target && m.target.matches && m.target.matches('a[href]')) {
                const p = m.target.closest(cardSelector) || document;
                scan(p);
            }
        }
    });

    function start() {
        scan(document);
        mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'class'] });
        setInterval(() => scan(document), 2000);
    }
    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', start); else start();

    function createToggle() {
        if (document.getElementById('tiktok-open-related-toggle')) return;
        const btn = document.createElement('div');
        btn.id = 'tiktok-open-related-toggle';
        btn.title = 'Abrir relacionados en nueva pestaña (click normal)';
        btn.tabIndex = 0; btn.setAttribute('role', 'button');
        updateBtn(btn);
        btn.addEventListener('click', () => {
            openRelatedInNewTab = !openRelatedInNewTab;
            localStorage.setItem(STATE_KEY, openRelatedInNewTab ? '1' : '0');
            updateBtn(btn);
        });
        btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); } });
        document.body.appendChild(btn);
    }
    function updateBtn(btn) {
        if (!btn) btn = document.getElementById('tiktok-open-related-toggle');
        if (!btn) return;
        btn.dataset.enabled = openRelatedInNewTab ? '1' : '0';
        btn.innerHTML = openRelatedInNewTab ? 'Abrir relacionados en nueva pestaña<br><small>✅ Activado</small>' : 'Abrir relacionados en nueva pestaña<br><small>❌Desactivado</small>';
    }

    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', createToggle); else createToggle();

})();