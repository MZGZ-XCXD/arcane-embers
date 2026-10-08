/* 传送阵（英雄召唤）标签页 */
(function () {
    const U = window.Utils;
    const G = window.UI;

    const RARITY_ORDER = ['EX', 'S', 'A', 'B', 'C'];

    function rarityTag(rarity) {
        const r = HERO_RARITIES[rarity];
        return '<span class="rar" style="--rar:' + r.color + '">' + r.name + '</span>';
    }

    function effectLines(hero, awaken) {
        const mult = Heroes.awakenMultiplier(awaken || 0);
        const lines = G.effectLines(Heroes.heroEffect(hero));
        return lines.map(t => t + (mult > 1 ? '（×' + mult.toFixed(1) + '）' : ''));
    }

    function historyCard(entry) {
        const color = entry.rarity ? HERO_RARITIES[entry.rarity].color : '#6e7681';
        const label = entry.type === 'hero' ? entry.rarity : (entry.type === 'reward' ? '奖励' : '空');
        let sub = '';
        if (entry.type === 'hero') {
            if (entry.isNew) sub = '初次获得';
            else if (entry.awaken) sub = '觉醒 +1 → Lv.' + entry.awaken;
            else sub = '重复（转为遗物）';
        } else if (entry.type === 'reward') sub = '资源';
        else sub = '什么也没有';
        return '<div class="summon-item" style="--rar:' + color + '" data-tip="summon|' + G.esc(entry.name) + '">' +
            '<span class="si-rar">' + G.esc(label) + '</span>' +
            '<span class="si-name">' + G.esc(entry.name) + '</span>' +
            '<span class="si-sub">' + G.esc(sub) + '</span></div>';
    }

    function heroCard(hero) {
        const owned = GameState.heroes.owned[hero.id];
        const has = owned !== undefined;
        const r = HERO_RARITIES[hero.rarity];
        const cat = HERO_CATEGORIES[hero.category];
        let html = '<div class="hero-card ' + (has ? 'owned' : 'locked') + '" data-tip="hero|' + G.esc(hero.id) + '" style="--rar:' + r.color + '">';
        html += '<div class="hero-head"><span class="hero-rar">' + r.name + '</span>' +
            '<span class="hero-cat">' + cat.icon + ' ' + G.esc(cat.key) + '</span>' +
            (has ? '<span class="hero-awaken">觉醒 ' + owned + '</span>' : '') + '</div>';
        html += '<div class="hero-name">' + G.esc(hero.name) + '</div>';
        html += '<div class="hero-desc">' + (has ? G.esc(hero.desc) : '尚未召唤到这位英雄。') + '</div>';
        if (has) {
            html += '<div class="hero-eff">' + effectLines(hero, owned).map(t =>
                '<div class="row"><span class="k">效果</span><span class="v pos">' + G.esc(t) + '</span></div>').join('') + '</div>';
        } else {
            html += '<div class="hero-eff dim"><div class="row"><span class="k">基础效果</span><span class="v">' +
                G.esc(G.effectLines(Heroes.heroEffect(hero)).join('；')) + '</span></div></div>';
        }
        html += '</div>';
        return html;
    }

    function renderSummon() {
        const s = GameState;
        if (!s.techs['召唤法阵'] || !s.techs['召唤法阵'].researched) {
            return '<div class="tab-intro">传送阵尚未激活。研究科技「<b>召唤法阵</b>」（学院时代）后，这里会开启通往其它时间线的门。</div>';
        }
        const st = Heroes.stats(s);
        const cost1 = Heroes.pullCost(s, 1);
        const cost10 = Heroes.pullCost(s, 10);
        const can1 = ResourcesManager.canAfford(cost1);
        const can10 = ResourcesManager.canAfford(cost10);
        const luckMult = Heroes.luckMultiplier(s);
        const discount = Heroes.effectiveDiscount(s);

        let html = '<div class="tab-intro">传送阵把别处的「可能性」拉到这里：你召唤到的是其它时间线里活下来的英雄。' +
            '英雄分为 <b>C / B / A / S / EX</b> 五档，档位越高效果越强、也越难遇到；' +
            '重复召唤到同一位英雄会提升<b>觉醒等级</b>（每级效果 +' + Math.round(GACHA_CONFIG.awakeningStep * 100) + '%，最高 ' +
            GACHA_CONFIG.awakeningMax + ' 级），满觉后再抽到会转化为奥术遗物。<br>' +
            '卡池里除了英雄，还有资源馈赠与<b>空</b>（什么都没抽到）。</div>';

        /* 传送阵本体 */
        html += '<div class="summon-panel">';
        html += '<div class="summon-circle"><span>✦</span><i></i><b></b></div>';
        html += '<div class="summon-controls">';
        html += '<div class="summon-cost">单次消耗：' + G.costHtml(cost1) + '</div>';
        html += '<div class="btn-row">';
        html += '<button class="btn primary wide-action" data-act="summon|1">召唤 ×1</button>';
        html += '<button class="btn gold wide-action" data-act="summon|10">召唤 ×10（9 折）</button>';
        html += '</div>';
        html += '<div class="summon-cost">十连消耗：' + G.costHtml(cost10) + '</div>';
        html += '<div class="hint">召唤运气：S / EX 权重 ×' + luckMult.toFixed(2) + '（上限 ×' +
            (1 + GACHA_CONFIG.luckCap).toFixed(1) + '）　召唤折扣 −' + U.fmtPct(discount, 0) +
            '（上限 −' + U.fmtPct(GACHA_CONFIG.discountCap, 0) + '）　累计召唤 ' + U.fmtInt(st.pulls) + ' 次</div>';
        html += '</div></div>';

        /* 保底进度 */
        html += '<div class="section-title">保底进度</div><div class="pity-grid">';
        for (const key of ['A', 'S', 'EX']) {
            const need = GACHA_CONFIG.pity[key];
            const cur = Math.min(s.heroes.pity[key], need);
            html += '<div class="pity"><div class="row-between"><span>' + key + ' 级及以上保底</span>' +
                '<span class="hint">' + cur + ' / ' + need + '</span></div>' +
                G.bar(cur / need, key === 'EX' ? 'bad' : '') + '</div>';
        }
        html += '</div><div class="hint">达到保底后，下一次召唤必定获得对应档位以上。</div>';

        /* 最近结果 */
        html += '<div class="section-title">最近的结果</div>';
        if (!s.heroes.history.length) html += '<div class="hint">还没有召唤记录，试着拉开这道门。</div>';
        else html += '<div class="summon-log">' + s.heroes.history.slice(0, 12).map(historyCard).join('') + '</div>';

        /* 英雄殿堂 */
        html += '<div class="section-title">英雄殿堂　' + st.owned + ' / ' + st.total + '</div>';
        for (const rarity of RARITY_ORDER) {
            const list = HEROES_CONFIG.filter(h => h.rarity === rarity);
            if (!list.length) continue;
            const got = Heroes.ownedCount(s, rarity);
            html += '<div class="hero-group"><div class="hero-group-head" style="--rar:' + HERO_RARITIES[rarity].color + '">' +
                rarityTag(rarity) + '<span class="hint">' + got + ' / ' + list.length + '</span>' +
                '<span class="right hint">' + HERO_RARITIES[rarity].title + '</span></div>' +
                '<div class="card-grid">' + list.map(heroCard).join('') + '</div></div>';
        }

        /* 统计 */
        html += '<div class="section-title">召唤统计</div><div class="card-stats">';
        for (const rarity of RARITY_ORDER) {
            html += '<div class="row"><span class="k">' + HERO_RARITIES[rarity].name + ' 累计获得</span><span class="v">' +
                U.fmtInt(s.heroes.byRarity[rarity] || 0) + ' 次</span></div>';
        }
        html += '<div class="row"><span class="k">满觉重复转化遗物</span><span class="v gold">' + U.fmtInt(st.dupRelics) + '</span></div>';
        html += '</div>';
        return html;
    }

    window.TabSummon = { renderSummon, heroCard, rarityTag, effectLines };
})();
