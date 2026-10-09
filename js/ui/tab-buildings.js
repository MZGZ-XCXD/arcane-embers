/* 建筑标签页 */
(function () {
    const U = window.Utils;
    const G = window.UI;
    const TYPES = ['采集', '加工', '魔力', '居住', '研究', '储存', '民生', '军备', '奇观'];

    const filters = { type: '全部', hideLocked: false, buy: 1 };

    function buildingCard(name) {
        const s = GameState;
        const cfg = BUILDINGS_CONFIG[name];
        const b = s.buildings[name];
        const st = ProductionEngine.getBuildingStats(s, name);
        const affordable = ResourcesManager.canAfford(b.price);
        const unlocked = b.unlocked;
        const queued = window.QueueEngine ? QueueEngine.queuedCount(s, 'building', name) : 0;
        const queueFull = window.QueueEngine ? QueueEngine.isFull(s) : false;
        /* 资源足够就直接建成，不占用队列；只有「买不起 + 队列满」时不能下单 */
        const blocked = !affordable && queueFull;

        let cls = 'card compact';
        if (!unlocked) cls += ' locked';
        else if (affordable) cls += ' affordable';
        if (unlocked && b.active === 0) cls += ' disabled';
        if (st.modeName) cls += '';

        /* 整张卡片就是主操作：未解锁的卡片点了会跳到科技页 */
        const primaryAct = unlocked ? ('buy|' + name + '|1') : 'tab|techs';
        let html = '<div class="' + cls + ' clickable" data-act="' + G.esc(primaryAct) + '" data-tip="build|' + G.esc(name) + '">';
        html += '<div class="card-head"><div class="card-name">' + G.esc(name) +
            (st.modeName ? '<span class="tag">' + G.esc(st.modeName) + '</span>' : '') +
            (queued > 0 ? '<span class="tag queue">排队中 ×' + queued + '</span>' : '') +
            (b.active > 0 && st.efficiency < 0.995 ? '<span class="tag warn">受限 ' + U.fmtPct(st.efficiency, 0) + '</span>' : '') +
            '</div>';
        html += '<div class="card-count">' + Math.round(b.active) + '<small> / ' + b.count + '</small></div></div>';

        if (!unlocked) {
            html += '<div class="card-desc">需要科技：<b>' + G.esc(cfg.tech) + '</b></div>';
            html += '<div class="card-tip"><span>点击前往科技页</span><span></span></div>';
            html += '</div>';
            return html;
        }

        /* 模式切换 */
        if (cfg.modes && b.count > 0) {
            html += '<div class="btn-row mt6">';
            cfg.modes.forEach((m, i) => {
                html += '<button class="btn tiny' + (b.mode === i ? ' active' : '') + '" data-act="mode|' + G.esc(name) + '|' + i + '">' + G.esc(m.name) + '</button>';
            });
            html += '</div>';
        }

        /* 只保留操作按钮，其余信息交给悬浮提示 */
        html += '<div class="card-actions">';
        html += '<button class="btn primary wide-action" data-act="buy|' + G.esc(name) + '|1"' + (blocked ? ' disabled' : '') + '>' +
            (blocked ? '队列已满' : (affordable ? '建造 ×1' : '排队等材料 ×1')) + '</button>';
        html += '<button class="btn tiny" data-act="buy|' + G.esc(name) + '|5"' + (blocked ? ' disabled' : '') + '>+5</button>';
        html += '<button class="btn tiny" data-act="buy|' + G.esc(name) + '|10"' + (blocked ? ' disabled' : '') + '>+10</button>';
        html += '<button class="btn tiny" data-act="buy|' + G.esc(name) + '|max"' + (affordable && !queueFull ? '' : ' disabled') + '>最大</button>';
        html += '<button class="btn tiny" data-act="toggle|' + G.esc(name) + '">' + (b.active > 0 ? '停用' : '启用') + '</button>';
        html += '</div>';
        html += '</div>';
        return html;
    }

    function render() {
        const s = GameState;
        const counts = {};
        for (const t of TYPES) counts[t] = 0;
        for (const name in s.buildings) {
            const cfg = BUILDINGS_CONFIG[name];
            if (!s.buildings[name].visible) continue;
            counts[cfg.type] = (counts[cfg.type] || 0) + 1;
        }

        let html = '<div class="tab-intro">大崩坏之后，一切都要重新盖起来。建筑需要 <b>人口</b> 维持运转，' +
            '并会因为 <b>原料短缺</b> 或 <b>人手不足</b> 而降低效率——效率会同时影响产量与消耗。<br>' +
            '<b>点击卡片任意处即可建造 ×1</b>；「+5 / +10 / 最大」用于批量建造，' +
            '「停用」可暂时关掉一座建筑（停用后不再消耗原料与人口）。<br>' +
            '材料足够时点击会<b>立即建成</b>；材料不足时会排进右侧队列，显示「还要多久凑齐材料」，凑齐的瞬间就自动建成。<br>' +
            '<b>把鼠标移到卡片上</b>即可查看该建筑的产出、消耗、上限、人口需求、效率、造价与说明；' +
            '名称旁的 <span class="tag warn">受限</span> 标记表示它当前没有满效率运转。</div>';

        html += '<div class="btn-row" style="margin-bottom:8px">';
        html += '<button class="btn tiny' + (filters.type === '全部' ? ' active' : '') + '" data-act="filter|全部">全部</button>';
        for (const t of TYPES) {
            if (!counts[t]) continue;
            html += '<button class="btn tiny' + (filters.type === t ? ' active' : '') + '" data-act="filter|' + t + '">' + t + '</button>';
        }
        html += '<button class="btn tiny' + (filters.hideLocked ? ' active' : '') + '" data-act="filter|!locked">仅显示已解锁</button>';
        html += '</div>';

        for (const t of TYPES) {
            const names = BUILDINGS_ORDER.filter(n => {
                const cfg = BUILDINGS_CONFIG[n];
                const b = s.buildings[n];
                if (!b.visible) return false;
                if (cfg.type !== t) return false;
                if (filters.type !== '全部' && filters.type !== t) return false;
                if (filters.hideLocked && !b.unlocked) return false;
                return true;
            });
            if (!names.length) continue;
            const totalActive = names.reduce((a, n) => a + s.buildings[n].active, 0);
            html += '<div class="section-title">' + t + '<span class="right" style="font-size:.72rem;color:var(--text-dim)">启用 ' + Math.round(totalActive) + '</span></div>';
            html += '<div class="card-grid buildings">' + names.map(buildingCard).join('') + '</div>';
        }
        return html;
    }

    window.TabBuildings = { render, filters };
})();
