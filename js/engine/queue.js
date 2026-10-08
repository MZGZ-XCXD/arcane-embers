/* =========================================================
   建造队列
   规则（v1.2.0 起）：
     · 资源足够时，点击建造 / 研究 / 升级会「立即完成」，不进入队列；
     · 资源不足时，则作为「订单」进入队列等待资源，资源凑够后自动开工并倒计时；
     · 同一个目标可以反复排队（例如伐木场点两下 = 队列里两条订单）；
     · 队列槽位初始 5 个，可通过传承强化与工程类英雄提升；槽位之间并行施工。
   ========================================================= */
(function () {
    let seq = 1;

    const KIND_LABEL = { building: '建造', tech: '研究', upgrade: '升级' };

    /* 队列槽位数：基础 5 + 传承 / 英雄加成 */
    function slots(state) {
        const e = EffectsManager.get(state);
        return Math.max(1, Math.floor(5 + (e.queueSlots || 0)));
    }
    /* 施工速度加成 */
    function speed(state) {
        const e = EffectsManager.get(state);
        return Math.max(0.1, 1 + (e.queueSpeed || 0));
    }
    function items(state) { return state.queue.items; }
    function used(state) { return state.queue.items.length; }
    function isFull(state) { return used(state) >= slots(state); }

    /* 资源折算价值：有市场价按市场价，传承资源按 20，其它（魔力/知识/政策点）按 4 */
    function valueOf(map) {
        let v = 0;
        for (const k in map) {
            const cfg = RESOURCES_CONFIG[k];
            let unit = 4;
            if (cfg) unit = cfg.value || (cfg.prestige ? 20 : 4);
            v += (map[k] || 0) * unit;
        }
        return v;
    }

    function unitDays(kind, value) {
        if (kind === 'building') return 3 + 2.5 * Math.log(1 + value) + Math.min(0.0002 * value, 300);
        if (kind === 'tech') return 6 + 4 * Math.log(1 + value) + Math.min(0.0003 * value, 400);
        return 4 + 2.2 * Math.log(1 + value) + Math.min(0.0001 * value, 120);
    }

    /* 工期 = 每单位工期 × 数量（按平均成本估算），再除以施工速度 */
    function durationOf(state, kind, totalCost, count) {
        const avg = valueOf(totalCost) / Math.max(1, count);
        const days = unitDays(kind, avg) * Math.max(1, count);
        return Utils.clamp(days / speed(state), 1, 1200);
    }

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

    /* 现在下单这批目标需要多少资源（建筑按当前已建数量计算） */
    function currentCost(state, item) {
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

        const est = currentCost(state, { kind: kind, name: name, count: count }) || {};
        const item = {
            id: 'q' + (seq++),
            kind: kind, name: name, count: count,
            state: 'waiting',       // waiting = 等待资源；building = 施工中
            cost: null, est: est,
            start: 0, end: 0, dur: 0,
        };
        state.queue.items.push(item);
        EventEngine.addLog(state, '📝 ' + KIND_LABEL[kind] + '「' + name + '」×' + count +
            ' 已加入队列（等待资源：' + Object.keys(est).map(k => k + ' ' + Utils.fmtNum(est[k])).join('、') + '）。');
        ProductionEngine.updatePrices(state);
        ProductionEngine.computeProductionAndCaps(state);
        return { ok: true, queued: count, item: item, msg: '资源不足，已排队：' + name + ' ×' + count + '（资源够了会自动开工）' };
    }

    /* 取消：等待中的直接移除；施工中的全额退还已付材料 */
    function cancel(state, id) {
        const idx = state.queue.items.findIndex(it => it.id === id);
        if (idx < 0) return { ok: false };
        const item = state.queue.items[idx];
        if (item.state === 'building' && item.cost) {
            for (const k in item.cost) {
                const r = state.resources[k];
                if (!r) continue;
                r.amount = Math.min(r.cap, r.amount + item.cost[k]);
            }
        }
        state.queue.items.splice(idx, 1);
        EventEngine.addLog(state, '↩️ 已取消' + KIND_LABEL[item.kind] + '「' + item.name + '」' +
            (item.state === 'building' && item.cost ? '，材料已退回。' : '（尚未投入材料）。'));
        ProductionEngine.updatePrices(state);
        ProductionEngine.computeProductionAndCaps(state);
        return { ok: true, msg: '已取消：' + item.name };
    }

    function clear(state) { state.queue.items = []; }

    function progress(state, item) {
        if (!item || item.state !== 'building') return 0;
        return Utils.clamp((state.gameDays - item.start) / Math.max(1e-6, item.end - item.start), 0, 1);
    }
    function remaining(state, item) {
        if (!item || item.state !== 'building') return 0;
        return Math.max(0, item.end - state.gameDays);
    }

    /* 每 tick：等待中的订单按队列顺序开工，施工中的订单到点完成 */
    function tick(state) {
        if (!state.queue || !state.queue.items.length) return;
        const done = [];
        for (const it of state.queue.items) {
            if (it.state === 'waiting') {
                const invalid = validate(state, it.kind, it.name);
                if (invalid) {                       // 目标已失效（例如科技被研究完）→ 直接撤单
                    done.push(it);
                    EventEngine.addLog(state, '⚠️ 订单「' + it.name + '」已失效（' + invalid + '），自动撤单。');
                    continue;
                }
                const cost = currentCost(state, it);
                if (cost && ResourcesManager.canAfford(cost)) {
                    ResourcesManager.spend(cost);
                    it.cost = cost;
                    it.state = 'building';
                    it.dur = durationOf(state, it.kind, cost, it.count);
                    it.start = state.gameDays;
                    it.end = state.gameDays + it.dur;
                    EventEngine.addLog(state, '🔨 资源到位，「' + it.name + '」×' + it.count +
                        ' 开始施工（' + Utils.fmtDuration(it.dur) + '）。');
                }
            } else if (state.gameDays + 1e-9 >= it.end) {
                done.push(it);
            }
        }
        if (done.length) {
            const finished = done.filter(it => it.state === 'building');
            state.queue.items = state.queue.items.filter(it => done.indexOf(it) < 0);
            for (const it of finished) applyComplete(state, it);
        }
    }

    /* 队列中某目标的总数量（用于卡片角标） */
    function queuedCount(state, kind, name) {
        let n = 0;
        for (const it of state.queue.items) {
            if (it.kind === kind && it.name === name) n += it.count;
        }
        return n;
    }
    /* 队列中某目标的订单状态：'building' | 'waiting' | null */
    function queuedState(state, kind, name) {
        const list = state.queue.items.filter(it => it.kind === kind && it.name === name);
        if (!list.length) return null;
        if (list.some(it => it.state === 'building')) return 'building';
        return 'waiting';
    }

    window.QueueEngine = {
        slots, speed, items, used, isFull, enqueue, cancel, clear,
        progress, remaining, tick, queuedCount, queuedState, durationOf, currentCost, maxAffordable, valueOf,
        KIND_LABEL,
    };
})();
