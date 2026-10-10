/* 顶栏、左侧面板、右侧日志与事件面板、各类弹窗 */
(function () {
    const U = window.Utils;
    const G = window.UI;

    /* ---------------- 悬浮提示内容 ---------------- */
    /* 事件选项的「获得」文本：两遍预览的收益取范围 */
    function gainHtml(gain) {
        const parts = [];
        for (const k in gain) {
            const g = gain[k];
            const txt = g.min === g.max ? U.fmtNum(g.max) : U.fmtNum(g.min) + ' ~ ' + U.fmtNum(g.max);
            parts.push('<span class="pos">' + G.esc(k) + '　' + txt + '</span>');
        }
        return parts.join('') || '<span class="dim">没有直接收获</span>';
    }

    function tipHtml(key) {
        if (!key) return null;
        const parts = key.split('|');
        const type = parts[0], arg = parts[1];
        const s = GameState;

        if (type === 'res') {
            const cfg = RESOURCES_CONFIG[arg];
            if (!cfg) return null;
            const r = s.resources[arg];
            let html = '<h4>' + G.esc(arg) + '</h4>';
            html += '<div class="kv"><span>存量</span><span>' + G.num(r.amount) + ' / ' + G.num(r.cap) + '</span></div>';
            html += '<div class="kv"><span>净产量</span><span class="' + G.rateClass(r.production) + '">' + G.rate(r.production) + '/日</span></div>';
            if (cfg.value) {
                const heat = s.market.heat[arg] || 1;
                html += '<div class="kv"><span>市场价（热度 ' + heat.toFixed(2) + '）</span><span>' + U.fmtNum(cfg.value * heat) + ' 黄金</span></div>';
            }
            html += '<hr>';
            const contribs = ProductionEngine.getResourceContributions(s, arg);
            if (!contribs.length) html += '<div class="dim">暂无生产来源</div>';
            for (const c of contribs.slice(0, 14)) {
                html += '<div class="kv"><span>' + G.esc(c.source) + '</span><span class="' + G.rateClass(c.value) + '">' +
                    (c.note ? G.esc(c.note) : G.rate(c.value) + '/日') + '</span></div>';
            }
            if (contribs.length > 14) html += '<div class="dim">…共 ' + contribs.length + ' 项来源</div>';
            if (cfg.desc) html += '<hr><div class="dim">' + G.esc(cfg.desc) + '</div>';
            return html;
        }

        if (type === 'build') {
            const cfg = BUILDINGS_CONFIG[arg];
            const b = s.buildings[arg];
            if (!cfg || !b) return null;
            const st = ProductionEngine.getBuildingStats(s, arg);
            const active = ProductionEngine.activeConfig(cfg, b);
            const affordable = ResourcesManager.canAfford(st.price);
            let html = '<h4>' + G.esc(arg) + (st.modeName ? ' · ' + G.esc(st.modeName) : '') + '</h4>';
            html += '<div class="dim">' + G.esc(active.desc || cfg.desc) + '</div><hr>';
            html += '<div class="kv"><span>已建 / 启用</span><span>' + b.count + ' / ' + b.active + '</span></div>';
            if (b.active > 0) {
                html += '<div class="kv"><span>当前效率</span><span class="' +
                    (st.efficiency >= 0.999 ? 'pos' : (st.efficiency > 0.4 ? 'neu' : 'neg')) + '">' + U.fmtPct(st.efficiency) + '</span></div>';
                if (st.efficiency < 0.995) {
                    const lack = st.cons.filter(c => {
                        const r = s.resources[c.res];
                        return r && r.amount < r.cap * 0.05;
                    }).map(c => c.res);
                    const noPop = s.localResources.population.used > s.localResources.population.capacity + 1e-6;
                    let reason = '原料或人口不足';
                    if (lack.length && noPop) reason = lack.join('、') + ' 供应不足，且人手不足';
                    else if (lack.length) reason = lack.join('、') + ' 供应不足';
                    else if (noPop) reason = '人手不足';
                    html += '<div class="neg">效率受限：' + G.esc(reason) + '</div>';
                }
            }
            if (st.prod.length) {
                html += '<hr>';
                for (const p of st.prod) {
                    html += '<div class="kv"><span>产出 ' + G.esc(p.res) + '</span><span class="pos">' +
                        U.fmtNum(p.per * st.efficiency) + '/日 每座' +
                        (b.active > 1 ? '（共 ' + U.fmtNum(p.total) + '/日）' : '') + '</span></div>';
                }
                const hm = ProductionEngine.happinessMult(s);
                if (Math.abs(hm - 1) > 0.005) {
                    html += '<div class="dim">以上产出已按当前民望 ×' + hm.toFixed(2) + ' 结算。</div>';
                }
            }
            if (st.cons.length) {
                for (const c of st.cons) {
                    html += '<div class="kv"><span>消耗 ' + G.esc(c.res) + '</span><span class="neg">' + U.fmtNum(c.per * st.efficiency) + '/日 每座</span></div>';
                }
            }
            if (st.caps.length) {
                for (const c of st.caps) {
                    html += '<div class="kv"><span>上限 ' + G.esc(c.res) + '</span><span class="mana">+' + U.fmtNum(c.per) + ' 每座</span></div>';
                }
            }
            for (const k in st.providesLocal) {
                html += '<div class="kv"><span>提供 ' + LOCAL_RESOURCES_CONFIG[k].name + '</span><span class="pos">+' + U.fmtNum(st.providesLocal[k]) + '</span></div>';
            }
            for (const k in st.requiresLocal) {
                html += '<div class="kv"><span>需要 ' + LOCAL_RESOURCES_CONFIG[k].name + '</span><span class="neg">' + U.fmtNum(st.requiresLocal[k]) + '</span></div>';
            }
            if (st.happiness) html += '<div class="kv"><span>民望</span><span class="pos">+' + U.fmtNum(st.happiness) + '</span></div>';
            html += '<hr>';
            html += '<div class="kv"><span>造价（第 ' + (b.count + 1) + ' 座）</span><span class="' +
                (affordable ? 'pos' : 'neg') + '">' + (affordable ? '可以建造' : '资源不足') + '</span></div>';
            html += '<div>' + G.priceHtml(st.price) + '</div>';
            if (st.modifiers && st.modifiers.length) {
                html += '<hr>';
                for (const m of st.modifiers) {
                    const bits = [];
                    if (m.prod) bits.push('产出 +' + U.fmtPct(m.prod));
                    if (m.cons) bits.push('消耗 +' + U.fmtPct(m.cons));
                    if (m.cap) bits.push('上限 +' + U.fmtPct(m.cap));
                    html += '<div class="kv"><span>' + G.esc(m.target) + '</span><span class="pos">' + bits.join('，') + '</span></div>';
                }
            }
            html += '<hr><div class="dim">点击卡片任意处 = 建造 ×1；名称旁出现「受限」标记时，说明它当前没有满效率运转。</div>';
            return html;
        }

        if (type === 'tech') {
            const cfg = TECHS_CONFIG[arg];
            if (!cfg) return null;
            let html = '<h4>' + G.esc(arg) + '</h4>' + '<div class="dim">' + G.esc(cfg.desc) + '</div>';
            if (cfg.prereq.length) {
                html += '<hr>';
                for (const p of cfg.prereq) {
                    const ok = s.techs[p] && s.techs[p].researched;
                    html += '<div class="kv"><span>前置 ' + G.esc(p) + '</span><span class="' + (ok ? 'pos' : 'neg') + '">' + (ok ? '已完成' : '未完成') + '</span></div>';
                }
            }
            const unlocks = BUILDINGS_ORDER.filter(n => BUILDINGS_CONFIG[n].tech === arg);
            if (unlocks.length) html += '<hr><div class="kv"><span>解锁建筑</span><span>' + unlocks.map(G.esc).join('、') + '</span></div>';
            const effs = G.effectLines(cfg.effect);
            if (effs.length) html += '<hr>' + effs.map(e => '<div class="kv"><span>' + G.esc(e) + '</span><span></span></div>').join('');
            return html;
        }

        if (type === 'upgrade') {
            const cfg = UPGRADES_CONFIG[arg];
            const u = s.upgrades[arg];
            if (!cfg || !u) return null;
            let html = '<h4>' + G.esc(arg) + ' · Lv.' + u.level + '</h4><div class="dim">' + G.esc(cfg.desc) + '</div>';
            html += '<hr><div class="kv"><span>等级上限</span><span>' + cfg.cap + '</span></div>';
            const effs = G.effectLines(cfg.effect);
            if (effs.length) html += effs.map(e => '<div class="kv"><span>每级：' + G.esc(e) + '</span><span></span></div>').join('');
            return html;
        }

        if (type === 'perm') {
            const cfg = PERMANENT_CONFIG[arg];
            const p = s.permanent[arg];
            if (!cfg || !p) return null;
            const cost = Actions.permanentCost(s, arg);
            let html = '<h4>' + G.esc(arg) + ' · ' + p.level + '/' + cfg.max + '</h4><div class="dim">' + G.esc(cfg.desc) + '</div><hr>';
            if (p.level < cfg.max) html += '<div class="kv"><span>下一级花费</span><span class="gold">' + U.fmtInt(cost.amount) + ' ' + cost.res + '</span></div>';
            else html += '<div class="kv"><span>状态</span><span class="pos">已满级</span></div>';
            const effs = G.effectLines(cfg.effect);
            for (const e of effs) html += '<div class="kv"><span>每级：' + G.esc(e) + '</span><span></span></div>';
            return html;
        }

        if (type === 'happy') {
            let html = '<h4>民望 ' + U.fmtNum(s.happiness, 0) + '</h4>';
            html += '<div class="dim">民望是所有建筑产出的乘数：每 100 点民望 = ×1 产出（当前 ×' +
                ProductionEngine.happinessMult(s).toFixed(2) + '）。<br>' +
                '民望极低时最低按 ×0.1 结算，所以只会拖慢生产，不会让城市彻底停摆。</div><hr>';
            const list = s.happinessList || [];
            for (const h of list.slice(0, 16)) {
                html += '<div class="kv"><span>' + G.esc(h.source) + '</span><span class="' + G.rateClass(h.value) + '">' + G.rate(h.value) + '</span></div>';
            }
            html += '<hr><div class="kv"><span>当前产出乘数</span><span class="pos">×' +
                ProductionEngine.happinessMult(s).toFixed(2) + '</span></div>';
            return html;
        }

        if (type === 'market') {
            const cfg = RESOURCES_CONFIG[arg];
            const m = s.market.resources[arg];
            if (!cfg || !m) return null;
            const heat = s.market.heat[arg] || 1;
            const price = cfg.value * heat;
            let html = '<h4>' + G.esc(arg) + ' · 贸易</h4>';
            html += '<div class="kv"><span>基础价值</span><span>' + U.fmtNum(cfg.value) + ' 黄金</span></div>';
            html += '<div class="kv"><span>当前热度</span><span>' + heat.toFixed(2) + '×</span></div>';
            html += '<div class="kv"><span>买入价</span><span class="pos">' + U.fmtNum(price) + ' 黄金/单位</span></div>';
            html += '<div class="kv"><span>卖出价</span><span class="neg">' + U.fmtNum(price * TradeEngine.SELL_RATIO) + ' 黄金/单位</span></div>';
            const r = (s.market.lastRates || {})[arg] || 0;
            html += '<div class="kv"><span>当前流量</span><span class="' + G.rateClass(r) + '">' + G.rate(r) + '/日</span></div>';
            html += '<hr><div class="dim">买入会推高价格，卖出会压低价格；无人交易时热度会缓慢回到 1。流量受「集市」提供的贸易规模限制。</div>';
            return html;
        }

        if (type === 'exp') {
            const r = ExpeditionEngine.findRegion(arg);
            if (!r) return null;
            const chance = ExpeditionEngine.successChance(s, r);
            const power = s.localResources.power.amount * (1 + EffectsManager.additive(s, 'expeditionPower'));
            let html = '<h4>' + G.esc(r.name) + ' · 第 ' + r.tier + ' 层</h4><div class="dim">' + G.esc(r.desc) + '</div><hr>';
            html += '<div class="kv"><span>建议军力</span><span>' + U.fmtInt(r.power) + '</span></div>';
            html += '<div class="kv"><span>你的军力</span><span class="' + (power >= r.power ? 'pos' : 'neg') + '">' + U.fmtInt(power) + '</span></div>';
            html += '<div class="kv"><span>成功率</span><span>' + U.fmtPct(chance) + '</span></div>';
            const dur = ExpeditionEngine.durationOf(s, r);
            const cut = ExpeditionEngine.masteryCut(s, r);
            html += '<div class="kv"><span>耗时</span><span>' + dur + ' 日' +
                (cut > 0 ? '（熟路 −' + Math.round(cut * 100) + '%）' : '') + '</span></div>';
            html += '<div class="kv"><span>已成功探索</span><span>' + ExpeditionEngine.masteredClears(s, r) + ' 次</span></div>';
            const dropHero = window.Heroes ? Heroes.expeditionHeroFor(r.name) : null;
            if (dropHero) {
                const got = Heroes.hasHero(s, dropHero.id);
                html += '<div class="kv"><span>遗迹英雄</span><span class="' + (got ? 'pos' : 'gold') + '">' +
                    G.esc(dropHero.name) + (got ? '（已结识）' : '（首次成功必得）') + '</span></div>';
            }
            html += '<hr><div>出发消耗：' + G.costHtml(r.cost) + '</div>';
            const loot = [];
            for (const k in r.loot) loot.push(k + ' ' + U.fmtNum(r.loot[k][0]) + '~' + U.fmtNum(r.loot[k][1]));
            if (r.relics[1]) loot.push('奥术遗物 ' + r.relics[0] + '~' + r.relics[1]);
            html += '<div>可能收获：' + G.esc(loot.join('、')) + '</div>';
            html += '<div class="kv"><span>秘宝概率</span><span>' + U.fmtPct(r.artifact) + '</span></div>';
            return html;
        }

        if (type === 'artifact') {
            const list = s.artifacts.inventory.concat(s.artifacts.equipped.filter(Boolean));
            const art = list.find(a => a.id === arg);
            if (!art) return null;
            let html = '<h4>' + G.esc(art.name) + '</h4>';
            html += '<div class="dim">来自第 ' + art.tier + ' 层遗迹。</div><hr>';
            for (const line of Artifacts.describe(art.effects)) {
                html += '<div class="kv"><span>' + G.esc(line) + '</span><span></span></div>';
            }
            return html;
        }

        if (type === 'challenge') {
            const cfg = CHALLENGES_CONFIG.find(c => c.id === arg);
            if (!cfg) return null;
            const st = s.challenges[cfg.id] || {};
            let html = '<h4>' + G.esc(cfg.name) + ' · ' + '★'.repeat(cfg.star) + '</h4>';
            html += '<div class="dim">' + G.esc(cfg.desc) + '</div><hr>';
            html += '<div class="kv"><span>状态</span><span class="' + (st.completed ? 'pos' : (st.active ? 'neg' : '')) + '">' +
                (st.active ? (st.completed ? '奖励已拿到 · 挑战中' : '进行中（限制生效）') : (st.completed ? '奖励已拿到（试炼已关闭）' : '未激活')) + '</span></div>';
            html += '<div>完成条件：' + (cfg.requireReset === 'any' ? '任意重置' : (cfg.requireReset === 'star' ? '星辰升华' : '原初归寂')) + '</div>';
            html += '<div class="kv"><span>完成奖励</span><span class="pos">' + G.esc(cfg.rewardText) + '</span></div>';
            html += '<hr><div class="dim">完成后试炼会自动关闭：限制立即解除，奖励永久生效（奖励只看「已完成」，不看是否还开着）。</div>';
            return html;
        }

        /* 事件选项：剧情说明 + 明确的「扣什么 / 得什么」 */
        if (type === 'evchoice') {
            const ev = EventEngine.current(s);
            if (!ev) return null;
            const idx = Number(arg);
            const c = ev.choices[idx];
            if (!c) return null;
            const pv = EventEngine.preview(s, ev, idx);
            let html = '<h4>' + G.esc(c.text) + '</h4>';
            if (c.hint) html += '<div class="dim">' + G.esc(c.hint) + '</div>';
            html += '<hr>';
            if (pv && Object.keys(pv.cost).length) {
                html += '<div class="kv"><span>消耗</span><span>' + G.costHtml(pv.cost) + '</span></div>';
            } else {
                html += '<div class="kv"><span>消耗</span><span class="dim">不消耗任何资源</span></div>';
            }
            if (c.needPower) {
                const okPower = s.localResources.power.amount + 1e-9 >= c.needPower;
                html += '<div class="kv"><span>需要军力</span><span class="' + (okPower ? 'pos' : 'lack') + '">' +
                    U.fmtNum(c.needPower) + (okPower ? '（当前足够）' : '（当前只有 ' + U.fmtNum(s.localResources.power.amount) + '）') + '</span></div>';
            }
            html += '<div class="kv"><span>获得</span><span>' + gainHtml(pv ? pv.gain : {}) + '</span></div>';
            if (pv && pv.happy.length) {
                const vals = pv.happy.slice().sort((a, b) => a - b);
                html += '<div class="kv"><span>民望</span><span class="' +
                    (vals[vals.length - 1] >= 0 ? 'pos' : 'neg') + '">' +
                    vals.map(v => (v >= 0 ? '+' : '') + U.fmtNum(v, 0)).join(' 或 ') + '</span></div>';
            }
            if (pv) {
                for (const b of pv.buffs) {
                    const lines = G.effectLines(b.effect);
                    html += '<div class="kv"><span>持续效果</span><span class="pos">' + G.esc(b.label) +
                        '（' + U.fmtNum(b.days, 0) + ' 日' + (lines.length ? '：' + lines.map(G.esc).join('；') : '') + '）</span></div>';
                }
            }
            if (!pv) html += '<div class="dim">（该选项的结果视情况而定，详见描述。）</div>';
            return html;
        }

        if (type === 'offline') {
            const rep = s.offlineReport;
            if (!rep) return null;
            let html = '<h4>离线结算</h4>';
            html += '<div class="kv"><span>离开时间</span><span>' + U.fmtDuration(rep.realSeconds) + '</span></div>';
            html += '<div class="kv"><span>有效结算</span><span>' + U.fmtDuration(rep.seconds) + '</span></div>';
            html += '<div class="kv"><span>效率</span><span>' + Math.round(rep.factor * 100) + '%</span></div>';
            html += '<hr>';
            for (const k in rep.gains) html += '<div class="kv"><span>' + G.esc(k) + '</span><span class="pos">+' + U.fmtNum(rep.gains[k]) + '</span></div>';
            return html;
        }

        if (type === 'queue') {
            if (!window.QueueEngine) return null;
            const it = GameState.queue.items.find(x => x.id === arg);
            if (!it) return null;
            const cost = QueueEngine.currentCost(GameState, it) || {};
            const eta = QueueEngine.eta(GameState, it);
            const blocked = QueueEngine.capBlocked(GameState, it);
            let html = '<h4>' + G.esc(it.name) + (it.count > 1 ? ' ×' + it.count : '') +
                ' · ' + G.esc(QueueEngine.KIND_LABEL[it.kind]) + '</h4>';
            html += '<div class="kv"><span>材料已备</span><span>' + U.fmtPct(QueueEngine.progress(GameState, it), 0) + '</span></div>';
            html += '<div class="kv"><span>预计建成</span><span>' +
                (blocked ? '<span class="lack">上限不足</span>' : (eta === null ? '无法估算' : (eta <= 1e-9 ? '材料已就绪' : U.fmtDuration(eta) + ' 后'))) +
                '</span></div>';
            html += '<hr><div>还需要凑齐：</div><div>' + G.priceHtml(cost) + '</div>';
            if (blocked) html += '<div class="neg">「' + G.esc(blocked) + '」的仓储上限低于这笔订单所需，订单永远凑不齐；先去提升上限或取消订单。</div>';
            html += '<hr><div class="dim">订单只是「排队等材料」，材料一凑齐就会立即建成；取消订单不会损失任何材料。</div>';
            return html;
        }

        if (type === 'hero') {
            if (!window.Heroes) return null;
            const hero = Heroes.heroById(arg);
            if (!hero) return null;
            const owned = s.heroes.owned[arg];
            const r = HERO_RARITIES[hero.rarity];
            const cat = HERO_CATEGORIES[hero.category];
            let html = '<h4>' + G.esc(hero.name) + ' · ' + r.name + '</h4>';
            html += '<div class="dim">' + cat.icon + ' ' + G.esc(cat.key) + '：' + G.esc(cat.desc) + '</div>';
            html += '<div class="dim">' + G.esc(hero.desc) + '</div><hr>';
            const mech = Heroes.heroMech(hero);
            if (hero.source === 'expedition') {
                html += '<div class="kv"><span>获得方式</span><span class="gold">遗迹限定 · 只从「' + G.esc(hero.drop) + '」带回</span></div>';
                html += '<div class="kv"><span>出现时机</span><span>' +
                    (owned === undefined ? '首次成功必得，之后每次成功 15%' : '已结识（重复带回会化成奥术遗物）') + '</span></div>';
                if (mech) {
                    html += '<div class="kv"><span>机制</span><span class="pos">' + G.esc(mech.name) + '</span></div>';
                    html += '<div class="dim">' + G.esc(mech.text) + '</div>';
                }
            } else {
                html += '<div class="kv"><span>基础出现率</span><span>约 ' + U.fmtPct(Heroes.rarityChance(hero.rarity), 2) + ' / 抽</span></div>';
                if (r.beyond) {
                    html += '<div class="kv"><span>保底</span><span class="dim">没有保底</span></div>';
                    html += '<div class="kv"><span>跨越时间线</span><span class="gold">抽到即永久保留（重置也不会失去）</span></div>';
                }
            }
            if (owned === undefined) {
                html += '<div class="neg">' + (hero.source === 'expedition' ? '还没有从遗迹里带回它。' : '尚未召唤到这位英雄。') + '</div>';
                if (hero.source !== 'expedition') {
                    html += '<hr><div class="dim">基础效果（' + r.name + ' × ' + r.mult + '）：' +
                        G.esc(G.effectLines(Heroes.heroEffect(hero)).join('；')) + '</div>';
                }
            } else {
                if (hero.source === 'expedition') {
                    html += '<div class="kv"><span>状态</span><span class="pos">机制已生效</span></div>';
                } else {
                    html += '<div class="kv"><span>觉醒等级</span><span class="gold">' + owned + ' / ' + GACHA_CONFIG.awakeningMax + '</span></div>';
                    for (const line of (window.TabSummon ? TabSummon.effectLines(hero, owned) : [])) {
                        html += '<div class="kv"><span>' + G.esc(line) + '</span><span></span></div>';
                    }
                    html += '<hr><div class="dim">重复召唤会提升觉醒等级（每级 +' +
                        Math.round(GACHA_CONFIG.awakeningStep * 100) + '%），满觉后再抽到会转化为奥术遗物。</div>';
                }
            }
            return html;
        }

        if (type === 'text') return G.esc(parts.slice(1).join('|'));
        return null;
    }

    /* ---------------- 顶栏 ---------------- */
    function renderHeader() {
        const s = GameState;
        const era = getCurrentEra(s);
        document.getElementById('stat-era').textContent = era.name;
        document.getElementById('stat-date').textContent = U.fmtDate(s.gameDays);
        document.getElementById('stat-speed').textContent = '×' + s.speed.toFixed(2);
        const h = document.getElementById('stat-happy');
        h.querySelector('span:last-child').textContent = U.fmtNum(s.happiness, 0);
        const fac = window.ProductionEngine ? ProductionEngine.happinessMult(s) : (s.happinessFactor || 1);
        h.querySelector('span:last-child').className = fac >= 1 ? 'ok pos' : 'neg';
        h.setAttribute('data-tip', 'happy');
        document.getElementById('btn-pause').textContent = s.paused ? '▶' : '⏸';
    }

    /* ---------------- 人口面板 ---------------- */
    const popRefs = {};
    function renderPopulation() {
        const s = GameState;
        const pop = s.localResources.population;
        const power = s.localResources.power;
        const box = document.getElementById('panel-population');
        const hintKind = pop.capacity <= 0 ? 'none' : (pop.used >= pop.capacity ? 'full' : 'ok');

        /* 结构只在状态类别变化时重建，其余时间原地更新数字（避免 hover 闪烁） */
        if (box.__sig !== hintKind) {
            box.__sig = hintKind;
            let html = '<div class="panel-title">文明<span class="right" id="pop-status"></span></div>';
            html += '<div class="pop-line"><span>人口占用</span><span class="value"><span id="pop-used"></span> / <span id="pop-cap"></span></span></div>';
            html += G.bar(0, 'good').replace('class="bar good"', 'class="bar good" id="pop-bar"');
            html += '<div class="pop-line" data-tip="happy" style="cursor:help"><span>民望</span><span class="value"><span id="pop-happy"></span> <small id="pop-mult"></small></span></div>';
            html += G.bar(0, 'good').replace('class="bar good"', 'class="bar good" id="happy-bar"');
            html += '<div class="stat-grid">';
            html += '<div>军力 <b id="pop-power"></b></div>';
            html += '<div>建筑 <b id="pop-buildings"></b></div>';
            html += '<div>时代 <b id="pop-era"></b></div>';
            html += '<div>遗迹 <b id="pop-expeditions"></b></div>';
            html += '</div>';
            html += '<div class="hint mt6" id="pop-hint"></div>';
            G.setHTML(box, html);
            for (const id of ['pop-status', 'pop-used', 'pop-cap', 'pop-happy', 'pop-mult', 'pop-power',
                'pop-buildings', 'pop-era', 'pop-expeditions', 'pop-hint', 'pop-bar', 'happy-bar']) {
                popRefs[id] = box.querySelector('#' + id);
            }
        }

        const ratio = pop.capacity > 0 ? pop.used / pop.capacity : (pop.used > 0 ? 2 : 1);
        G.setText(popRefs['pop-status'], pop.used > pop.capacity ? '人手不足' : '运转正常');
        G.setText(popRefs['pop-used'], U.fmtNum(pop.used));
        G.setText(popRefs['pop-cap'], U.fmtNum(pop.capacity));
        popRefs['pop-bar'].className = 'bar ' + (ratio > 1 ? 'bad' : 'good');
        popRefs['pop-bar'].firstElementChild.style.width = U.clamp(ratio * 100, 0, 100).toFixed(1) + '%';
        G.setText(popRefs['pop-happy'], U.fmtNum(s.happiness, 0));
        /* 显示的乘数必须就是实际参与结算的那个（走同一个接口，避免两处口径不一致） */
        const happyFac = ProductionEngine.happinessMult(s);
        G.setText(popRefs['pop-mult'], '×' + happyFac.toFixed(2));
        popRefs['pop-mult'].className = happyFac >= 1 ? 'pos' : 'neg';
        popRefs['happy-bar'].className = 'bar ' + (s.happiness >= 100 ? 'good' : 'bad');
        popRefs['happy-bar'].firstElementChild.style.width = (U.clamp(s.happiness / 600, 0, 1) * 100).toFixed(1) + '%';
        G.setText(popRefs['pop-power'], U.fmtNum(power.amount));
        G.setText(popRefs['pop-buildings'], String(Object.values(s.buildings).reduce((a, b) => a + b.count, 0)));
        G.setText(popRefs['pop-era'], getCurrentEra(s).name);
        G.setText(popRefs['pop-expeditions'], String(s.stats.expeditions));
        G.setText(popRefs['pop-hint'], hintKind === 'none'
            ? '还没有居所：研究「搭建帐篷」并建造帐篷，人口才能支撑其它建筑。'
            : (hintKind === 'full' ? '人手已满：建造更多居所才能让新建筑满效率运转。' : ''));
    }

    /* ---------------- 资源面板 ---------------- */
    let resSig = '';
    let resRefs = {};
    function renderResources() {
        const s = GameState;
        const order = Object.keys(RESOURCES_CONFIG);
        const box = document.getElementById('panel-resources');
        const visible = order.filter(k => s.resources[k].visible);
        const sig = visible.join(',');

        if (sig !== resSig || !box.firstElementChild) {
            resSig = sig;
            let html = '<div class="panel-title">资源<span class="right">净值 / 日</span></div><div class="res-list">';
            for (const k of visible) {
                const cfg = RESOURCES_CONFIG[k];
                html += '<div class="res-row' + (cfg.prestige ? ' prestige' : '') + '" data-tip="res|' + G.esc(k) + '">';
                html += '<span class="ico">' + (cfg.icon || '•') + '</span>';
                html += '<span class="nm">' + G.esc(k) + '</span>';
                html += '<span class="amt"></span>';
                html += '<span class="rate"></span>';
                html += '</div>';
            }
            html += '</div>';
            G.setHTML(box, html);
            resRefs = {};
            const rows = box.querySelectorAll('.res-row');
            for (let i = 0; i < visible.length; i++) {
                resRefs[visible[i]] = {
                    row: rows[i],
                    amt: rows[i].querySelector('.amt'),
                    rate: rows[i].querySelector('.rate'),
                };
            }
        }

        for (const k of visible) {
            const r = s.resources[k];
            const cfg = RESOURCES_CONFIG[k];
            const ref = resRefs[k];
            if (!ref) continue;
            const full = !cfg.prestige && r.cap > 0 && r.amount >= r.cap - 1e-6;
            const rowCls = 'res-row' + (full ? ' full' : '') + (cfg.prestige ? ' prestige' : '');
            if (ref.row.className !== rowCls) ref.row.className = rowCls;
            const amtHtml = U.fmtNum(r.amount) + (cfg.prestige ? '' : ' <small>/' + U.fmtNum(r.cap) + '</small>');
            if (ref.amt.__lastText !== amtHtml) { ref.amt.__lastText = amtHtml; ref.amt.innerHTML = amtHtml; }
            const rateText = G.rate(r.production) + ' / 日';
            G.setText(ref.rate, rateText);
            const rateCls = 'rate' + (r.production < -1e-9 ? ' neg' : '');
            if (ref.rate.className !== rateCls) ref.rate.className = rateCls;
        }
    }

    /* ---------------- 建造队列面板 ---------------- */
    const queueRefs = {};
    function renderQueue() {
        const s = GameState;
        const box = document.getElementById('panel-queue');
        if (!box) return;
        if (!window.QueueEngine) return;
        const items = QueueEngine.items(s);
        const slots = QueueEngine.slots(s);
        const sig = items.map(it => it.id).join(',') + '|' + slots + '|' + QueueEngine.discount(s).toFixed(3);

        if (box.__sig !== sig) {
            box.__sig = sig;
            let html = '<div class="panel-title">建造队列<span class="right">' + items.length + ' / ' + slots + ' 槽</span></div>';
            if (!items.length) {
                html += '<div class="hint">队列空闲。</div>';
                G.setHTML(box, html);
                for (const k in queueRefs) delete queueRefs[k];
                return;
            }
            html += '<div class="queue-list">';
            for (const it of items) {
                html += '<div class="queue-item waiting" data-tip="queue|' + G.esc(it.id) + '">';
                html += '<div class="q-head"><span class="q-kind">' + G.esc(QueueEngine.KIND_LABEL[it.kind]) + '</span>' +
                    '<span class="q-name">' + G.esc(it.name) + (it.count > 1 ? ' ×' + it.count : '') + '</span>' +
                    '<span class="q-time" data-q-time="' + G.esc(it.id) + '"></span></div>';
                html += G.bar(0).replace('class="bar "', 'class="bar" data-q-bar="' + G.esc(it.id) + '"');
                html += '<div class="q-est" data-q-est="' + G.esc(it.id) + '"></div>';
                html += '<div class="q-foot"><button class="btn tiny danger" data-act="queuecancel|' + G.esc(it.id) + '">取消订单</button></div>';
                html += '</div>';
            }
            html += '</div>';
            html += '<div class="hint mt6">订单材料折扣 −' + U.fmtPct(QueueEngine.discount(s), 0) +
                '（上限 −' + U.fmtPct(QueueEngine.DISCOUNT_CAP, 0) + '）：折扣越低，订单要凑的材料越少。</div>';
            G.setHTML(box, html);
            for (const k in queueRefs) delete queueRefs[k];
            for (const it of items) {
                queueRefs[it.id] = {
                    time: box.querySelector('[data-q-time="' + it.id + '"]'),
                    bar: box.querySelector('[data-q-bar="' + it.id + '"]'),
                    est: box.querySelector('[data-q-est="' + it.id + '"]'),
                };
            }
        }

        for (const it of items) {
            const ref = queueRefs[it.id];
            if (!ref) continue;
            const p = QueueEngine.progress(s, it);
            const blocked = QueueEngine.capBlocked(s, it);
            const eta = QueueEngine.eta(s, it);
            if (ref.bar && ref.bar.firstElementChild) {
                ref.bar.firstElementChild.style.width = (p * 100).toFixed(1) + '%';
                ref.bar.className = 'bar ' + (blocked ? 'bad' : '');
            }
            if (blocked) G.setText(ref.time, '上限不足');
            else if (eta === null) G.setText(ref.time, '无法估算');
            else if (eta <= 1e-9) G.setText(ref.time, '材料已就绪');
            else G.setText(ref.time, U.fmtDuration(eta) + ' 后建成');
            const cost = QueueEngine.currentCost(s, it) || {};
            G.setHTML(ref.est, '需要：' + G.priceHtml(cost));
        }
    }

    function renderEvent() {
        const s = GameState;
        const ev = EventEngine.current(s);
        const box = document.getElementById('panel-event');
        if (!ev) {
            const rest = Math.max(0, s.nextEventDay - s.gameDays);
            G.setHTML(box, '<div class="panel-title">命运的涟漪</div><div class="hint">世界继续运转。下一次波动预计在 ' +
                U.fmtDuration(rest) + ' 后到来。</div>' +
                (s.activeEffects.length ? '<div class="chip-row mt6">' + s.activeEffects.map(ae =>
                    '<span class="chip" data-tip="text|' + G.esc(ae.desc || ae.name) + '">' + G.esc(ae.name) + ' ' + Math.ceil(ae.remain) + '日</span>').join('') + '</div>' : ''));
            return;
        }
        let html = '<div class="panel-title">事件<span class="right">请做出选择</span></div>';
        html += '<div class="panel event-card" style="padding:10px">';
        html += '<h3>' + G.esc(ev.title) + '</h3><p>' + G.esc(ev.text) + '</p>';
        html += '<div class="event-choices">';
        ev.choices.forEach((c, i) => {
            /* 资源（或军力）不够的选项不能点击，并标出缺多少 */
            const payable = EventEngine.choicePayable ? EventEngine.choicePayable(s, c) : true;
            html += '<div class="event-choice">';
            html += '<button class="btn wide' + (payable ? '' : ' locked') + '" data-act="eventchoice|' + i + '"' +
                (payable ? '' : ' disabled') + ' data-tip="evchoice|' + i + '">' + G.esc(c.text) + '</button>';
            const needs = [];
            if (c.cost && Object.keys(c.cost).length) needs.push('消耗 ' + G.costHtml(c.cost));
            if (c.needPower) {
                const okPower = s.localResources.power.amount + 1e-9 >= c.needPower;
                needs.push('<span class="' + (okPower ? '' : 'lack') + '">需要军力 ' + U.fmtNum(c.needPower) +
                    '（当前 ' + U.fmtNum(s.localResources.power.amount) + '）</span>');
            }
            if (needs.length) html += '<div class="choice-need">' + needs.join('　') + '</div>';
            html += '</div>';
        });
        html += '</div></div>';
        G.setHTML(box, html);
    }

    /* ---------------- 远征小面板 ---------------- */
    const expRefs = {};
    function renderExpeditionPanel() {
        const s = GameState;
        const box = document.getElementById('panel-expedition');
        if (!box) return;
        const parties = ExpeditionEngine.parties(s);
        const slots = ExpeditionEngine.maxParties(s);
        /* 签名带上队伍 id：增减队伍都会重建，避免复用已被顶替的节点 */
        const sig = parties.map(p => p.id).join(',') + '|' + slots;
        if (box.__sig !== sig) {
            box.__sig = sig;
            for (const k in expRefs) delete expRefs[k];
            if (!parties.length) {
                const power = s.localResources.power.amount * (1 + EffectsManager.additive(s, 'expeditionPower'));
                G.setHTML(box, '<div class="panel-title">远征队</div><div class="hint">远征队待命中，当前军力 ' + U.fmtNum(power) + '。</div>');
                return;
            }
            let html = '<div class="panel-title">远征中<span class="right">' + parties.length + ' / ' + slots + ' 支</span></div>';
            for (const p of parties) {
                html += '<div class="exp-party">';
                html += '<div class="mini"><span>' + G.esc(p.region) + '</span><span data-exp-eta="' + G.esc(p.id) + '"></span></div>';
                html += G.bar(0, '').replace('class="bar "', 'class="bar" data-exp-bar="' + G.esc(p.id) + '"');
                html += '<div class="hint" data-exp-remain="' + G.esc(p.id) + '"></div>';
                html += '</div>';
            }
            G.setHTML(box, html);
            for (const p of parties) {
                expRefs[p.id] = {
                    bar: box.querySelector('[data-exp-bar="' + p.id + '"]'),
                    eta: box.querySelector('[data-exp-eta="' + p.id + '"]'),
                    remain: box.querySelector('[data-exp-remain="' + p.id + '"]'),
                };
            }
        }
        if (!parties.length) return;
        for (const p of parties) {
            const ref = expRefs[p.id];
            if (!ref) continue;
            const region = ExpeditionEngine.findRegion(p.region);
            const pr = ExpeditionEngine.progress(s, p);
            const chance = ExpeditionEngine.successChance(s, region);
            if (ref.bar && ref.bar.firstElementChild) {
                ref.bar.firstElementChild.style.width = (U.clamp(pr, 0, 1) * 100).toFixed(1) + '%';
            }
            G.setText(ref.eta, U.fmtPct(pr) + '　成功率 ' + U.fmtPct(chance));
            G.setText(ref.remain, '剩余 ' + U.fmtDuration(ExpeditionEngine.remaining(s, p)) + '。' +
                (s.expedition.history.length ? '上次结果：' + (s.expedition.history[0].success ? '成功' : '失败') : ''));
        }
    }

    /* ---------------- 日志 ---------------- */
    function renderLog() {
        const s = GameState;
        let html = '<div class="panel-title">编年史<span class="right">' + s.eventLogs.length + ' 条</span></div><div class="log-list">';
        if (!s.eventLogs.length) html += '<div class="hint">文明刚刚开始，还没有值得记录的事。</div>';
        for (const log of s.eventLogs.slice(0, 40)) {
            html += '<div class="log-item"><span class="d">' + G.esc(U.fmtDate(log.day)) + '</span><span class="t">' + G.esc(log.text) + '</span></div>';
        }
        html += '</div>';
        G.setHTML(document.getElementById('panel-log'), html);
    }

    /* ---------------- 统计 ---------------- */
    function renderStats() {
        const s = GameState;
        const st = s.stats;
        const effs = s.activeEffects.length ? s.activeEffects.map(ae =>
            '<span class="chip" data-tip="text|' + G.esc(ae.desc || '') + '">' + G.esc(ae.name) + ' ' + Math.ceil(ae.remain) + '日</span>').join('') : '<span class="hint">无</span>';
        let html = '<div class="panel-title">统计</div><div class="stat-grid">';
        html += '<div>游玩时长 <b>' + U.fmtDuration(st.playSeconds) + '</b></div>';
        html += '<div>重置次数 <b>' + (st.resets.relic + st.resets.star + st.resets.core) + '</b></div>';
        html += '<div>远征 <b>' + st.expeditions + '</b>（败 ' + st.expeditionsFailed + '）</div>';
        html += '<div>秘宝 <b>' + st.artifactsFound + '</b></div>';
        html += '<div>成就 <b>' + Object.keys(s.achievements).length + '/' + ACHIEVEMENTS_CONFIG.length + '</b></div>';
        html += '<div>事件 <b>' + st.events + '</b></div>';
        html += '<div>峰值人口 <b>' + U.fmtNum(st.peakPopulation || 0) + '</b></div>';
        html += '<div>知识峰值 <b>' + U.fmtNum(st.peakKnowledge || 0) + '</b></div>';
        html += '</div>';
        html += '<div class="panel-title mt10">状态效果</div><div class="chip-row">' + effs + '</div>';
        G.setHTML(document.getElementById('panel-stats'), html);
    }

    /* ---------------- 弹窗 ---------------- */
    function exportModal() {
        const data = SaveEngine.exportSave(GameState);
        const html = '<h2>导出存档</h2><p>复制下面的文本并妥善保存。随时可以在「导入存档」中粘贴回来。</p>' +
            '<textarea readonly>' + G.esc(data) + '</textarea>' +
            '<div class="modal-actions"><button class="btn" data-act="closemodal">关闭</button></div>';
        const wrap = G.openModal(html);
        const ta = wrap.querySelector('textarea');
        ta.focus(); ta.select();
    }

    function importModal() {
        const html = '<h2>导入存档</h2><p>粘贴先前导出的文本。导入会覆盖当前进度。</p>' +
            '<textarea placeholder="在此粘贴存档文本…"></textarea>' +
            '<div class="modal-actions"><button class="btn" data-act="closemodal">取消</button>' +
            '<button class="btn primary" data-act="doimport">导入</button></div>';
        G.openModal(html);
    }

    function offlineModal() {
        const rep = GameState.offlineReport;
        if (!rep) return;
        const gains = Object.keys(rep.gains).map(k => '<div class="kv"><span>' + G.esc(k) + '</span><span class="pos">+' + U.fmtNum(rep.gains[k]) + '</span></div>').join('') || '<div class="dim">没有产生收益</div>';
        const html = '<h2>你离开的这段时间</h2>' +
            '<p>离线 ' + U.fmtDuration(rep.realSeconds) + '，其中结算 ' + U.fmtDuration(rep.seconds) +
            '（效率 ' + Math.round(rep.factor * 100) + '%）。提升「永恒延长」与「虚空自转」传承可以提高离线收益。</p>' +
            '<h3>收获</h3>' + gains +
            '<div class="modal-actions"><button class="btn primary" data-act="closemodal">继续重建</button></div>';
        G.openModal(html);
    }

    window.Panels = {
        tipHtml, renderHeader, renderPopulation, renderResources,
        renderEvent, renderExpeditionPanel, renderLog, renderStats, renderQueue,
        exportModal, importModal, offlineModal,
    };
})();
