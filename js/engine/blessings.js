/* =========================================================
   轮回祝福（引擎）
   流程：重置完成 → beginRun() 清掉上一轮的祝福并抽出 3 个候选
        → 玩家在浮窗里选 1 个 → take() 生效到本轮结束。
   ========================================================= */
(function () {
    const OFFER_COUNT = 3;

    function byId(id) {
        return BLESSINGS_CONFIG.find(b => b.id === id) || null;
    }

    /* 本轮已经拿到的祝福（配置对象数组） */
    function current(state) {
        if (!state.run || !Array.isArray(state.run.blessings)) return [];
        return state.run.blessings.map(byId).filter(Boolean);
    }

    /* 抽 n 个不重复的候选，返回 id 数组 */
    function roll(state, n) {
        const pool = BLESSINGS_CONFIG.slice();
        const out = [];
        const want = Math.min(n || OFFER_COUNT, pool.length);
        for (let i = 0; i < want; i++) {
            out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
        }
        return out;
    }

    /* 新一轮开始：祝福清空，候选备好（等玩家在浮窗里选） */
    function beginRun(state) {
        state.run = state.run || {};
        state.run.blessings = [];
        state.run.offers = roll(state, OFFER_COUNT);
        return state.run.offers;
    }

    /* 玩家选定一个：本轮生效，候选清空 */
    function take(state, id) {
        if (!state.run || !Array.isArray(state.run.offers) || state.run.offers.indexOf(id) < 0) {
            return { ok: false, msg: '这个祝福已经不在候选里了。' };
        }
        const cfg = byId(id);
        if (!cfg) return { ok: false, msg: '找不到这个祝福。' };
        state.run.offers = [];
        state.run.blessings = [id];
        ProductionEngine.computeProductionAndCaps(state);
        return { ok: true, blessing: cfg, msg: '获得轮回祝福「' + cfg.name + '」' };
    }

    /* 放弃本次祝福（候选清空，本轮就没有祝福了） */
    function skip(state) {
        if (!state.run) return { ok: true };
        state.run.offers = [];
        ProductionEngine.computeProductionAndCaps(state);
        return { ok: true, msg: '这一轮不选祝福。' };
    }

    function hasOffer(state) {
        return !!(state.run && Array.isArray(state.run.offers) && state.run.offers.length);
    }

    window.Blessings = { OFFER_COUNT, byId, current, roll, beginRun, take, skip, hasOffer };
})();
