/* 科技标签页 + 升级标签页 */
(function () {
    const U = window.Utils;
    const G = window.UI;

    /* 科技页折叠状态：era[时代]=是否展开，done[时代]=「已完成」块是否展开，tech[科技]=是否展开完整卡片 */
    const fold = { era: {}, done: {}, tech: {} };

    /* ---------------- 科技 ---------------- */
    function techCard(name, opts) {
        opts = opts || {};
        const s = GameState;
        const cfg = TECHS_CONFIG[name];
        const t = s.techs[name];
        const available = ProductionEngine.techAvailable(s, name);
        const affordable = ResourcesManager.canAfford(cfg.cost);
        const capBlocked = Object.keys(cfg.cost).some(k => !RESOURCES_CONFIG[k].prestige && cfg.cost[k] > s.resources[k].cap);
        const queued = window.QueueEngine ? QueueEngine.queuedCount(s, 'tech', name) > 0 : false;
        const queueFull = window.QueueEngine ? QueueEngine.isFull(s) : false;

        let cls = 'card';
        if (t.researched) cls += ' researched';
        else if (!available) cls += ' locked';
        else if (affordable) cls += ' affordable';

        /* 整张科技卡就是「研究」按钮；在「已完成」块里展开时，整卡变成「收起」 */
        const clickable = opts.inDone ? true : (available && !t.researched && !queued);
        const act = opts.inDone ? ('expandTech|' + G.esc(name)) : (clickable ? ('research|' + G.esc(name)) : '');
        let html = '<div class="' + cls + (clickable ? ' clickable' : '') + '"' +
            (act ? ' data-act="' + act + '"' : '') + ' data-tip="tech|' + G.esc(name) + '">';
        html += '<div class="card-head"><div class="card-name">' + (t.researched ? '✅ ' : '') + G.esc(name) +
            '<span class="tag">第' + cfg.era + '时代</span>' +
            (queued ? '<span class="tag queue">研究中</span>' : '') + '</div>';
        if (!t.researched) html += '<div class="card-count" style="font-size:.8rem">' + (available ? (affordable ? '可研究' : '资源不足') : '前置未完成') + '</div>';
        html += '</div>';

        const unlocks = BUILDINGS_ORDER.filter(n => BUILDINGS_CONFIG[n].tech === name);
        if (unlocks.length) {
            html += '<div class="card-stats"><div class="row"><span class="k">解锁</span><span class="v">' +
                unlocks.map(G.esc).join('、') + '</span></div></div>';
        }
        const effs = G.effectLines(cfg.effect);
        if (effs.length) {
            html += '<div class="card-stats">' + effs.map(e => '<div class="row"><span class="k">效果</span><span class="v pos">' + G.esc(e) + '</span></div>').join('') + '</div>';
        }
        html += '<div class="card-desc">' + G.esc(cfg.desc) + '</div>';

        if (cfg.prereq.length) {
            html += '<div class="hint">前置：' + cfg.prereq.map(p =>
                '<span class="' + (s.techs[p].researched ? 'pos' : 'neg') + '">' + G.esc(p) + '</span>').join('、') + '</div>';
        }
        if (!t.researched) {
            html += '<div class="price">' + G.costHtml(cfg.cost) + '</div>';
            if (capBlocked) html += '<div class="hint neg">所需资源超过当前上限，需要建造仓库类建筑提升上限。</div>';
            html += '<div class="card-actions"><button class="btn primary wide-action" data-act="research|' + G.esc(name) + '"' +
                (available && !queued ? '' : ' disabled') + '>' + (queued ? '研究中…' : (queueFull ? '队列已满' : '研究')) + '</button></div>';
            html += '<div class="card-tip"><span>' + (queued ? '已在研究队列中，可在右侧队列面板取消'
                : (available ? '点击卡片任意处即可研究' : '前置科技尚未完成')) + '</span><span></span></div>';
        } else {
            html += '<div class="card-tip"><span>' + (opts.inDone ? '点击卡片任意处可收起详情' : '已完成研究') + '</span><span>✅</span></div>';
        }
        html += '</div>';
        return html;
    }

    function renderTechs() {
        const s = GameState;
        const visible = TECHS_ORDER.filter(n => s.techs[n].visible);
        const canNow = visible.filter(n => !s.techs[n].researched && ProductionEngine.techAvailable(s, n) && ResourcesManager.canAfford(TECHS_CONFIG[n].cost));
        const doneTotal = visible.filter(n => s.techs[n].researched).length;
        let html = '<div class="tab-intro">魔法知识（📖）是研究的主要消耗，它由藏书阁、咒法学院等建筑产出，' +
            '并由它们提供 <b>知识上限</b>。研究立刻完成，是解锁建筑与全局加成的唯一途径。<br>' +
            '<b>点击卡片任意处即可研究</b>；已完成的科技会收进「已完成」折叠块，' +
            '整个时代研究完后该时代会自动折叠——点标题即可随时展开查看。' +
            '<br>当前进度：已完成 <b>' + doneTotal + '</b> / ' + visible.length + ' 项（本时代清单）。</div>';
        if (canNow.length) html += '<div class="hint pos" style="margin-bottom:8px">当前可以研究：' + canNow.map(G.esc).join('、') + '</div>';

        const byEra = {};
        for (const n of visible) {
            const e = String(TECHS_CONFIG[n].era);
            (byEra[e] = byEra[e] || []).push(n);
        }
        for (const era of Object.keys(byEra).sort((a, b) => a - b)) {
            const names = byEra[era];
            const eraInfo = ERAS.find(x => x.id === Number(era)) || { name: '第' + era + '时代', motto: '' };
            const doneNames = names.filter(n => s.techs[n].researched);
            const todoNames = names.filter(n => !s.techs[n].researched);
            const allDone = doneNames.length === names.length;
            const expanded = fold.era[era] === undefined ? !allDone : fold.era[era];

            html += '<div class="era-head' + (allDone ? ' complete' : '') + '" data-act="foldEra|' + era + '">';
            html += '<span class="fold-arrow">' + (expanded ? '▾' : '▸') + '</span>';
            html += '<span class="era-name">' + G.esc(eraInfo.name) + '</span>';
            html += '<span class="era-progress">' + doneNames.length + ' / ' + names.length + ' 项已完成</span>';
            if (allDone) html += '<span class="tag">已全部完成</span>';
            else if (todoNames.length) html += '<span class="tag">待研究 ' + todoNames.length + '</span>';
            html += '<span class="era-motto">' + G.esc(eraInfo.motto) + '</span>';
            html += '</div>';

            if (!expanded) continue;

            if (todoNames.length) {
                html += '<div class="card-grid">' + todoNames.map(techCard).join('') + '</div>';
            }
            if (doneNames.length) {
                const doneOpen = !!fold.done[era];
                html += '<div class="done-block">';
                html += '<div class="done-head" data-act="foldDone|' + era + '">' +
                    '<span class="fold-arrow">' + (doneOpen ? '▾' : '▸') + '</span>' +
                    '<span>已完成 ' + doneNames.length + ' 项</span>' +
                    '<span class="right">' + (doneOpen ? '点击收起' : '点击展开查看详情') + '</span></div>';
                if (doneOpen) {
                    html += '<div class="done-list">' + doneNames.map(n => {
                        if (fold.tech[n]) return techCard(n, { inDone: true });
                        return doneRow(n);
                    }).join('') + '</div>';
                }
                html += '</div>';
            }
        }
        return html;
    }

    /* 已研究科技的紧凑一行（点击展开为完整卡片） */
    function doneRow(name) {
        const cfg = TECHS_CONFIG[name];
        const unlocks = BUILDINGS_ORDER.filter(n => BUILDINGS_CONFIG[n].tech === name);
        const effs = G.effectLines(cfg.effect);
        const meta = [];
        if (unlocks.length) meta.push('解锁 ' + unlocks.join('、'));
        if (effs.length) meta.push(effs.join('；'));
        return '<div class="tech-done-row" data-act="expandTech|' + G.esc(name) + '">' +
            '<span class="fold-arrow">▸</span>' +
            '<span class="nm">✅ ' + G.esc(name) + '</span>' +
            '<span class="meta">' + G.esc(meta.join(' · ')) + '</span></div>';
    }

    /* 折叠状态（仅界面记忆，不写入存档） */
    function toggleEra(era) {
        const names = TECHS_ORDER.filter(n => String(TECHS_CONFIG[n].era) === String(era) && GameState.techs[n].visible);
        const doneCount = names.filter(n => GameState.techs[n].researched).length;
        const allDone = names.length > 0 && doneCount === names.length;
        const expanded = fold.era[era] === undefined ? !allDone : fold.era[era];
        fold.era[era] = !expanded;
    }
    function toggleDone(era) { fold.done[era] = !fold.done[era]; }
    function toggleTechDetail(name) { fold.tech[name] = !fold.tech[name]; }

    /* ---------------- 升级 ---------------- */
    function upgradeCard(name) {
        const s = GameState;
        const cfg = UPGRADES_CONFIG[name];
        const u = s.upgrades[name];
        const price = ProductionEngine.upgradePrice(s, name);
        const affordable = ResourcesManager.canAfford(price);
        const maxed = u.level >= cfg.cap;
        const queued = window.QueueEngine ? QueueEngine.queuedCount(s, 'upgrade', name) > 0 : false;
        const queueFull = window.QueueEngine ? QueueEngine.isFull(s) : false;
        let cls = 'card' + (affordable && !maxed ? ' affordable' : '') + (u.level > 0 ? ' researched' : '');
        const clickable = !maxed && !queued;
        let html = '<div class="' + cls + (clickable ? ' clickable' : '') + '"' +
            (clickable ? ' data-act="upgrade|' + G.esc(name) + '"' : '') + ' data-tip="upgrade|' + G.esc(name) + '">';
        html += '<div class="card-head"><div class="card-name">' + G.esc(name) + '</div>' +
            '<div class="card-count">Lv.' + u.level + '<small> / ' + cfg.cap + '</small></div></div>';
        if (queued) html += '<div class="hint pos">已在升级队列中（可在右侧队列面板取消）。</div>';
        const effs = G.effectLines(cfg.effect);
        html += '<div class="card-stats">' + effs.map(e =>
            '<div class="row"><span class="k">每级</span><span class="v pos">' + G.esc(e) + '</span></div>' +
            (u.level ? '<div class="row"><span class="k">当前累计</span><span class="v">' + G.esc(e.replace(/([\d.]+)%/, (m, p) => (Number(p) * u.level).toFixed(1) + '%')) + '</span></div>' : '')
        ).join('') + '</div>';
        html += '<div class="card-desc">' + G.esc(cfg.desc) + '</div>';
        if (!maxed) {
            html += '<div class="price">' + G.priceHtml(price) + '</div>';
            html += '<div class="card-actions"><button class="btn primary wide-action" data-act="upgrade|' + G.esc(name) + '"' +
                (queued ? ' disabled' : '') + '>' + (queued ? '升级中…' : (queueFull ? '队列已满' : '升级')) + '</button></div>';
            html += '<div class="card-tip"><span>' + (queued ? '已在队列中' : '点击卡片任意处即可升级') + '</span><span></span></div>';
        } else {
            html += '<div class="hint pos">已达到等级上限。</div>';
        }
        html += '</div>';
        return html;
    }

    function renderUpgrades() {
        const s = GameState;
        const names = UPGRADES_ORDER.filter(n => s.upgrades[n].visible);
        let html = '<div class="tab-intro">升级可以无限重复购买（各有等级上限），价格随等级指数增长，' +
            '是后期放大产能的主要手段。研究对应科技后解锁。</div>';
        if (!names.length) return html + '<div class="hint">还没有可用的升级。研究「石斧」等科技后会出现。</div>';
        return html + '<div class="card-grid">' + names.map(upgradeCard).join('') + '</div>';
    }

    window.TabResearch = {
        renderTechs, renderUpgrades,
        fold, toggleEra, toggleDone, toggleTechDetail,
    };
})();
