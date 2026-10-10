/* =========================================================
   贸易引擎
   集市提供「贸易规模」；每种资源可设为买入 / 卖出。
   价格随热度浮动：买得越多越贵，卖得越多越便宜，热度会缓慢回落。
   ========================================================= */
(function () {
    const SELL_RATIO = 0.8;
    const HEAT_MIN = 0.25, HEAT_MAX = 4;

    function volume(state) {
        const markets = state.buildings['集市'].active || 0;
        const mult = 1 + EffectsManager.additive(state, 'marketVolume');
        return markets * 25 * mult;
    }

    function price(state, res) {
        const cfg = RESOURCES_CONFIG[res];
        /* 魔力 / 魔法知识 / 政策点这类资源没有市场价（value 未定义），
           一律返回 0：否则会算出 NaN，把产量和存量污染成 NaN，看起来就是「归零且永远不动」。 */
        if (!cfg || !(cfg.value > 0)) return 0;
        const heat = state.market.heat[res] === undefined ? 1 : state.market.heat[res];
        return cfg.value * heat;
    }

    /* 这种资源能不能交易（有正的市场价） */
    function tradeable(res) {
        const cfg = RESOURCES_CONFIG[res];
        return !!(cfg && !cfg.prestige && cfg.value > 0);
    }

    /* 计算各资源的实际贸易流量（资源/日） */
    function rates(state) {
        const out = {};
        const vol = volume(state);
        state.market.volume = vol;
        if (vol <= 0) return out;
        const gold = state.resources['黄金'];

        for (const res in state.market.resources) {
            const m = state.market.resources[res];
            if (m.mode === 'off') continue;
            const p = price(state, res);
            if (p <= 0) continue;
            const share = Utils.clamp(m.level, 1, 10) / 10;
            let rate = vol * share / p;
            if (!isFinite(rate)) continue;

            if (m.mode === 'buy') {
                /* 黄金不足时按比例缩减 */
                const costPerDay = rate * p;
                if (costPerDay > 0) {
                    const available = gold.amount * 0.5 + Math.max(0, gold.production);
                    if (costPerDay > available) rate = Math.max(0, available / p);
                }
                if (gold.amount <= 1e-6) rate = 0;
                if (!isFinite(rate)) rate = 0;
                if (rate > 0) out[res] = (out[res] || 0) + rate;
            } else if (m.mode === 'sell') {
                const stock = state.resources[res].amount;
                if (!(stock > 1e-6)) continue;
                const allowed = stock / 2;
                if (rate > allowed) rate = allowed;
                if (rate > 0) out[res] = (out[res] || 0) - rate;
            }
        }
        return out;
    }

    /* 黄金净流量（不含建筑产出） */
    function goldFlow(state) {
        const r = rates(state);
        let flow = 0;
        for (const res in r) {
            const p = price(state, res);
            const rate = r[res];
            if (rate > 0) flow -= rate * p;              // 买入花金
            else flow += -rate * p * SELL_RATIO;         // 卖出得金
        }
        if (!isFinite(flow)) flow = 0;
        return flow;
    }

    function applyToProduction(state) {
        const r = rates(state);
        for (const res in r) {
            if (!state.resources[res]) continue;
            state.resources[res].production += r[res];
        }
        const gold = goldFlow(state);
        if (gold && state.resources['黄金']) state.resources['黄金'].production += gold;
        state.market.lastGoldFlow = gold;
        state.market.lastRates = r;
    }

    /* 热度演化（每 tick 调用） */
    function tick(state, dt) {
        if (dt <= 0) return;
        const vol = Math.max(1e-9, volume(state));
        const r = state.market.lastRates || rates(state);
        for (const res in state.market.resources) {
            const cfg = RESOURCES_CONFIG[res];
            if (!cfg) continue;
            let heat = state.market.heat[res];
            if (heat === undefined) heat = 1;
            const p = price(state, res);
            const flow = r[res] || 0;
            const pressure = (flow * p) / vol;   // 买入为正、卖出为负
            heat += (cfg.change || 0.1) * pressure * dt;
            heat += (1 - heat) * (cfg.decay || 0.01) * dt;
            state.market.heat[res] = Utils.clamp(heat, HEAT_MIN, HEAT_MAX);
        }
        state.market.volume = volume(state);
    }

    function setMode(state, res, mode) {
        if (!state.market.resources[res]) return;
        state.market.resources[res].mode = mode;
    }

    function setLevel(state, res, level) {
        if (!state.market.resources[res]) return;
        state.market.resources[res].level = Utils.clamp(Math.round(level), 1, 10);
    }

    /* 一次性买入 / 卖出（按当前贸易规模的一批） */
    function tradeOnce(state, res, dir) {
        const vol = volume(state);
        if (vol <= 0) return { ok: false, msg: '需要至少一座「集市」才能进行贸易。' };
        const p = price(state, res);
        if (!(p > 0)) return { ok: false, msg: '「' + res + '」没有市场价，不能交易。' };
        const amount = vol / p;
        if (!isFinite(amount) || amount <= 0) return { ok: false, msg: '「' + res + '」暂时无法交易。' };
        if (dir === 'buy') {
            const cost = amount * p;
            if (state.resources['黄金'].amount < cost) return { ok: false, msg: '黄金不足，无法买入 ' + res + '。' };
            state.resources['黄金'].amount -= cost;
            ResourcesManager.add({ [res]: amount });
            state.market.heat[res] = Utils.clamp(p / RESOURCES_CONFIG[res].value + (RESOURCES_CONFIG[res].change || 0.1) * 0.5, HEAT_MIN, HEAT_MAX);
            state.market.trades++;
            return { ok: true, msg: '买入 ' + Utils.fmtNum(amount) + ' ' + res + '，花费 ' + Utils.fmtNum(cost) + ' 黄金。' };
        }
        const stock = state.resources[res].amount;
        const sell = Math.min(stock, amount);
        if (sell <= 1e-9) return { ok: false, msg: '没有可出售的 ' + res + '。' };
        state.resources[res].amount -= sell;
        ResourcesManager.add({ 黄金: sell * p * SELL_RATIO });
        state.market.heat[res] = Utils.clamp(p / RESOURCES_CONFIG[res].value - (RESOURCES_CONFIG[res].change || 0.1) * 0.5, HEAT_MIN, HEAT_MAX);
        state.market.trades++;
        return { ok: true, msg: '卖出 ' + Utils.fmtNum(sell) + ' ' + res + '，获得 ' + Utils.fmtNum(sell * p * SELL_RATIO) + ' 黄金。' };
    }

    window.TradeEngine = {
        volume, price, tradeable, rates, goldFlow, applyToProduction, tick,
        setMode, setLevel, tradeOnce, SELL_RATIO,
    };
})();
