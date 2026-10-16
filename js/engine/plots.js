/* =========================================================
   领地（引擎）
   开拓一次永久保留；成本固定，受传承「领地工程」影响（最多 −60%）。
   ========================================================= */
(function () {
    function byId(id) {
        return PLOTS_CONFIG.find(p => p.id === id) || null;
    }

    function claimed(state) {
        return (state.plots && Array.isArray(state.plots.claimed)) ? state.plots.claimed : [];
    }

    function isClaimed(state, id) {
        return claimed(state).indexOf(id) >= 0;
    }

    /* 科技没研究完就不显示为「可开拓」 */
    function unlocked(state, id) {
        const cfg = byId(id);
        if (!cfg) return false;
        if (!cfg.tech) return true;
        const t = state.techs[cfg.tech];
        return !!(t && t.researched);
    }

    /* 当前开拓成本（领地工程最多打 4 折） */
    function cost(state, id) {
        const cfg = byId(id);
        if (!cfg) return {};
        const disc = Utils.clamp(EffectsManager.additive(state, 'plotCost'), -0.6, 0);
        const out = {};
        for (const r in cfg.cost) out[r] = Math.ceil(cfg.cost[r] * (1 + disc));
        return out;
    }

    function affordability(state, id) {
        const c = cost(state, id);
        return { cost: c, affordable: ResourcesManager.canAfford(c) };
    }

    function claim(state, id) {
        const cfg = byId(id);
        if (!cfg) return { ok: false, msg: '没有这块地。' };
        if (isClaimed(state, id)) return { ok: false, msg: '这块地已经开拓过了。' };
        if (!unlocked(state, id)) return { ok: false, msg: '需要先研究「' + cfg.tech + '」。' };
        const c = cost(state, id);
        if (!ResourcesManager.canAfford(c)) return { ok: false, msg: '资源不足。' };
        ResourcesManager.spend(c);
        state.plots.claimed.push(id);
        ProductionEngine.computeProductionAndCaps(state);
        EventEngine.addLog(state, '🏕️ 开拓领地「' + cfg.name + '」完成，它的加成永久生效。');
        return { ok: true, msg: '开拓完成：' + cfg.name };
    }

    /* 已开拓领地的配置（给效果汇总用） */
    function effects(state) {
        return claimed(state).map(byId).filter(Boolean);
    }

    function claimedCount(state) {
        return claimed(state).length;
    }

    window.Plots = { byId, claimed, isClaimed, unlocked, cost, affordability, claim, effects, claimedCount };
})();
