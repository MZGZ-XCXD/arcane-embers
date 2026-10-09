/* =========================================================
   建造队列（v1.3.0 起：队列 = 「等材料的订单列表」）
   规则：
     · 资源足够时，点击建造 / 研究 / 升级会「立即完成」，完全不进队列；
     · 资源不足时，才作为「订单」进入队列；面板上的倒计时显示的是
       「按当前净产量，还要多久才凑齐这些材料」，材料一凑齐的瞬间就立即建成并出队
       （没有第二段施工等待）；
     · 同一个目标可以反复排队（例如伐木场点两下 = 队列里两条订单）；
     · 队列槽位初始 5 个，可通过传承强化与工程类英雄提升；槽位之间互不影响。
   传承 / 英雄的「队列材料折扣」会直接降低订单要凑的材料量（最多减免 60%）。
   ========================================================= */
(function () {
    let seq = 1;

    const KIND_LABEL = { building: '建造', tech: '研究', upgrade: '升级' };
    const DISCOUNT_CAP = 0.6;      // 订单材料最多减免 60 %

    /* 队列槽位数：基础 5 + 传承 / 英雄加成 */
    function slots(state) {
        const e = EffectsManager.get(state);
        return Math.max(1, Math.floor(5 + (e.queueSlots || 0)));
    }
    /* 订单材料折扣 0 ~ DISCOUNT_CAP */
    function discount(state) {
        const e = EffectsManager.get(state);
        return Utils.clamp(e.queueDiscount || 0, 0, DISCOUNT_CAP);
    }
    function applyDiscount(cost, d) {
        if (!cost || d <= 1e-9) return cost;
        const out = {};
        for (const k in cost) out[k] = Math.max(1, Math.ceil(cost[k] * (1 - d)));
        return out;
    }
    function items(state) { return state.queue.items; }
    function used(state) { return state.queue.items.length; }
    function isFull(state) { return used(state) >= slots(state); }

    /* 目标当前是否还能下单 / 开工 */
    function validate(state, kind, name) {
        if (kind === 'building') {
            const b = state.buildings[name];
            if (!b || !b.unlocked) return '尚未解锁。';
            return null;
        }
        if (kind === 'tech') {
            const t = state.techs[name];
            if (!t || !TECHS_CONFIG[name]) return '未知科技。';
            if (t.researched) return '该科技已完成。';
            if (!ProductionEngine.techAvailable(state, name)) return '前置科技尚未完成。';
            return null;
        }
        if (kind === 'upgrade') {
            const u = state.upgrades[name];
            const cfg = UPGRADES_CONFIG[name];
            if (!u || !cfg || !u.visible) return '尚未解锁。';
            if (u.level >= cfg.cap) return '已达到等级上限。';
            return null;
        }
        return '未知的队列类型。';
    }

    /* 这批目标「原价」需要多少资源（建筑按当前已建数量逐座累加） */
    function baseCost(state, item) {
        if (item.kind === 'building') {
            const b = state.buildings[item.name];
            if (!b) return null;
            const total = {};
            for (let i = 0; i < item.count; i++) {
                const price = ProductionEngine.buildingPriceCount(state, item.name, b.count + i);
                for (const k in price) total[k] = (total[k] || 0) + price[k];
            }
            return total;
        }
        if (item.kind === 'tech') {
            const cfg = TECHS_CONFIG[item.name];
            return cfg ? Object.assign({}, cfg.cost) : null;
        }
        const u = state.upgrades[item.name];
        const cfg = UPGRADES_CONFIG[item.name];
        if (!u || !cfg) return null;
        const price = {};
        for (let i = 0; i < item.count; i++) {
            const p = ProductionEngine.upgradePriceCount(state, item.name, u.level + i);
            for (const k in p) price[k] = (price[k] || 0) + p[k];
        }
        return price;
    }

    /* 订单实际需要凑齐的材料（已应用「队列材料折扣」） */
    function currentCost(state, item) {
        return applyDiscount(baseCost(state, item), discount(state));
    }

    /* 一次能立即买得起的数量（用于「最大」与批量按钮） */
    function maxAffordable(state, name, limit) {
        const b = state.buildings[name];
        if (!b) return 0;
        const paid = {};
        let can = 0;
        for (let i = 0; i < (limit || 25); i++) {
            const price = ProductionEngine.buildingPriceCount(state, name, b.count + i);
            let ok = true;
            for (const k in price) {
                const have = (state.resources[k] ? state.resources[k].amount : 0) - (paid[k] || 0);
                if (have + 1e-9 < price[k]) { ok = false; break; }
            }
            if (!ok) break;
            for (const k in price) paid[k] = (paid[k] || 0) + price[k];
            can++;
        }
        return can;
    }

    /* 完成结算（立即完成与队列完成共用） */
    function applyComplete(state, item) {
        if (item.kind === 'building') {
            const b = state.buildings[item.name];
            if (b) {
                b.count += item.count;
                b.active += item.count;
                state.stats.totalBuildingBuilt += item.count;
            }
            EventEngine.addLog(state, '🏗️ 建成「' + item.name + '」×' + item.count + '。');
        } else if (item.kind === 'tech') {
            const t = state.techs[item.name];
            const cfg = TECHS_CONFIG[item.name];
            if (t) t.researched = true;
            EventEngine.addLog(state, '📖 完成研究「' + item.name + '」：' + (cfg ? cfg.desc : ''));
        } else {
            const u = state.upgrades[item.name];
            if (u) u.level++;
            EventEngine.addLog(state, '⚗️ 升级完成「' + item.name + '」→ 等级 ' + (u ? u.level : 1) + '。');
        }
        if (window.UI && UI.toast) {
            UI.toast((item.kind === 'tech' ? '📖 研究完成：' : (item.kind === 'upgrade' ? '⚗️ 升级完成：' : '🏗️ 建造完成：')) +
                item.name + (item.count > 1 ? ' ×' + item.count : ''), 'gold');
        }
        ProductionEngine.updatePrices(state);
        ProductionEngine.computeProductionAndCaps(state);
        if (item.kind === 'tech' && window.AchievementEngine) AchievementEngine.check(state);
    }

    /* ------------ 立即完成：能买多少做多少 ------------ */
    function instant(state, kind, name, count) {
        let done = 0;
        if (kind === 'building') {
            const b = state.buildings[name];
            if (!b) return 0;
            for (let i = 0; i < count; i++) {
                const price = ProductionEngine.buildingPriceCount(state, name, b.count + i);
                if (!ResourcesManager.canAfford(price)) break;
                ResourcesManager.spend(price);
                done++;
            }
            if (done) applyComplete(state, { kind: 'building', name: name, count: done });
            return done;
        }
        if (kind === 'tech') {
            const cfg = TECHS_CONFIG[name];
            if (!cfg || !ResourcesManager.canAfford(cfg.cost)) return 0;
            ResourcesManager.spend(cfg.cost);
            applyComplete(state, { kind: 'tech', name: name, count: 1 });
            return 1;
        }
        const u = state.upgrades[name];
        const cfg = UPGRADES_CONFIG[name];
        if (!u || !cfg) return 0;
        for (let i = 0; i < count && u.level < cfg.cap; i++) {
            const price = ProductionEngine.upgradePrice(state, name);
            if (!ResourcesManager.canAfford(price)) break;
            ResourcesManager.spend(price);
            applyComplete(state, { kind: 'upgrade', name: name, count: 1 });
            done++;
        }
        return done;
    }

    /* ------------ 队列订单 ------------ */
    function enqueue(state, kind, name, amount, opts) {
        opts = opts || {};
        const queueIfUnaffordable = opts.queueIfUnaffordable !== false;

        let count;
        if (amount === 'max') {
            count = kind === 'building' ? Math.max(1, maxAffordable(state, name, 25)) : 1;
            if (kind === 'building' && maxAffordable(state, name, 25) === 0) count = 1;   // 一件都买不起时排 1 件等待
        } else {
            count = Math.max(1, Math.min(25, Math.floor(amount || 1)));
        }

        const invalid = validate(state, kind, name);
        if (invalid) return { ok: false, msg: invalid };

        /* 1) 资源足够 → 立即完成，不进队列 */
        const doneNow = instant(state, kind, name, count);
        if (doneNow > 0) {
            const label = kind === 'tech' ? '研究完成：' : (kind === 'upgrade' ? '升级完成：' : '建造完成：');
            return { ok: true, instant: doneNow, msg: label + name + (doneNow > 1 ? ' ×' + doneNow : '') };
        }

        if (!queueIfUnaffordable) return { ok: false, msg: '资源不足。' };

        /* 2) 资源不足 → 进入队列等待资源 */
        if (kind === 'tech' && state.queue.items.some(it => it.kind === 'tech' && it.name === name)) {
            return { ok: false, msg: '「' + name + '」已在研究队列中。' };
        }
        if (isFull(state)) return { ok: false, msg: '队列已满（' + used(state) + ' / ' + slots(state) + '），请等待或取消一项。' };

        const item = {
            id: 'q' + (seq++),
            kind: kind, name: name, count: count,
            cost: null,                 // 成交（扣款）时的实际材料，用于撤销时退还
            est: {},                    // 当前需要凑齐的材料（含折扣，每帧重算）
        };
        item.est = currentCost(state, item) || {};
        state.queue.items.push(item);
        EventEngine.addLog(state, '📝 ' + KIND_LABEL[kind] + '「' + name + '」×' + count +
            ' 已加入队列（等待材料：' + Object.keys(item.est).map(k => k + ' ' + Utils.fmtNum(item.est[k])).join('、') + '）。');
        ProductionEngine.updatePrices(state);
        ProductionEngine.computeProductionAndCaps(state);
        return { ok: true, queued: count, item: item, msg: '材料不足，已排队：' + name + ' ×' + count + '（材料凑齐会自动建成）' };
    }

    /* 取消订单：还没扣过款，直接移除即可 */
    function cancel(state, id) {
        const idx = state.queue.items.findIndex(it => it.id === id);
        if (idx < 0) return { ok: false };
        const item = state.queue.items[idx];
        state.queue.items.splice(idx, 1);
        EventEngine.addLog(state, '↩️ 已取消' + KIND_LABEL[item.kind] + '「' + item.name + '」（尚未投入材料）。');
        ProductionEngine.updatePrices(state);
        ProductionEngine.computeProductionAndCaps(state);
        return { ok: true, msg: '已取消：' + item.name };
    }

    function clear(state) { state.queue.items = []; }

    /* 材料就绪度 0~1（面板进度条用） */
    function progress(state, item) {
        const cost = currentCost(state, item);
        if (!cost) return 0;
        let min = 1;
        for (const k in cost) {
            const r = state.resources[k];
            if (!r || cost[k] <= 0) continue;
            min = Math.min(min, Utils.clamp(r.amount / cost[k], 0, 1));
        }
        return min;
    }

    /* 某订单被「存量上限」卡住的资源名（没有则返回 null） */
    function capBlocked(state, item) {
        const cost = currentCost(state, item);
        if (!cost) return null;
        for (const k in cost) {
            const r = state.resources[k];
            if (!r || RESOURCES_CONFIG[k].prestige) continue;
            if (cost[k] > r.cap + 1e-6) return k;
        }
        return null;
    }

    /* 按当前净产量估算「还要多久才凑齐材料」（游戏日）；无法估算返回 null */
    function eta(state, item) {
        const cost = currentCost(state, item);
        if (!cost) return null;
        let worst = 0;
        for (const k in cost) {
            const r = state.resources[k];
            if (!r) return null;
            if (!RESOURCES_CONFIG[k].prestige && cost[k] > r.cap + 1e-6) return null;   // 上限不够，永远凑不齐
            const lack = cost[k] - r.amount;
            if (lack <= 1e-9) continue;
            const rate = r.production || 0;
            if (rate <= 1e-9) return null;                                              // 没有净产出，无法估算
            worst = Math.max(worst, lack / rate);
        }
        return worst;
    }
    /* 兼容旧调用：剩余等待时间 */
    function remaining(state, item) { return eta(state, item); }

    /* 每 tick：按队列顺序检查，材料凑齐的订单立即建成并出队 */
    function tick(state) {
        if (!state.queue || !state.queue.items.length) return;
        const done = [];
        for (const it of state.queue.items) {
            const invalid = validate(state, it.kind, it.name);
            if (invalid) {                       // 目标已失效（例如科技已被研究完）→ 直接撤单
                done.push(it);
                EventEngine.addLog(state, '⚠️ 订单「' + it.name + '」已失效（' + invalid + '），自动撤单。');
                continue;
            }
            const cost = currentCost(state, it);
            if (!cost) { done.push(it); continue; }
            it.est = cost;
            if (ResourcesManager.canAfford(cost)) {
                ResourcesManager.spend(cost);
                it.cost = cost;
                done.push(it);
                applyComplete(state, it);        // 材料一到手就立刻建成，不再等待第二段工期
            }
        }
        if (done.length) state.queue.items = state.queue.items.filter(it => done.indexOf(it) < 0);
    }

    /* 队列中某目标的总数量（用于卡片角标） */
    function queuedCount(state, kind, name) {
        let n = 0;
        for (const it of state.queue.items) {
            if (it.kind === kind && it.name === name) n += it.count;
        }
        return n;
    }
    /* 队列中某目标的订单状态：'waiting' | null */
    function queuedState(state, kind, name) {
        const list = state.queue.items.filter(it => it.kind === kind && it.name === name);
        if (!list.length) return null;
        return 'waiting';
    }

    window.QueueEngine = {
        slots, discount, items, used, isFull, enqueue, cancel, clear,
        progress, eta, remaining, capBlocked, tick, queuedCount, queuedState,
        currentCost, baseCost, maxAffordable,
        KIND_LABEL, DISCOUNT_CAP,
    };
})();
