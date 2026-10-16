/* 领地标签页：开拓地块（永久保留） */
(function () {
    const U = window.Utils;
    const G = window.UI;

    function plotCard(cfg) {
        const s = GameState;
        const claimed = Plots.isClaimed(s, cfg.id);
        const unlocked = Plots.unlocked(s, cfg.id);
        const c = Plots.cost(s, cfg.id);
        const affordable = ResourcesManager.canAfford(c);

        let cls = 'card compact';
        if (!unlocked) cls += ' locked';
        else if (!claimed && affordable) cls += ' affordable';
        if (claimed) cls += ' researched';

        let html = '<div class="' + cls + '" data-tip="plot|' + G.esc(cfg.id) + '">';
        html += '<div class="card-head"><div class="card-name">' + cfg.icon + ' ' + G.esc(cfg.name) +
            (claimed ? '<span class="tag">已开拓</span>' : '') + '</div>' +
            '<div class="card-count" style="font-size:.72rem">' + Plots.claimedCount(s) + ' / ' + PLOTS_CONFIG.length + '</div></div>';
        html += '<div class="card-desc">' + G.esc(cfg.desc) + '</div>';

        if (!unlocked) {
            html += '<div class="card-desc">需要科技：<b>' + G.esc(cfg.tech) + '</b></div>';
            html += '<div class="card-tip"><span>点击前往科技页</span><span></span></div></div>';
            return html;
        }
        if (claimed) {
            html += '<div class="card-tip"><span>加成生效中（重置后会失去，需要重新开拓）</span><span></span></div></div>';
            return html;
        }
        html += '<div class="card-actions">';
        html += '<button class="btn primary wide-action" data-act="plot|' + G.esc(cfg.id) + '"' + (affordable ? '' : ' disabled') + '>' +
            (affordable ? '开拓' : '资源不足') + '</button>';
        html += '</div>';
        html += '<div class="plot-cost">' + G.priceHtml(c) + '</div>';
        html += '</div>';
        return html;
    }

    function render() {
        const s = GameState;
        if (!s.techs['领地开拓'] || !s.techs['领地开拓'].researched) {
            return '<div class="tab-intro">领地尚未开放。研究科技「<b>领地开拓</b>」（学徒时代）后，' +
                '就可以在城墙之外开拓地块。</div>';
        }
        const claimed = Plots.claimedCount(s);
        let html = '<div class="tab-intro">用资源开拓城墙之外的地块：每块地都要先研究对应科技，' +
            '成本固定不涨。领地<b>不跨重置保留</b> —— 每一次重建都要重新把它们开拓一遍，' +
            '所以这一层是「每轮中期的一段扩张」，而不是一次性的永久加成。</div>';

        html += '<div class="card-stats" style="margin-bottom:10px">';
        html += '<div class="row"><span class="k">已开拓</span><span class="v pos">' + claimed + ' / ' + PLOTS_CONFIG.length + '</span></div>';
        const disc = EffectsManager.additive(s, 'plotCost');
        if (disc < 0) {
            html += '<div class="row"><span class="k">传承「领地工程」折扣</span><span class="v">' + U.fmtPct(disc, 1) + '</span></div>';
        }
        html += '</div>';

        /* 已开拓的排前面，方便看进度 */
        const list = PLOTS_CONFIG.slice().sort((a, b) => {
            const ca = Plots.isClaimed(s, a.id) ? 0 : 1;
            const cb = Plots.isClaimed(s, b.id) ? 0 : 1;
            return ca - cb;
        });
        html += '<div class="card-grid wide">' + list.map(plotCard).join('') + '</div>';

        if (claimed >= PLOTS_CONFIG.length) {
            html += '<div class="hint mt6">所有领地都已开拓 —— 这一层已经走完了。</div>';
        }
        return html;
    }

    window.TabPlots = { render, plotCard };
})();
