/* 界面基础工具：DOM 构造、提示气泡、弹窗、浮层提示、事件委托 */
(function () {
    const U = window.Utils;

    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

    function h(html) {
        const t = document.createElement('template');
        t.innerHTML = html.trim();
        return t.content.firstElementChild;
    }

    function esc(s) {
        return String(s === undefined || s === null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function num(n, digits) { return U.fmtNum(n, digits); }
    function rate(n) { return U.fmtRate(n); }
    function rateClass(n) { return n > 1e-9 ? 'pos' : (n < -1e-9 ? 'neg' : 'neu'); }

    /* ---------------- 提示气泡 ---------------- */
    const tipEl = document.getElementById('tooltip');
    let tipProvider = null;

    function setTipProvider(fn) { tipProvider = fn; }

    function showTip(html, x, y) {
        if (tipEl.__html !== html) {         // 内容未变则只移动位置，避免提示气泡闪动
            tipEl.__html = html;
            tipEl.innerHTML = html;
        }
        tipEl.classList.add('show');
        /* 手机浏览器里 100vh 是「地址栏收起时」的高度，比此刻实际能看见的区域高，
           所以先按实际可见高度给浮窗封顶——否则浮窗本身就可能比屏幕还高，
           再怎么挪位置都会有一截露在外面。 */
        const vv = window.visualViewport;
        const vw = Math.round(Math.min(window.innerWidth, vv && vv.width ? vv.width : Infinity));
        const vh = Math.round(Math.min(window.innerHeight, vv && vv.height ? vv.height : Infinity));
        const pad = 8;
        if (vh > 0) tipEl.style.maxHeight = Math.max(140, vh - pad * 2) + 'px';
        const rect = tipEl.getBoundingClientRect();
        let left = x + 16;
        let top = y + 16;
        if (left + rect.width > vw - pad) left = x - rect.width - 12;
        if (top + rect.height > vh - pad) top = y - rect.height - 12;
        /* 兜底夹紧：手指点在哪里都要保证浮窗完整留在屏幕内
           （手机上往左翻时 left 可能算成负数，浮窗就整个看不见了） */
        left = Math.min(Math.max(pad, left), Math.max(pad, vw - rect.width - pad));
        top = Math.min(Math.max(pad, top), Math.max(pad, vh - rect.height - pad));
        tipEl.style.left = left + 'px';
        tipEl.style.top = top + 'px';
    }

    function hideTip() { tipEl.classList.remove('show'); }

    function bindTips(root) {
        /* 触屏设备没有 hover：手指点一下就把浮窗带出来，几秒后自动收起
           （滚动不算点击，所以要用按下与抬起的位移判断） */
        let touchStart = null;
        let touchTip = false;

        root.addEventListener('pointerdown', e => {
            if (e.pointerType === 'touch') touchStart = { x: e.clientX, y: e.clientY };
        }, true);

        root.addEventListener('pointerup', e => {
            if (e.pointerType !== 'touch') return;
            const moved = touchStart && (Math.abs(e.clientX - touchStart.x) + Math.abs(e.clientY - touchStart.y) > 12);
            touchStart = null;
            if (moved) return;                                   // 这是滚动，不是点击
            const target = e.target.closest ? e.target.closest('[data-tip]') : null;
            if (!target || !tipProvider) { hideTip(); tipEl._target = null; touchTip = false; return; }
            const html = tipProvider(target.getAttribute('data-tip'));
            if (!html) return;
            tipEl._target = target;
            touchTip = true;
            showTip(html, e.clientX, e.clientY);
            clearTimeout(tipEl._touchTimer);
            tipEl._touchTimer = setTimeout(() => { hideTip(); tipEl._target = null; touchTip = false; }, 5000);
        }, true);

        root.addEventListener('mouseover', e => {
            if (touchTip) return;                                 // 别让触屏合成的 mouse 事件顶掉浮窗
            const target = e.target.closest ? e.target.closest('[data-tip]') : null;
            if (!target || !tipProvider) return;
            const html = tipProvider(target.getAttribute('data-tip'));
            if (!html) return;
            tipEl._target = target;
            showTip(html, e.clientX, e.clientY);
        });
        root.addEventListener('mousemove', e => {
            if (touchTip) return;
            if (!tipEl.classList.contains('show') || !tipEl._target) return;
            const target = e.target.closest ? e.target.closest('[data-tip]') : null;
            if (target !== tipEl._target) { hideTip(); tipEl._target = null; return; }
            showTip(tipEl.innerHTML, e.clientX, e.clientY);
        });
        root.addEventListener('mouseout', e => {
            if (touchTip) return;
            const target = e.target.closest ? e.target.closest('[data-tip]') : null;
            if (target && target === tipEl._target) { hideTip(); tipEl._target = null; }
        });
    }

    /* ---------------- 浮层提示 ---------------- */
    const toastRoot = document.getElementById('toast-root');
    function toast(msg, type) {
        const node = h('<div class="toast ' + (type || '') + '">' + esc(msg) + '</div>');
        toastRoot.appendChild(node);
        setTimeout(() => { node.style.transition = 'opacity .4s'; node.style.opacity = '0'; }, 2600);
        setTimeout(() => node.remove(), 3100);
        while (toastRoot.children.length > 4) toastRoot.firstElementChild.remove();
    }

    /* ---------------- 弹窗 ---------------- */
    const modalRoot = document.getElementById('modal-root');

    function openModal(html, opts) {
        opts = opts || {};
        const wrap = h('<div class="modal">' + html + '</div>');
        modalRoot.innerHTML = '';
        modalRoot.appendChild(wrap);
        modalRoot.classList.add('open');
        modalRoot._closable = opts.closable !== false;
        return wrap;
    }

    function closeModal() {
        modalRoot.classList.remove('open');
        modalRoot.innerHTML = '';
    }

    function confirmBox(title, text, onOk, okLabel) {
        const wrap = openModal(
            '<h2>' + esc(title) + '</h2><p>' + text + '</p>' +
            '<div class="modal-actions"><button class="btn" data-modal-act="cancel">取消</button>' +
            '<button class="btn danger" data-modal-act="ok">' + esc(okLabel || '确定') + '</button></div>'
        );
        wrap.addEventListener('click', e => {
            const act = e.target.getAttribute && e.target.getAttribute('data-modal-act');
            if (act === 'cancel') closeModal();
            if (act === 'ok') { closeModal(); onOk(); }
        });
    }

    modalRoot.addEventListener('click', e => {
        if (e.target === modalRoot && modalRoot._closable !== false) closeModal();
    });

    /* ---------------- 进度条 ---------------- */
    function bar(pct, cls) {
        return '<div class="bar ' + (cls || '') + '"><i style="width:' + U.clamp(pct * 100, 0, 100).toFixed(1) + '%"></i></div>';
    }

    /* ---------------------------------------------------------
       轻量 DOM 补丁：把新 HTML 与现有 DOM 逐层比对，只改动变化的
       文本 / 属性，尽量复用已有节点。
       这样按钮节点在重绘之间保持同一身份 —— 不会出现
       「hover 被清空导致闪烁」「mousedown 与 mouseup 之间节点被换掉导致点击丢失」。
       --------------------------------------------------------- */
    function syncAttrs(oldEl, newEl) {
        const oa = oldEl.attributes;
        for (let i = oa.length - 1; i >= 0; i--) {
            const name = oa[i].name;
            if (!newEl.hasAttribute(name)) oldEl.removeAttribute(name);
        }
        const na = newEl.attributes;
        for (let i = 0; i < na.length; i++) {
            const a = na[i];
            if (oldEl.getAttribute(a.name) !== a.value) oldEl.setAttribute(a.name, a.value);
        }
    }

    function syncChildren(oldParent, newParent) {
        const olds = Array.prototype.slice.call(oldParent.childNodes);
        const news = Array.prototype.slice.call(newParent.childNodes);
        for (let i = 0; i < news.length; i++) {
            const n = news[i];
            const o = olds[i];
            if (!o) { oldParent.appendChild(n.cloneNode(true)); continue; }
            if (o.nodeType !== n.nodeType) { oldParent.replaceChild(n.cloneNode(true), o); continue; }
            if (n.nodeType === 3) {                       // 文本节点
                if (o.data !== n.data) o.data = n.data;
                continue;
            }
            if (n.nodeType === 8) continue;               // 注释
            if (o.tagName !== n.tagName) { oldParent.replaceChild(n.cloneNode(true), o); continue; }
            /* 这个节点被复用了：补丁可能已经把它里面的文字节点删掉，
               而 setText / innerHTML 的「内容没变就不重写」缓存还留着旧值，
               于是数字会凭空消失（例如解锁新资源后，已有资源行的存量整列空掉）。
               清掉复用节点的文本缓存，下一轮更新就会老老实实重写。 */
            o.__lastText = undefined;
            syncAttrs(o, n);
            syncChildren(o, n);
        }
        /* 多余节点移除（从后往前） */
        for (let i = news.length; i < olds.length; i++) {
            if (olds[i].parentNode === oldParent) oldParent.removeChild(olds[i]);
        }
    }

    function patchDOM(node, html) {
        const tpl = document.createElement('template');
        tpl.innerHTML = html;
        syncChildren(node, tpl.content);
    }

    /* 只在内容变化时更新；更新采用补丁方式，保留节点身份 */
    function setHTML(node, html) {
        if (!node) return false;
        if (node.__lastHTML === html) return false;
        const first = !node.__lastHTML;
        node.__lastHTML = html;
        if (first && !node.firstChild) node.innerHTML = html;
        else patchDOM(node, html);
        return true;
    }

    /* 原地更新文本（节点身份保持不变，因此不影响 hover / focus） */
    function setText(node, text) {
        if (!node) return false;
        if (node.__lastText === text) return false;
        node.__lastText = text;
        node.textContent = text;
        return true;
    }

    /* ---------------- 资源价格 / 消耗文本 ---------------- */
    function priceHtml(price) {
        const parts = [];
        for (const k in price) {
            const have = ResourcesManager.amount(k);
            const lack = have + 1e-6 < price[k];
            parts.push('<span class="' + (lack ? 'lack' : '') + '">' + esc(k) + ' ' + num(price[k]) + '</span>');
        }
        /* 用空格分隔：多个资源挤在一起会看不清（flex 容器里的空白节点不会被渲染，所以不会重复留白） */
        return parts.join(' ') || '<span>免费</span>';
    }

    function costHtml(cost) {
        const parts = [];
        for (const k in cost) {
            const have = ResourcesManager.amount(k);
            const lack = have + 1e-6 < cost[k];
            const cap = ResourcesManager.get(k).cap;
            const capIssue = !RESOURCES_CONFIG[k].prestige && cost[k] > cap;
            parts.push('<span class="' + (lack ? 'lack' : '') + '" data-tip="res|' + esc(k) + '">' + esc(k) + ' ' + num(cost[k]) +
                (capIssue ? ' ⚠' : '') + '</span>');
        }
        return parts.join(' ') || '<span>免费</span>';
    }

    /* ---------------- 效果文本 ---------------- */
    function effectLines(eff) {
        const out = [];
        for (const key in eff) {
            const v = eff[key];
            if (BUILDINGS_CONFIG[key] && typeof v === 'object') {
                const bits = [];
                if (typeof v.prod === 'number') bits.push('产出 ' + U.fmtPct(v.prod, 1));
                if (typeof v.cons === 'number') bits.push('消耗 ' + U.fmtPct(v.cons, 1));
                if (typeof v.cap === 'number') bits.push('上限 ' + U.fmtPct(v.cap, 1));
                out.push(key + '：' + bits.join('，'));
            } else if (key === 'resourceProd') {
                for (const r in v) out.push(r + ' 产出 ' + U.fmtPct(v[r], 1));
            } else if (key === 'globalProd') out.push('所有建筑产出 ' + U.fmtPct(v, 1));
            else if (key === 'globalCost') out.push('成本增长率 ' + U.fmtPct(v, 1));
            else if (key === 'happiness') out.push('民望 ' + (v >= 0 ? '+' : '') + U.fmtNum(v, 0));
            else if (key === 'knowledgeProd') out.push('魔法知识产出 ' + U.fmtPct(v, 1));
            else if (key === 'capAll') out.push('所有存量上限 ' + U.fmtPct(v, 1));
            else if (key === 'populationCap') out.push('人口上限 ' + U.fmtPct(v, 1));
            else if (key === 'relicGain') out.push('重置遗物收益 ' + U.fmtPct(v, 1));
            else if (key === 'resetGain') out.push('重置收益 ' + U.fmtPct(v, 1));
            else if (key === 'expeditionPower') out.push('远征军力 ' + U.fmtPct(v, 1));
            else if (key === 'expeditionReward') out.push('远征收益 ' + U.fmtPct(v, 1));
            else if (key === 'artifactQuality') out.push('秘宝品质 ' + U.fmtPct(v, 1));
            else if (key === 'speed') out.push('世界流速 ' + U.fmtPct(v, 1));
            else if (key === 'marketVolume') out.push('贸易规模 ' + U.fmtPct(v, 1));
            else if (key === 'startResources') out.push('重置后获得启动物资');
            else if (key === 'capPerRelic') out.push('每枚遗物提供 ' + U.fmtPct(v, 2) + ' 存量上限');
            else if (key === 'knowledgeCapPerRelic') out.push('遗物提升魔法知识上限');
            else if (key === 'offlineHours') out.push('离线结算时长 +' + v + ' 小时');
            else if (key === 'artifactSlots') out.push('秘宝装备槽 +' + v);
            else if (key === 'powerMult') out.push('军力 ' + U.fmtPct(v, 1));
            else if (key === 'queueSlots') out.push('建造队列 +' + v + ' 槽位');
            else if (key === 'queueDiscount') out.push('队列订单材料 ' + U.fmtPct(-v, 1));
            else if (key === 'luck') out.push('召唤运气 +' + v.toFixed(2));
            else if (key === 'summonDiscount') out.push('召唤消耗 ' + U.fmtPct(-v, 1));
            else if (key === 'heroPower') out.push('英雄效果 ' + U.fmtPct(v, 1));
            else if (key === 'special') {
                const names = {
                    autoBuild: '解锁自动建造', autoExpedition: '解锁自动远征',
                    keepArtifacts: '重置保留秘宝', perfectEfficiency: '人口永远充足',
                    autoTech: '重置后自动完成第一时代科技',
                    offlinePerfect: '离线收益 100% 效率',
                    knowledgeCapMult: '魔法知识上限倍增',
                };
                out.push(names[v] || v);
            } else out.push(key + ' ' + v);
        }
        return out;
    }

    window.UI = window.UI || {};
    Object.assign(window.UI, {
        $, $$, h, esc, num, rate, rateClass, bar, setHTML, setText, priceHtml, costHtml, effectLines,
        setTipProvider, bindTips, showTip, hideTip, toast,
        openModal, closeModal, confirmBox,
    });
})();
