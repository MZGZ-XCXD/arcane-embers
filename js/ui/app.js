/* 界面装配：标签页调度、事件委托、渲染循环 */
(function () {
    const U = window.Utils;
    const G = window.UI;

    const TABS = [
        { id: 'buildings', name: '建筑', icon: '🏠', render: () => TabBuildings.render() },
        { id: 'techs', name: '科技', icon: '📖', render: () => TabResearch.renderTechs() },
        { id: 'upgrades', name: '升级', icon: '⚗️', render: () => TabResearch.renderUpgrades() },
        { id: 'policies', name: '国策', icon: '⚖️', render: () => TabAscend.renderPolicies() },
        { id: 'expedition', name: '远征', icon: '⚔️', render: () => TabWorld.renderExpedition() },
        { id: 'summon', name: '召唤', icon: '🔮', gate: s => s.techs['召唤法阵'] && s.techs['召唤法阵'].researched, render: () => TabSummon.renderSummon() },
        { id: 'market', name: '贸易', icon: '🪙', render: () => TabWorld.renderMarket() },
        { id: 'ascend', name: '传承', icon: '✦', render: () => TabAscend.renderAscend() },
        { id: 'achievements', name: '成就', icon: '🏆', render: () => TabWorld.renderAchievements() },
        { id: 'settings', name: '设置', icon: '⚙', render: () => TabSettings.render() },
    ];

    let activeTab = 'buildings';
    let tabBody = null;
    let pointerDown = false;        // 鼠标按下（点击 / 拖动滑杆）期间冻结重绘
    let renderQueued = false;

    /* 有解锁条件的标签页（例如「召唤」需要研究召唤法阵） */
    function visibleTabs() {
        return TABS.filter(t => !t.gate || t.gate(GameState));
    }

    /* ---------------- 标签徽标 ---------------- */
    function badges() {
        const s = GameState;
        const out = {};
        let techReady = 0;
        for (const n of TECHS_ORDER) {
            if (!s.techs[n].visible || s.techs[n].researched) continue;
            if (ProductionEngine.techAvailable(s, n) && ResourcesManager.canAfford(TECHS_CONFIG[n].cost)) techReady++;
        }
        out.techs = techReady;
        let upReady = 0;
        for (const n of UPGRADES_ORDER) {
            if (!s.upgrades[n].visible) continue;
            if (ResourcesManager.canAfford(ProductionEngine.upgradePrice(s, n))) upReady++;
        }
        out.upgrades = upReady;
        const avail = Actions.resetAvailability(s);
        out.ascend = (avail.relic ? 1 : 0) + (avail.star ? 1 : 0) + (avail.core ? 1 : 0);
        if (s.pendingEvent) out.expedition = 0;
        let regions = 0;
        for (const r of EXPEDITIONS_CONFIG) if (ExpeditionEngine.canStart(s, r).ok) regions++;
        out.expedition = regions;
        if (s.techs['召唤法阵'] && s.techs['召唤法阵'].researched && s.heroes) {
            const p = s.heroes.pity;
            const ready = (p.A >= GACHA_CONFIG.pity.A || p.S >= GACHA_CONFIG.pity.S || p.SS >= GACHA_CONFIG.pity.SS);
            out.summon = ready ? 1 : 0;
        }
        return out;
    }

    function renderTabs() {
        const b = badges();
        let html = '';
        for (const t of visibleTabs()) {
            const n = b[t.id] || 0;
            html += '<div class="tab' + (activeTab === t.id ? ' active' : '') + '" data-act="tab|' + t.id + '">' +
                '<span>' + t.icon + '</span><span>' + t.name + '</span>' +
                (n ? '<span class="badge' + (t.id === 'ascend' ? ' gold' : '') + '">' + n + '</span>' : '') + '</div>';
        }
        G.setHTML(document.getElementById('tabs'), html);
    }

    /* ---------------- 渲染 ---------------- */
    function render(force) {
        const s = GameState;
        /* 按住鼠标时不重建 DOM：否则节点会在 mousedown 与 mouseup 之间被替换，
           导致点击丢失、hover 状态被清空（按钮闪烁） */
        if (pointerDown && !force) { renderQueued = true; return; }
        renderQueued = false;

        Panels.renderHeader();
        Panels.renderPopulation();
        Panels.renderResources();
        Panels.renderEvent();
        Panels.renderExpeditionPanel();
        Panels.renderQueue();
        Panels.renderLog();
        Panels.renderStats();
        renderTabs();

        const content = document.getElementById('tab-content');
        if (!tabBody || !content.contains(tabBody)) {
            content.innerHTML = '<div id="tab-body"></div>';
            tabBody = document.getElementById('tab-body');
        }
        const tabs = visibleTabs();
        const tab = tabs.find(t => t.id === activeTab) || tabs[0];
        if (tab.id !== activeTab) activeTab = tab.id;      // 当前标签被隐藏时自动切回第一个
        G.setHTML(tabBody, tab.render());
    }

    window.UI.render = render;

    /* ---------------- 复制到剪贴板 ---------------- */
    function copyText(text, okMsg) {
        const ok = () => G.toast(okMsg, 'gold');
        const fallback = () => {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.top = '-1000px';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                ok();
            } catch (e) {
                G.toast('复制失败，请手动记下：' + text, 'bad');
            }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(ok, fallback);
        } else {
            fallback();
        }
    }

    /* ---------------- 指针状态 ---------------- */
    function beginPointer() { pointerDown = true; }
    function endPointer() {
        if (!pointerDown) return;
        pointerDown = false;
        if (renderQueued) render(true);   // 松开后补一次刷新
    }
    document.addEventListener('pointerdown', e => { if (e.button === 0 || e.pointerType !== 'mouse') beginPointer(); }, true);
    window.addEventListener('pointerup', endPointer, true);
    window.addEventListener('pointercancel', endPointer, true);
    window.addEventListener('blur', endPointer);
    document.addEventListener('mouseleave', endPointer);

    /* ---------------- 提示内容分发 ---------------- */
    G.setTipProvider(key => Panels.tipHtml(key));
    G.bindTips(document.body);

    /* ---------------- 行为处理 ---------------- */
    function handleAct(act, arg1, arg2, ev, node) {
        const s = GameState;
        const res = { ok: true };
        switch (act) {
            case 'tab':
                activeTab = arg1;
                render();
                break;
            case 'filter':
                if (arg1 === '!locked') TabBuildings.filters.hideLocked = !TabBuildings.filters.hideLocked;
                else TabBuildings.filters.type = arg1;
                render();
                break;
            case 'buy':
                res.ok = false;
                res.msg = (Actions.buyBuilding(s, arg1, arg2 === 'max' ? 'max' : Number(arg2)).msg || '');
                break;
            case 'toggle':
                Actions.setBuildingActive(s, arg1, 'toggle');
                break;
            case 'mode':
                Actions.setBuildingMode(s, arg1, Number(arg2));
                break;
            case 'research':
                res.ok = false;
                res.msg = (Actions.research(s, arg1).msg || '');
                break;
            case 'upgrade':
                res.ok = false;
                res.msg = (Actions.buyUpgrade(s, arg1).msg || '');
                break;
            case 'policy': {
                const r = Actions.setPolicy(s, arg1, Number(arg2));
                if (!r.ok && r.msg) G.toast(r.msg, 'bad');
                break;
            }
            case 'market':
                TradeEngine.setMode(s, arg1, arg2);
                render();
                break;
            case 'trade': {
                const r = TradeEngine.tradeOnce(s, arg1, arg2);
                G.toast(r.msg, r.ok ? '' : 'bad');
                break;
            }
            case 'exp': {
                const r = Actions.startExpedition(s, arg1);
                G.toast(r.msg, r.ok ? 'gold' : 'bad');
                break;
            }
            case 'summon': {
                const r = Heroes.summon(s, Number(arg1) || 1);
                if (!r.ok) { G.toast(r.msg, 'bad'); break; }
                const heroes = r.results.filter(x => x.type === 'hero');
                const names = heroes.map(x => x.rarity + '·' + x.hero.name);
                G.toast('🔮 召唤 ×' + r.results.length + (names.length
                    ? '：' + names.slice(0, 4).join('、') + (names.length > 4 ? ' 等' : '')
                    : '（没有英雄回应）'), r.best === 'EX' ? 'gold' : '');
                break;
            }
            case 'queuecancel': {
                const r = QueueEngine.cancel(s, arg1);
                G.toast(r.msg || '', r.ok ? '' : 'bad');
                break;
            }
            case 'equip': {
                const r = Artifacts.equip(s, arg1);
                computeRefresh();
                G.toast(r.msg || '', r.ok ? '' : 'bad');
                break;
            }
            case 'unequip': {
                const r = Artifacts.unequip(s, Number(arg1));
                computeRefresh();
                if (r.msg) G.toast(r.msg, r.ok ? '' : 'bad');
                break;
            }
            case 'discard':
                Artifacts.discard(s, arg1);
                computeRefresh();
                G.toast('已丢弃秘宝。');
                break;
            case 'prestige':
                prestigeConfirm(arg1);
                break;
            case 'perm': {
                const r = Actions.buyPermanent(s, arg1);
                G.toast(r.msg || '', r.ok ? 'gold' : 'bad');
                break;
            }
            case 'permtree':
                TabAscend.permTree.current = arg1;
                render();
                break;
            case 'foldEra':
                TabResearch.toggleEra(arg1);
                render(true);
                break;
            case 'foldDone':
                TabResearch.toggleDone(arg1);
                render(true);
                break;
            case 'expandTech':
                TabResearch.toggleTechDetail(arg1);
                render(true);
                break;
            case 'challenge': {
                const r = Actions.toggleChallenge(s, arg1);
                G.toast(r.msg, 'gold');
                break;
            }
            case 'eventchoice': {
                const choice = EventEngine.resolve(s, Number(arg1));
                if (choice && choice.ok === false) G.toast(choice.msg, 'bad');
                else if (choice && choice.text) G.toast('你选择了：' + choice.text);
                break;
            }
            case 'save':
                G.toast(SaveEngine.save(s) ? '已保存。' : '保存失败（浏览器限制了本地存储）。', 'gold');
                break;
            case 'pause':
                s.paused = !s.paused;
                G.closeModal();
                break;
            case 'theme':
                s.settings.theme = s.settings.theme === 'dark' ? 'light' : 'dark';
                applyTheme();
                G.closeModal();
                break;
            case 'modal':
                if (arg1 === 'export') Panels.exportModal();
                else if (arg1 === 'import') Panels.importModal();
                else if (arg1 === 'hardreset') {
                    G.confirmBox('清除存档', '这会彻底删除本地存档与全部传承进度，无法恢复。确定吗？', () => SaveEngine.hardReset(), '清除存档');
                }
                break;
            case 'doimport': {
                const ta = document.querySelector('#modal-root textarea');
                const r = SaveEngine.importSave(s, ta ? ta.value : '');
                G.toast(r.msg, r.ok ? 'gold' : 'bad');
                if (r.ok) { applyTheme(); G.closeModal(); }
                break;
            }
            case 'copyGroup':
                copyText('1126911018', '已复制 QQ 群号：1126911018');
                break;
            case 'closemodal':
                G.closeModal();
                break;
            case 'toggleAutosave':
                s.settings.autosave = !s.settings.autosave;
                break;
            case 'toggleAutoBuild':
                s.settings.autoBuild = !s.settings.autoBuild;
                break;
            case 'toggleAutoExp':
                s.settings.autoExpedition = !s.settings.autoExpedition;
                break;
            default:
                break;
        }
        if (res.msg) G.toast(res.msg, res.ok ? '' : 'bad');
        /* 除「切换标签 / 筛选 / 切换传承页」外，操作后立即重算并重绘，保证点击即时反馈 */
        if (act !== 'tab' && act !== 'filter' && act !== 'permtree' && act !== 'closemodal' &&
            act !== 'foldEra' && act !== 'foldDone' && act !== 'expandTech') computeRefresh();
    }

    function computeRefresh() {
        ProductionEngine.updatePrices(GameState);
        ProductionEngine.computeProductionAndCaps(GameState);
        render(true);
    }

    function prestigeConfirm(key) {
        const s = GameState;
        const info = {
            relic: ['时空回响', '把这条时间线折叠起来重新展开。'],
            star: ['星辰升华', '将整座城市升华为星光，得到更深一层的传承资源。'],
            core: ['原初归寂', '让世界回到被书写之前的空白。'],
        }[key];
        const gain = {
            relic: () => U.fmtInt(Actions.relicGain(s)) + ' 奥术遗物',
            star: () => U.fmtInt(Actions.relicGain(s) * 2) + ' 奥术遗物、' + U.fmtInt(Actions.starGain(s)) + ' 星辉',
            core: () => U.fmtInt(Actions.relicGain(s) * 5) + ' 奥术遗物、' + U.fmtInt(Actions.starGain(s) * 1.5) + ' 星辉、' + U.fmtInt(Actions.coreGain(s)) + ' 原初之核',
        }[key];
        const text = '<b>' + info[0] + '</b><br>' + info[1] +
            '<br><br>将获得：<b>' + gain() + '</b>' +
            '<br><br>会清空：资源、建筑、科技、升级、政策、人口。' +
            '<br>会保留：传承资源与强化、成就、试炼进度、统计数据' +
            (EffectsManager.hasSpecial(s, 'keepArtifacts') ? '、全部秘宝' : '（秘宝会在重置时失去，需要传承「记忆水晶」才能保留）') + '。';
        G.confirmBox(info[0], text, () => {
            const r = Actions.prestige(s, key);
            G.toast(r.msg, r.ok ? 'gold' : 'bad');
            activeTab = 'buildings';
            computeRefresh();
        }, '确认执行');
    }

    /* ---------------- 事件委托 ---------------- */
    document.addEventListener('click', e => {
        const node = e.target.closest ? e.target.closest('[data-act]') : null;
        if (!node) return;
        const act = node.getAttribute('data-act');
        if (!act) return;
        if (node.tagName === 'INPUT' && node.type === 'checkbox') return;   // 交给 change
        const parts = act.split('|');
        e.preventDefault();
        handleAct(parts[0], parts[1], parts[2], e, node);
    });

    document.addEventListener('change', e => {
        const node = e.target;
        if (!node.getAttribute) return;
        const act = node.getAttribute('data-act');
        if (act && node.type === 'checkbox') {
            handleAct(act, null, null, e, node);
            return;
        }
        if (node.hasAttribute && node.hasAttribute('data-policy')) {
            const name = node.getAttribute('data-policy');
            Actions.setPolicy(GameState, name, Number(node.value));
            computeRefresh();
            return;
        }
        if (node.hasAttribute && node.hasAttribute('data-marketlvl')) {
            TradeEngine.setLevel(GameState, node.getAttribute('data-marketlvl'), Number(node.value));
            computeRefresh();
        }
    });

    document.addEventListener('input', e => {
        const node = e.target;
        if (!node.hasAttribute || !node.hasAttribute('data-policy')) return;
        const label = document.getElementById('policy-val-' + node.getAttribute('data-policy'));
        if (label) label.textContent = node.value + (POLICIES_CONFIG[node.getAttribute('data-policy')].unit || '');
    });

    /* ---------------- 主题 ---------------- */
    function applyTheme() {
        document.body.className = GameState.settings.theme === 'dark' ? 'dark-theme' : 'light-theme';
    }

    /* ---------------- 快捷键 ---------------- */
    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        const tabs = visibleTabs();
        /* 数字键 1-9 对应前九个标签；第 10 个（设置）用 0 */
        const idx = e.key === '0' ? 10 : Number(e.key);
        if (idx >= 1 && idx <= tabs.length && (e.key === '0' || idx <= 9)) {
            activeTab = tabs[idx - 1].id;
            render();
        }
        if (e.key === ' ') {
            GameState.paused = !GameState.paused;
            e.preventDefault();
        }
        if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
            SaveEngine.save(GameState);
            G.toast('已保存。');
            e.preventDefault();
        }
    });

    /* ---------------- 欢迎 / 引导 ---------------- */
    function welcomeModal() {
        const html = '<h2>秘法余烬</h2>' +
            '<p>大崩坏那天，浮空城从天上落了下来，魔网断裂成无数碎片。你是最后一位仍然记得咒式的学徒，' +
            '面前只有一座倒塌的法师塔和一片灰烬。</p>' +
            '<h3>第一件事</h3><ul>' +
            '<li>你已经带着一点废墟里捡来的木材与石料。先在「科技」里研究 <b>拾荒</b>、<b>搭建帐篷</b>、<b>伐木技术</b>、<b>采石技术</b>。</li>' +
            '<li>然后在「建筑」里建造：<b>帐篷</b>提供人口，<b>拾荒棚 / 伐木场 / 采石场</b>提供原料。</li>' +
            '<li>人口是所有建筑的燃料，仓库决定你能囤多少——上限不够时就没法研究更贵的科技。</li>' +
            '<li>攒够 200 点「魔法知识上限」后，就可以在「传承」里执行第一次 <b>时空回响</b>，用奥术遗物买永久强化。</li>' +
            '</ul>' +
            '<p class="hint">提示：数字键 1-9 与 0 切换标签页，空格暂停，进度会自动保存在浏览器里；存档与更新日志在「设置」页。</p>' +
            '<div class="modal-actions left"><label class="hint" style="cursor:pointer">' +
            '<input type="checkbox" id="welcome-skip"> 以后不再显示</label></div>' +
            '<div class="modal-actions"><button class="btn primary" data-act="closemodal">开始重建</button></div>';
        const wrap = G.openModal(html);
        wrap.querySelector('button').addEventListener('click', () => {
            if (wrap.querySelector('#welcome-skip').checked) {
                GameState.settings.hideWelcome = true;
                SaveEngine.save(GameState);
            }
        });
    }

    window.App = { render, applyTheme, welcomeModal, TABS, get activeTab() { return activeTab; }, set activeTab(v) { activeTab = v; } };
})();
