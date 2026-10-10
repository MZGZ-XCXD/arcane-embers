/* =========================================================
   玩家操作 & 重置（传承）逻辑
   ========================================================= */
(function () {

    /* ---------------- 建筑 ---------------- */
    /* 购买建筑：资源足够立即建成；不足则作为订单进入队列等待资源 */
    function buyBuilding(state, name, amount) {
        const res = QueueEngine.enqueue(state, 'building', name, amount === undefined ? 1 : amount);
        if (!res.ok) return { ok: false, msg: res.msg };
        return { ok: true, built: res.instant || 0, queued: res.queued || 0, msg: res.msg };
    }

    function setBuildingActive(state, name, active) {
        const b = state.buildings[name];
        if (!b) return;
        if (active === 'toggle') active = b.active > 0 ? 0 : b.count;
        if (active === 'all') active = b.count;
        b.active = Utils.clamp(Math.round(active), 0, b.count);
        if (b.active === 0) b.efficiency = 1;
        ProductionEngine.updatePrices(state);
        ProductionEngine.computeProductionAndCaps(state);
    }

    function setBuildingMode(state, name, mode) {
        const b = state.buildings[name];
        const cfg = BUILDINGS_CONFIG[name];
        if (!b || !cfg || !cfg.modes) return;
        b.mode = Utils.clamp(mode, 0, cfg.modes.length - 1);
        ProductionEngine.computeProductionAndCaps(state);
    }

    /* ---------------- 科技 ---------------- */
    function research(state, name) {
        const res = QueueEngine.enqueue(state, 'tech', name, 1);
        return res.ok ? { ok: true, msg: res.msg } : { ok: false, msg: res.msg };
    }

    /* ---------------- 升级 ---------------- */
    function buyUpgrade(state, name) {
        const res = QueueEngine.enqueue(state, 'upgrade', name, 1);
        return res.ok ? { ok: true, msg: res.msg } : { ok: false, msg: res.msg };
    }

    /* ---------------- 国策 ---------------- */
    function setPolicy(state, name, value) {
        const p = state.policies[name];
        const cfg = POLICIES_CONFIG[name];
        if (!p || !cfg || !p.visible) return { ok: false };
        value = Utils.clamp(Math.round(value), cfg.min, cfg.max);
        const delta = Math.abs(value - p.value);
        const cost = Math.ceil(delta * cfg.cost * 0.5);
        if (cost > 0) {
            if (state.resources['政策点'].amount + 1e-9 < cost) {
                return { ok: false, msg: '政策点不足（需要 ' + cost + ' 点）。' };
            }
            state.resources['政策点'].amount -= cost;
        }
        p.value = value;
        ProductionEngine.computeProductionAndCaps(state);
        return { ok: true, cost: cost };
    }

    /* ---------------- 传承（永久强化） ---------------- */
    function permanentCost(state, name) {
        const cfg = PERMANENT_CONFIG[name];
        const lvl = state.permanent[name].level;
        const res = cfg.tree === 'relic' ? '奥术遗物' : (cfg.tree === 'star' ? '星辉' : '原初之核');
        return { res: res, amount: Math.ceil(cfg.cost * Math.pow(cfg.costG, lvl)) };
    }

    function buyPermanent(state, name) {
        const cfg = PERMANENT_CONFIG[name];
        const p = state.permanent[name];
        if (!cfg || !p) return { ok: false };
        if (!permVisible(state, name)) {
            return { ok: false, msg: '这项强化要在研究「' + cfg.techReq + '」之后才会出现。' };
        }
        if (p.level >= cfg.max) return { ok: false, msg: '已达最高等级。' };
        if (cfg.req && state.permanent[cfg.req] && !state.permanent[cfg.req].level) {
            return { ok: false, msg: '需要先解锁「' + cfg.req + '」。' };
        }
        const c = permanentCost(state, name);
        if (state.resources[c.res].amount + 1e-9 < c.amount) return { ok: false, msg: c.res + '不足。' };
        state.resources[c.res].amount -= c.amount;
        p.level++;
        p.researched = true;
        EventEngine.addLog(state, '✦ 传承强化「' + name + '」提升至 ' + p.level + ' 级，消耗 ' + c.amount + ' ' + c.res + '。');
        ProductionEngine.computeProductionAndCaps(state);
        return { ok: true, msg: name + ' → ' + p.level + ' 级' };
    }

    /* 传承项是否可以出现：它依赖的系统（科技）没解锁之前就先不显示 */
    function permVisible(state, name) {
        const cfg = PERMANENT_CONFIG[name];
        if (!cfg) return false;
        if (cfg.techReq) {
            const t = state.techs[cfg.techReq];
            if (!t || !t.researched) return false;
        }
        return true;
    }

    /* ---------------- 试炼 ---------------- */
    function toggleChallenge(state, id) {
        const c = state.challenges[id];
        if (!c) return { ok: false };
        c.active = !c.active;
        ProductionEngine.computeProductionAndCaps(state);
        return { ok: true, msg: (c.active ? '开启' : '关闭') + '试炼「' + id + '」' };
    }

    function activeStars(state) {
        let stars = 0;
        for (const cfg of CHALLENGES_CONFIG) {
            const st = state.challenges[cfg.id];
            if (st && st.active) stars += cfg.star;
        }
        return stars;
    }

    /* ---------------- 重置收益 ---------------- */
    function relicGain(state) {
        const knowledgeCap = state.resources['魔法知识'].cap;
        const popCap = state.localResources.population.capacity;
        const towers = state.buildings['时之沙漏'].count + state.buildings['星辰塔'].count;
        const base = Math.pow(Math.log(Math.max(1, knowledgeCap) + 1), 2) + popCap / 15;
        const bMult = 1 + 0.03 * towers;
        const eMult = (1 + EffectsManager.additive(state, 'relicGain')) * (1 + EffectsManager.additive(state, 'resetGain'));
        const starMult = 1 + activeStars(state) * 0.05;
        return Math.floor(base * bMult * eMult * starMult);
    }

    function starGain(state) {
        const relics = ResourcesManager.amount('奥术遗物');
        const eMult = (1 + EffectsManager.additive(state, 'resetGain'));
        const starMult = 1 + activeStars(state) * 0.05;
        return Math.max(1, Math.floor(Math.sqrt(Math.max(1, relics)) * 0.6 * eMult * starMult));
    }

    function coreGain(state) {
        const stars = ResourcesManager.amount('星辉');
        const eMult = (1 + EffectsManager.additive(state, 'resetGain'));
        const starMult = 1 + activeStars(state) * 0.05;
        return Math.max(1, Math.floor(Math.sqrt(Math.max(1, stars)) / 4 * eMult * starMult));
    }

    function resetAvailability(state) {
        return {
            relic: state.resources['魔法知识'].cap >= 200,
            star: ResourcesManager.amount('奥术遗物') >= 300,
            core: ResourcesManager.amount('星辉') >= 60,
        };
    }

    /* 重置：清空非传承进度，按 opts 补发传承资源 */
    function performReset(state, opts) {
        opts = opts || {};
        const keepArtifacts = EffectsManager.hasSpecial(state, 'keepArtifacts');
        const oldArtifacts = { inventory: state.artifacts.inventory, equipped: state.artifacts.equipped };

        /* 重置前记录试炼完成情况 */
        const stars = activeStars(state);
        if (stars > state.stats.maxChallengeStars) state.stats.maxChallengeStars = stars;
        for (const cfg of CHALLENGES_CONFIG) {
            const st = state.challenges[cfg.id];
            if (!st || !st.active || st.completed) continue;
            const need = cfg.requireReset;
            if (need === 'any' || need === opts.type) {
                st.completed = true;
                /* 完成后自动关闭试炼：惩罚（看 active）立刻解除，奖励（看 completed）永久保留。
                   想再拿星级加成可以随时重新激活，奖励不会重复获得。 */
                st.active = false;
                EventEngine.addLog(state, '⚔️ 完成试炼「' + cfg.id + '」，永久获得：' + cfg.rewardText +
                    '（试炼已自动关闭，限制解除，奖励永久生效）');
                if (window.UI && UI.toast) UI.toast('⚔️ 试炼完成：' + cfg.id + '（已自动关闭）', 'gold');
            }
        }

        const keepRelic = ResourcesManager.amount('奥术遗物');
        const keepStar = ResourcesManager.amount('星辉');
        const keepCore = ResourcesManager.amount('原初之核');
        const achievements = state.achievements;
        const stats = state.stats;
        const settings = state.settings;
        const permanent = state.permanent;
        const challenges = state.challenges;
        const heroes = state.heroes;              // 英雄收藏跨重置保留
        const expeditionHistory = state.expedition.history;

        /* 重新初始化，再恢复保留项 */
        initState();
        state.achievements = achievements;
        state.stats = stats;
        state.settings = settings;
        state.permanent = permanent;
        state.challenges = challenges;
        state.heroes = heroes;
        state.expedition.history = expeditionHistory;
        state.resources['奥术遗物'].amount = keepRelic + (opts.relic || 0);
        state.resources['星辉'].amount = keepStar + (opts.star || 0);
        state.resources['原初之核'].amount = keepCore + (opts.core || 0);
        state.stats.resets[opts.type] = (state.stats.resets[opts.type] || 0) + 1;
        state.stats.history.unshift({ day: state.stats.playSeconds, type: opts.type });
        if (state.stats.history.length > 50) state.stats.history.pop();

        /* 文明火种：重置后的启动资源 */
        grantStartResources(state);

        /* 文明薪火：自动研究第一时代科技 */
        const autoTech = state.permanent['文明薪火'] ? state.permanent['文明薪火'].level : 0;
        if (autoTech > 0) {
            const era1 = TECHS_ORDER.filter(n => TECHS_CONFIG[n].era === 1);
            const count = autoTech >= 3 ? era1.length : (autoTech === 2 ? 4 : 1);
            for (let i = 0; i < Math.min(count, era1.length); i++) {
                state.techs[era1[i]].researched = true;
            }
        }

        /* 秘宝：有「记忆水晶」才保留，否则随重置一起消失（不再有会碎裂的脆弱秘宝） */
        if (keepArtifacts) {
            state.artifacts.inventory = (oldArtifacts.inventory || []).filter(a => true);
            state.artifacts.equipped = (oldArtifacts.equipped || []).filter(Boolean);
        }

        ProductionEngine.updatePrices(state);
        ProductionEngine.computeProductionAndCaps(state);
        EventEngine.addLog(state, '🕯️ ' + (opts.label || '重置') + '完成，文明在废墟上重新开始。');
        return true;
    }

    /* 重置后的启动资源（含「文明火种」传承加成）
       注意：启动物资必须同时抬高对应资源的基础上限，否则会被仓库上限直接截断，
       玩家看到的就只是「上限满了」，像是传承没生效。 */
    function grantStartResources(state) {
        const e = EffectsManager.refreshAllEffects(state);
        const gift = e.startResources > 0 ? { 木材: 300, 石料: 200, 食物: 100, 魔力: 80 } : null;
        state.resources['木材'].amount += 25;
        state.resources['石料'].amount += 15;
        if (gift) {
            for (const k in gift) {
                const r = state.resources[k];
                if (!r) continue;
                r.baseCap = (r.baseCap || r.cap) + gift[k];
                r.cap = Math.max(r.cap, r.baseCap);
            }
            ResourcesManager.add(gift);
        }
    }

    function prestige(state, type) {
        const avail = resetAvailability(state);
        if (type === 'relic') {
            if (!avail.relic) return { ok: false, msg: '需要魔法知识上限达到 200。' };
            const gain = relicGain(state);
            performReset(state, { type: 'relic', relic: gain, label: '时空回响' });
            return { ok: true, msg: '时空回响！获得 ' + Utils.fmtInt(gain) + ' 奥术遗物。' };
        }
        if (type === 'star') {
            if (!avail.star) return { ok: false, msg: '需要持有 300 枚奥术遗物。' };
            const relics = relicGain(state) * 2;
            const stars = starGain(state);
            performReset(state, { type: 'star', relic: relics, star: stars, label: '星辰升华' });
            return { ok: true, msg: '星辰升华！获得 ' + Utils.fmtInt(relics) + ' 奥术遗物与 ' + Utils.fmtInt(stars) + ' 星辉。' };
        }
        if (type === 'core') {
            if (!avail.core) return { ok: false, msg: '需要持有 60 枚星辉。' };
            const relics = relicGain(state) * 5;
            const stars = Math.floor(starGain(state) * 1.5);
            const cores = coreGain(state);
            performReset(state, { type: 'core', relic: relics, star: stars, core: cores, label: '原初归寂' });
            return { ok: true, msg: '原初归寂！获得 ' + Utils.fmtInt(cores) + ' 原初之核、' + Utils.fmtInt(stars) + ' 星辉与 ' + Utils.fmtInt(relics) + ' 奥术遗物。' };
        }
        return { ok: false };
    }

    /* ---------------- 自动化 ---------------- */
    function autoBuildStep(state) {
        if (!state.settings.autoBuild) return null;
        if (!EffectsManager.hasSpecial(state, 'autoBuild')) return null;
        if (QueueEngine.isFull(state)) return null;                       // 队列满了就先等
        if (!EffectsManager.hasSpecial(state, 'perfectEfficiency') && state.localResources.population.used >= state.localResources.population.capacity) return null;
        let best = null, bestPrice = null;
        for (const name in state.buildings) {
            const b = state.buildings[name];
            if (!b.unlocked || b.visible === false) continue;
            const price = ProductionEngine.buildingPrice(state, name);
            if (!ResourcesManager.canAfford(price)) continue;
            let total = 0;
            for (const k in price) total += price[k] / Math.max(1e-9, state.resources[k].cap);
            if (!best || total < bestPrice) { best = name; bestPrice = total; }
        }
        if (!best) return null;
        /* 自动化只做「立即建成」，不会把买不起的东西塞进队列 */
        return QueueEngine.enqueue(state, 'building', best, 1, { queueIfUnaffordable: false });
    }

    function autoExpeditionStep(state) {
        if (!state.settings.autoExpedition) return null;
        if (!EffectsManager.hasSpecial(state, 'autoExpedition')) return null;
        if (state.expedition.active) return null;
        const last = state.expedition.history[0];
        const order = last ? last.region : null;
        const regions = EXPEDITIONS_CONFIG.slice().reverse();
        for (const r of regions) {
            if (!order || r.name !== order) continue;
            const check = ExpeditionEngine.canStart(state, r);
            if (check.ok) return startExpedition(state, r.name);
            return null;
        }
        return null;
    }

    function startExpedition(state, name) {
        const res = ExpeditionEngine.start(state, name);
        if (res.ok) ProductionEngine.computeProductionAndCaps(state);
        return res;
    }

    window.Actions = {
        buyBuilding, setBuildingActive, setBuildingMode,
        research, buyUpgrade, setPolicy, buyPermanent, permanentCost, permVisible,
        toggleChallenge, activeStars, relicGain, starGain, coreGain, resetAvailability,
        prestige, performReset, autoBuildStep, autoExpeditionStep, startExpedition,
    };
})();
