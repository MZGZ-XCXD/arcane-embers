/* 贸易 / 远征 / 成就 标签页 */
(function () {
    const U = window.Utils;
    const G = window.UI;

    /* ---------------- 贸易 ---------------- */
    function marketRow(res) {
        const s = GameState;
        const cfg = RESOURCES_CONFIG[res];
        const m = s.market.resources[res];
        /* 没有市场价的资源（魔力 / 魔法知识 / 政策点）不参与贸易，也不在这里列出 */
        if (!m || !s.resources[res].visible || !TradeEngine.tradeable(res)) return '';
        const heat = s.market.heat[res] || 1;
        const price = cfg.value * heat;
        const rate = (s.market.lastRates || {})[res] || 0;
        const vol = s.market.volume || 0;
        const batch = vol / price;
        let html = '<div class="card" data-tip="market|' + G.esc(res) + '">';
        html += '<div class="card-head"><div class="card-name">' + cfg.icon + ' ' + G.esc(res) + '</div>' +
            '<div class="card-count" style="font-size:.78rem">' + U.fmtNum(price) + '<small> 金/单位</small></div></div>';
        html += '<div class="card-stats">';
        html += '<div class="row"><span class="k">存量</span><span class="v">' + U.fmtNum(s.resources[res].amount) + ' / ' + U.fmtNum(s.resources[res].cap) + '</span></div>';
        html += '<div class="row"><span class="k">价格热度</span><span class="v ' + (heat > 1.05 ? 'neg' : (heat < 0.95 ? 'pos' : 'neu')) + '">' + heat.toFixed(2) + '×</span></div>';
        html += '<div class="row"><span class="k">当前流量</span><span class="v ' + G.rateClass(rate) + '">' + G.rate(rate) + ' / 日</span></div>';
        html += '<div class="row"><span class="k">单批交易量</span><span class="v">' + U.fmtNum(batch) + '</span></div>';
        html += '</div>';
        html += '<div class="btn-row">';
        html += '<button class="btn tiny' + (m.mode === 'off' ? ' active' : '') + '" data-act="market|' + G.esc(res) + '|off">关</button>';
        html += '<button class="btn tiny' + (m.mode === 'buy' ? ' active' : '') + '" data-act="market|' + G.esc(res) + '|buy">持续买入</button>';
        html += '<button class="btn tiny' + (m.mode === 'sell' ? ' active' : '') + '" data-act="market|' + G.esc(res) + '|sell">持续卖出</button>';
        html += '</div>';
        if (m.mode !== 'off') {
            html += '<div class="policy-row mt6"><span class="hint">规模</span>' +
                '<input type="range" min="1" max="10" step="1" value="' + m.level + '" data-marketlvl="' + G.esc(res) + '">' +
                '<span class="hint">' + m.level + '/10</span></div>';
        }
        html += '<div class="btn-row mt6">';
        html += '<button class="btn tiny" data-act="trade|' + G.esc(res) + '|buy">买入一批</button>';
        html += '<button class="btn tiny" data-act="trade|' + G.esc(res) + '|sell">卖出一批</button>';
        html += '</div>';
        html += '</div>';
        return html;
    }

    function renderMarket() {
        const s = GameState;
        const markets = s.buildings['集市'].active || 0;
        let html = '<div class="tab-intro">集市决定 <b>贸易规模</b>：规模越大，每批交易量越高。' +
            '持续买入会推高热度（价格上升），持续卖出会压低热度；没有交易时热度会缓慢回到 1。' +
            '卖出价格为买入价的 80%。</div>';
        html += '<div class="card-stats" style="margin-bottom:10px">';
        html += '<div class="row"><span class="k">启用集市</span><span class="v">' + Math.round(markets) + ' 座</span></div>';
        html += '<div class="row"><span class="k">贸易规模</span><span class="v">' + U.fmtNum(s.market.volume) + ' 黄金/日</span></div>';
        html += '<div class="row"><span class="k">黄金结算</span><span class="v ' + G.rateClass(s.market.lastGoldFlow || 0) + '">' + G.rate(s.market.lastGoldFlow || 0) + ' / 日</span></div>';
        html += '</div>';
        if (!markets) return html + '<div class="hint">还没有集市：研究「贸易学」并建造第一座集市后即可开启贸易。</div>';
        const rows = Object.keys(RESOURCES_CONFIG)
            .filter(r => s.resources[r].visible && s.market.resources[r] && TradeEngine.tradeable(r))
            .map(marketRow).join('');
        return html + '<div class="card-grid wide">' + rows + '</div>';
    }

    /* ---------------- 远征 ---------------- */
    function regionCard(region) {
        const s = GameState;
        const power = s.localResources.power.amount * (1 + EffectsManager.additive(s, 'expeditionPower'));
        const chance = ExpeditionEngine.successChance(s, region);
        const check = ExpeditionEngine.canStart(s, region);
        const busy = ExpeditionEngine.activeCount(s) >= ExpeditionEngine.maxParties(s);
        const weak = power < region.power * 0.5;
        const dur = ExpeditionEngine.durationOf(s, region);
        const cut = ExpeditionEngine.masteryCut(s, region);
        const dropHero = window.Heroes ? Heroes.expeditionHeroFor(region.name) : null;
        let cls = 'card' + (check.ok && !weak ? ' affordable' : '') + (busy ? ' disabled' : '');
        let html = '<div class="' + cls + '" data-tip="exp|' + G.esc(region.name) + '">';
        html += '<div class="card-head"><div class="card-name">' + G.esc(region.name) +
            '<span class="tag">第' + region.tier + '层</span></div><div class="card-count" style="font-size:.78rem">' + U.fmtPct(chance) + '</div></div>';
        html += '<div class="card-desc">' + G.esc(region.desc) + '</div>';
        html += '<div class="card-stats">';
        html += '<div class="row"><span class="k">建议军力</span><span class="v ' + (power >= region.power ? 'pos' : 'neg') + '">' + U.fmtInt(region.power) + '</span></div>';
        html += '<div class="row"><span class="k">耗时</span><span class="v">' + dur + ' 日' +
            (cut > 0 ? '<small> 熟路 −' + Math.round(cut * 100) + '%</small>' : '') + '</span></div>';
        html += '<div class="row"><span class="k">秘宝概率</span><span class="v">' + U.fmtPct(region.artifact) + '</span></div>';
        html += '</div>';
        if (dropHero) {
            const got = Heroes.hasHero(s, dropHero.id);
            html += '<div class="hint ' + (got ? 'pos' : '') + '">遗迹英雄：' + G.esc(dropHero.name) +
                (got ? '（已结识）' : '（首次成功必得）') + '</div>';
        }
        html += '<div class="price">出发消耗：' + G.costHtml(region.cost) + '</div>';
        if (weak) html += '<div class="hint neg">军力远低于建议值，成功率很低。</div>';
        html += '<div class="card-actions"><button class="btn tiny primary" data-act="exp|' + G.esc(region.name) + '"' +
            (check.ok && !busy ? '' : ' disabled') + '>出发</button></div>';
        html += '</div>';
        return html;
    }

    function artifactCard(art, slot) {
        let html = '<div class="artifact" data-tip="artifact|' + G.esc(art.id) + '">';
        html += '<div class="an"><span>' + G.esc(art.name) + '</span><span>💠</span></div>';
        for (const line of Artifacts.describe(art.effects)) {
            html += '<div class="eff"><span>' + G.esc(line.split(' ')[0]) + '</span><span>' + G.esc(line.split(' ').slice(1).join(' ')) + '</span></div>';
        }
        html += '<div class="btn-row mt6">';
        if (slot === undefined) {
            html += '<button class="btn tiny primary" data-act="equip|' + G.esc(art.id) + '">装备</button>';
            html += '<button class="btn tiny danger" data-act="discard|' + G.esc(art.id) + '">丢弃</button>';
        } else {
            html += '<button class="btn tiny" data-act="unequip|' + slot + '">卸下</button>';
        }
        html += '</div></div>';
        return html;
    }

    function renderExpedition() {
        const s = GameState;
        const power = s.localResources.power.amount * (1 + EffectsManager.additive(s, 'expeditionPower'));
        let html = '<div class="tab-intro">派遣远征队探索大崩坏留下的遗迹：消耗物资、耗时若干游戏日，' +
            '按 <b>军力</b> 判定成败。成功可以带回稀有材料、奥术遗物，以及带随机词条的 <b>秘宝</b>。</div>';
        html += '<div class="card-stats" style="margin-bottom:10px">';
        html += '<div class="row"><span class="k">当前军力</span><span class="v pos">' + U.fmtInt(power) + '</span></div>';
        html += '<div class="row"><span class="k">已完成远征</span><span class="v">' + s.stats.expeditions + ' 次（失败 ' + s.stats.expeditionsFailed + '）</span></div>';
        html += '<div class="row"><span class="k">装备槽</span><span class="v">' + s.artifacts.equipped.filter(Boolean).length + ' / ' + Artifacts.artifactSlots(s) + '</span></div>';
        html += '</div>';
        const outNow = ExpeditionEngine.activeCount(s);
        const partySlots = ExpeditionEngine.maxParties(s);
        let extra = '<div class="card-stats" style="margin-bottom:10px">';
        extra += '<div class="row"><span class="k">在外远征队</span><span class="v">' + outNow + ' / ' + partySlots + ' 支</span></div>';
        if (window.Heroes && Heroes.hasMech(s, 'artifactPity')) {
            const need = (window.HERO_MECHS.artifactPity || {}).need || 5;
            extra += '<div class="row"><span class="k">秘宝保底</span><span class="v">' + Math.min(s.expedition.dry || 0, need) + ' / ' + need +
                ' 次成功</span></div>';
        }
        if (partySlots < 2 && window.Heroes) {
            const second = Heroes.heroWithMech('secondParty');
            if (second) extra += '<div class="hint">从「' + G.esc(second.drop) + '」带回「' + G.esc(second.name) + '」可解锁第二支远征队。</div>';
        }
        extra += '</div>';
        html += extra;

        /* 秘宝 */
        html += '<div class="section-title">秘宝</div>';
        const slots = Artifacts.artifactSlots(s);
        while (s.artifacts.equipped.length < slots) s.artifacts.equipped.push(null);
        html += '<div class="slots">';
        for (let i = 0; i < slots; i++) {
            const art = s.artifacts.equipped[i];
            html += art ? artifactCard(art, i) : '<div class="slot-empty">空置基座</div>';
        }
        html += '</div>';
        html += '<div class="hint mt6">秘宝库存 ' + s.artifacts.inventory.length + ' / 12（重置时会失去，除非拥有传承「记忆水晶」）</div>';
        if (s.artifacts.inventory.length) {
            html += '<div class="card-grid wide mt6">' + s.artifacts.inventory.map(a => artifactCard(a)).join('') + '</div>';
        }

        /* 区域 */
        html += '<div class="section-title">可探索区域</div>';
        const visible = EXPEDITIONS_CONFIG.filter(r => s.stats.expeditions > 0 || r.tier <= 3 || power >= r.power * 0.3);
        html += '<div class="card-grid wide">' + visible.map(regionCard).join('') + '</div>';

        /* 日志 */
        if (s.expedition.history.length) {
            html += '<div class="section-title">远征记录</div><div class="log-list" style="max-height:220px">';
            for (const h of s.expedition.history.slice(0, 12)) {
                const loot = Object.keys(h.loot).map(k => U.fmtNum(h.loot[k]) + ' ' + k).join('、');
                html += '<div class="log-item"><span class="d">' + G.esc(U.fmtDate(h.day)) + '</span><span class="t">' +
                    (h.success ? '✅ ' : '🏳️ ') + G.esc(h.region) + '：' + G.esc(loot || '几乎一无所获') +
                    (h.artifact ? ' · 秘宝「' + G.esc(h.artifact) + '」' : '') + '</span></div>';
            }
            html += '</div>';
        }
        return html;
    }

    /* ---------------- 成就 ---------------- */
    function renderAchievements() {
        const s = GameState;
        const got = Object.keys(s.achievements).length;
        let html = '<div class="tab-intro">成就会在达成条件时自动解锁，并提供永久被动效果（重置后依然生效）。' +
            '已解锁 <b>' + got + ' / ' + ACHIEVEMENTS_CONFIG.length + '</b>。</div>';
        html += '<div class="card-grid">';
        for (const cfg of ACHIEVEMENTS_CONFIG) {
            const has = !!s.achievements[cfg.id];
            html += '<div class="card' + (has ? ' researched' : ' locked') + '">';
            html += '<div class="card-head"><div class="card-name">' + (has ? '🏆 ' : '🔒 ') + G.esc(cfg.name) + '</div></div>';
            html += '<div class="card-desc">' + G.esc(cfg.desc) + '</div>';
            if (cfg.effectText) html += '<div class="hint pos">效果：' + G.esc(cfg.effectText) + '</div>';
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    window.TabWorld = { renderMarket, renderExpedition, renderAchievements };
})();
