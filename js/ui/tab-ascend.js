/* 国策标签页 + 传承（重置）标签页 */
(function () {
    const U = window.Utils;
    const G = window.UI;
    const permTree = { current: 'relic' };

    /* 该项传承是否已经可以出现（依赖的系统必须先解锁） */
    function isPermVisible(name) { return Actions.permVisible(GameState, name); }

    /* ---------------- 国策 ---------------- */
    function policyCard(name) {
        const s = GameState;
        const cfg = POLICIES_CONFIG[name];
        const p = s.policies[name];
        const eff = cfg.get(p.value) || {};
        const lines = G.effectLines(eff);
        const points = Math.floor(s.resources['政策点'].amount);
        let html = '<div class="policy">';
        html += '<div class="row-between"><h3>' + G.esc(name) + '</h3><span class="hint">每点消耗 ' + cfg.cost + ' 政策点</span></div>';
        html += '<p>' + G.esc(cfg.desc) + '</p>';
        html += '<div class="policy-row">';
        html += '<input type="range" min="' + cfg.min + '" max="' + cfg.max + '" step="' + cfg.step + '" value="' + p.value +
            '" data-policy="' + G.esc(name) + '">';
        html += '<span class="policy-val" id="policy-val-' + G.esc(name) + '">' + p.value + cfg.unit + '</span>';
        html += '</div>';
        html += '<div class="btn-row mt6">';
        html += '<button class="btn tiny" data-act="policy|' + G.esc(name) + '|' + cfg.min + '">最低</button>';
        html += '<button class="btn tiny" data-act="policy|' + G.esc(name) + '|' + cfg.def + '">默认</button>';
        html += '<button class="btn tiny" data-act="policy|' + G.esc(name) + '|' + cfg.max + '">最高</button>';
        html += '<span class="hint">当前政策点 ' + points + '</span>';
        html += '</div>';
        if (lines.length) {
            html += '<div class="card-stats mt6">' + lines.map(e => '<div class="row"><span class="k">效果</span><span class="v">' + G.esc(e) + '</span></div>').join('') + '</div>';
        }
        if (points <= 0) html += '<div class="hint neg mt6">政策点不足：拖动滑杆不会生效，先让「奥术议院」产出政策点。</div>';
        html += '</div>';
        return html;
    }

    function renderPolicies() {
        const s = GameState;
        const names = POLICIES_ORDER.filter(n => s.policies[n].visible);
        let html = '<div class="tab-intro">国策是双刃剑：提高一项收益往往要付出另一项代价。调整滑杆会消耗 <b>政策点</b>' +
            '（1 点 / 每单位 × 0.5 × 权重），政策点由「奥术议院」产出。</div>';
        if (!names.length) return html + '<div class="hint">还没有可以调整的国策。研究「铸币学」后解锁第一条税收政策。</div>';
        html += '<div class="hint" style="margin-bottom:8px">当前政策点：<b>' + Math.floor(s.resources['政策点'].amount) + ' / ' + U.fmtNum(s.resources['政策点'].cap) + '</b></div>';
        return html + names.map(policyCard).join('');
    }

    /* ---------------- 传承 ---------------- */
    /* 试炼星级加成只作用在「重置收获」上（不是全局产出），所以直接写在三张重置卡片上 ——
       否则玩家只能看到「当前激活星级」那行小字，会以为试炼星级根本没生效。 */
    function starBonusNote(s) {
        const stars = Actions.activeStars(s);
        if (!stars) return '';
        return '　<span class="hint">（含试炼星级 ' + stars + '★ → 收获 +' + (stars * 5) + '%）</span>';
    }

    const RESET_INFO = {
        relic: {
            title: '时空回响', type: 'relic',
            desc: '把整条时间线折叠起来重新展开。清空资源、建筑、科技与升级，' +
                '但保留传承资源、传承强化、成就、试炼进度与（在解锁后）秘宝。',
            gainText: s => '获得 <b>' + U.fmtInt(Actions.relicGain(s)) + '</b> 奥术遗物' + starBonusNote(s),
            need: s => s.resources['魔法知识'].cap >= 200 ? null : '需要魔法知识上限达到 200（当前 ' + U.fmtNum(s.resources['魔法知识'].cap) + '）',
        },
        star: {
            title: '星辰升华', type: 'star',
            desc: '把整座城市的存在形式升华为星光。比时空回响更彻底，同时获得大量遗物与星辉。' +
                '需要先把文明重新推到「星辉共鸣」这一步才能再次执行。',
            gainText: s => '获得 <b>' + U.fmtInt(Actions.relicGain(s) * 2) + '</b> 奥术遗物与 <b>' + U.fmtInt(Actions.starGain(s)) + '</b> 星辉' + starBonusNote(s),
            need: s => (s.techs['星辉共鸣'] && s.techs['星辉共鸣'].researched) ? null : '需要先研究「星辉共鸣」（第 4 时代 · 高塔时代）',
        },
        core: {
            title: '原初归寂', type: 'core',
            desc: '让世界回到被书写之前的空白。最深的一层重置，产出原初之核。' +
                '需要先把文明重新推到「虚空撕裂」这一步才能再次执行。',
            gainText: s => '获得 <b>' + U.fmtInt(Actions.coreGain(s)) + '</b> 原初之核、<b>' + U.fmtInt(Actions.starGain(s) * 1.5) +
                '</b> 星辉与 <b>' + U.fmtInt(Actions.relicGain(s) * 5) + '</b> 奥术遗物' + starBonusNote(s),
            need: s => (s.techs['虚空撕裂'] && s.techs['虚空撕裂'].researched) ? null : '需要先研究「虚空撕裂」（第 6 时代 · 虚空时代）',
        },
        ash: {
            title: '万象归墟', type: 'ash',
            desc: '连「重置」这个词也一起归零，最后只剩下余烬。最深的一层重置，产出归墟之烬。' +
                '需要先把文明重新推到「永寂仪式」这一步才能再次执行。',
            gainText: s => '获得 <b>' + U.fmtInt(Actions.ashGain(s)) + '</b> 归墟之烬、<b>' + U.fmtInt(Actions.coreGain(s) * 2) +
                '</b> 原初之核、<b>' + U.fmtInt(Actions.starGain(s) * 2) + '</b> 星辉与 <b>' +
                U.fmtInt(Actions.relicGain(s) * 10) + '</b> 奥术遗物' + starBonusNote(s),
            need: s => (s.techs['永寂仪式'] && s.techs['永寂仪式'].researched) ? null : '需要先研究「永寂仪式」（第 8 时代 · 归墟时代）',
        },
    };

    function resetCard(key) {
        const s = GameState;
        const info = RESET_INFO[key];
        const need = info.need(s);
        let html = '<div class="reset-card">';
        html += '<h3>' + info.title + '</h3>';
        html += '<p>' + info.desc + '</p>';
        html += '<div class="reset-gain">' + info.gainText(s) + '</div>';
        if (need) html += '<div class="hint neg">' + G.esc(need) + '</div>';
        html += '<div class="card-actions"><button class="btn tiny gold" data-act="prestige|' + key + '"' + (need ? ' disabled' : '') + '>执行</button></div>';
        html += '</div>';
        return html;
    }

    function permCard(name) {
        const s = GameState;
        const cfg = PERMANENT_CONFIG[name];
        const p = s.permanent[name];
        const cost = Actions.permanentCost(s, name);
        const maxed = p.level >= cfg.max;
        const affordable = ResourcesManager.amount(cost.res) >= cost.amount;
        const reqBlocked = cfg.req && s.permanent[cfg.req] && !s.permanent[cfg.req].level;
        let cls = 'card' + (maxed ? ' researched' : (affordable && !reqBlocked ? ' affordable' : ''));
        const clickable = !maxed && !reqBlocked;
        let html = '<div class="' + cls + (clickable ? ' clickable' : '') + '"' +
            (clickable ? ' data-act="perm|' + G.esc(name) + '"' : '') + ' data-tip="perm|' + G.esc(name) + '">';
        html += '<div class="card-head"><div class="card-name">' + G.esc(name) + '</div>' +
            '<div class="perm-level">Lv.' + p.level + ' / ' + cfg.max + '</div></div>';
        const effs = G.effectLines(cfg.effect);
        if (effs.length) html += '<div class="card-stats">' + effs.map(e =>
            '<div class="row"><span class="k">每级</span><span class="v pos">' + G.esc(e) + '</span></div>').join('') + '</div>';
        html += '<div class="card-desc">' + G.esc(cfg.desc) + '</div>';
        if (reqBlocked) html += '<div class="hint neg">需要先解锁「' + G.esc(cfg.req) + '」。</div>';
        else if (maxed) html += '<div class="hint pos">已满级。</div>';
        else html += '<div class="price"><span class="' + (affordable ? '' : 'lack') + '">' + U.fmtInt(cost.amount) + ' ' + cost.res + '</span></div>';
        html += '<div class="card-actions"><button class="btn gold wide-action" data-act="perm|' + G.esc(name) + '"' +
            (!maxed && !reqBlocked ? '' : ' disabled') + '>强化</button></div>';
        if (clickable) html += '<div class="card-tip"><span>点击卡片任意处即可强化</span><span></span></div>';
        html += '</div>';
        return html;
    }

    function challengeRow(cfg) {
        const s = GameState;
        const st = s.challenges[cfg.id];
        let built = 0;
        for (const n in s.buildings) built += s.buildings[n].count || 0;
        const locked = built > 0;
        let html = '<div class="card' + (st.active ? ' affordable' : '') + (st.completed ? ' researched' : '') + '" data-tip="challenge|' + G.esc(cfg.id) + '">';
        html += '<div class="card-head"><div class="card-name">⚔️ ' + G.esc(cfg.id) +
            '<span class="tag">' + '★'.repeat(cfg.star) + '</span></div>' +
            '<div class="card-count" style="font-size:.78rem">' +
            (st.active ? (st.completed ? '奖励已拿到 · 挑战中' : '进行中') : (st.completed ? '奖励已拿到' : '未激活')) +
            '</div></div>';
        html += '<div class="card-desc">' + G.esc(cfg.desc) + '</div>';
        html += '<div class="hint">完成方式：' + (cfg.requireReset === 'any' ? '任意重置' : (cfg.requireReset === 'star' ? '星辰升华' : '原初归寂')) +
            '　奖励：<span class="pos">' + G.esc(cfg.rewardText) + '</span></div>';
        if (st.completed && !st.active) {
            html += '<div class="hint pos">奖励已永久生效，不需要保持激活。想继续吃星级加成可以重新激活。</div>';
        }
        if (locked && !st.completed) {
            html += '<div class="hint neg">本轮已经开建，试炼不能再调整（只能等下次重置）。</div>';
        }
        html += '<div class="card-actions"><button class="btn tiny' + (st.active ? ' active' : '') + '" data-act="challenge|' + G.esc(cfg.id) + '"' +
            (locked ? ' disabled' : '') + '>' +
            (st.active ? '取消激活' : (st.completed ? '再次激活（只为星级加成）' : '激活试炼')) + '</button></div>';
        html += '</div>';
        return html;
    }

    function renderAscend() {
        const s = GameState;
        let html = '<div class="tab-intro">重置会清空这一轮的所有建设，但把进度压缩成 <b>传承资源</b>：' +
            '奥术遗物、星辉、原初之核与归墟之烬。用它们购买永久强化，下一轮会快得多。</div>';

        html += '<div class="section-title">重置方式</div>';
        html += resetCard('relic') + resetCard('star') + resetCard('core') + resetCard('ash');

        /* 轮回祝福：当前这条时间线选中的那一个 */
        html += '<div class="section-title">轮回祝福</div>';
        if (window.Blessings && Blessings.hasOffer(s)) {
            html += '<div class="settings-card"><div class="hint">你有一个还没选的祝福 —— ' +
                '<button class="btn tiny primary" data-act="blessingPick">现在选</button></div></div>';
        }
        const blessings = window.Blessings ? Blessings.current(s) : [];
        if (!blessings.length) {
            html += '<div class="hint">每一次重置之后，会从 3 个祝福里选 1 个，在这条时间线里一直有效。' +
                '下一次重置重新抽 —— 所以每一轮的路线都不一样。</div>';
        } else {
            html += '<div class="bless-grid">' + blessings.map(b =>
                '<div class="bless-card static"><div class="bless-head"><span class="bless-icon">' + b.icon + '</span>' +
                '<span class="bless-name">' + G.esc(b.name) + '</span></div>' +
                '<div class="bless-desc">' + G.esc(b.desc) + '</div>' +
                '<div class="bless-eff">' + G.effectLines(b.effect).map(t => '✦ ' + G.esc(t)).join('<br>') + '</div>' +
                '</div>').join('') + '</div>';
        }

        html += '<div class="section-title">传承强化</div>';
        html += '<div class="perm-tabs">';
        const trees = [['relic', '🏛️ 奥术遗物', '奥术遗物'], ['star', '⭐ 星辉', '星辉'],
            ['core', '🌑 原初之核', '原初之核'], ['ash', '🌘 归墟之烬', '归墟之烬']];
        for (const [key, label, res] of trees) {
            html += '<button class="btn tiny' + (permTree.current === key ? ' active' : '') + '" data-act="permtree|' + key + '">' +
                label + '（' + U.fmtNum(ResourcesManager.amount(res)) + '）</button>';
        }
        html += '</div>';
        /* 依赖的系统还没解锁时，对应的传承项不显示（例如没研究「召唤法阵」就不出现英雄类强化） */
        const locked = PERMANENT_ORDER.filter(n => PERMANENT_CONFIG[n].tree === permTree.current).length -
            PERMANENT_ORDER.filter(n => PERMANENT_CONFIG[n].tree === permTree.current && isPermVisible(n)).length;
        const names = PERMANENT_ORDER.filter(n => PERMANENT_CONFIG[n].tree === permTree.current && isPermVisible(n));
        html += '<div class="card-grid">' + names.map(permCard).join('') + '</div>';
        if (locked > 0) {
            html += '<div class="hint mt6">还有 <b>' + locked + '</b> 项强化会在解锁对应系统后出现：' +
                '英雄类需要先研究「召唤法阵」，远征与秘宝类需要先研究「城防」。</div>';
        }

        html += '<div class="section-title">试炼</div>';
        html += '<div class="hint" style="margin-bottom:8px">激活试炼会立刻施加严苛的限制，' +
            '但只要在对应的重置中坚持到底，就能永久获得奖励。<b>完成时试炼会自动关闭</b>（限制立刻解除，奖励永久保留）；' +
            '<b>试炼是整轮的承诺</b>：只能在本轮<u>还没有建造任何建筑</u>时开关（也就是刚重置完的那一刻），' +
            '一旦开建就锁定到本轮结束——否则可以在重置前临时打开白拿星级加成。' +
            '当前激活星级：<b>' + Actions.activeStars(s) +
            '</b>（每点星级让本次重置收获 +5%）。</div>';
        html += '<div class="card-grid wide">' + CHALLENGES_CONFIG.map(challengeRow).join('') + '</div>';
        return html;
    }

    window.TabAscend = {
        renderPolicies, renderAscend, permTree,
        isPermVisible,
    };
})();
