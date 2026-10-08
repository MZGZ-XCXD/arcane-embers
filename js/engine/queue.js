/* =========================================================
   建造队列
   建造 / 研究 / 升级 都改为「先排队、再倒计时完成」。
   队列槽位初始 5 个，可通过传承强化与英雄提升；槽位之间并行施工。
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

    /* 计算批量建造某些建筑的总价（价格随已建数量增长） */
    function batchPrice(state, name, count) {
        const total = {};
        const b = state.buildings[name];
        const cfg = BUILDINGS_CONFIG[name];
        if (!b || !cfg) return total;
        const costMult = ProductionEngine.costMultiplier(state);
        for (let i = 0; i < count; i++) {
            const price = ProductionEngine.buildingPriceCount(state, name, b.count + i);
            for (const k in price) total[k] = (total[k] || 0) + price[k];
        }
        return total;
    }

    /* 入口：把一次建造 / 研究 / 升级放进队列 */
    function enqueue(state, kind, name, count) {
        if (count === 'max') count = 10;           // 「最大」最多一次排 10 座，避免排到天荒地老
        count = Math.max(1, Math.min(25, Math.floor(count || 1)));
        if (state.queue.items.some(it => it.kind === kind && it.name === name)) {
            return { ok: false, msg: (kind === 'tech' ? '「' + name + '」已在研究队列中。' : '「' + name + '」已在队列中。') };
        }
        if (isFull(state)) return { ok: false, msg: '队列已满（' + used(state) + ' / ' + slots(state) + '），请等待或取消一项。' };

        let cost = {};
        if (kind === 'building') {
            const b = state.buildings[name];
            const cfg = BUILDINGS_CONFIG[name];
            if (!b || !b.unlocked) return { ok: false, msg: '尚未解锁。' };
            /* 逐座累加，直到买不起为止；只在实际扣除时结算 */
            const paid = {};
            let can = 0;
            for (let i = 0; i < count; i++) {
                const price = ProductionEngine.buildingPriceCount(state, name, b.count + i);
                let affordable = true;
                for (const k in price) {
                    const have = (state.resources[k] ? state.resources[k].amount : 0) - (paid[k] || 0);
                    if (have + 1e-9 < price[k]) { affordable = false; break; }
                }
                if (!affordable) break;
                for (const k in price) paid[k] = (paid[k] || 0) + price[k];
                can++;
            }
            if (!can) return { ok: false, msg: '资源不足。' };
            ResourcesManager.spend(paid);
            cost = paid;
            count = can;
        } else if (kind === 'tech') {
            const t = state.techs[name];
            const cfg = TECHS_CONFIG[name];
            if (!t || !cfg || t.researched) return { ok: false, msg: '该科技已完成。' };
            if (!ProductionEngine.techAvailable(state, name)) return { ok: false, msg: '前置科技尚未完成。' };
            if (!ResourcesManager.canAfford(cfg.cost)) return { ok: false, msg: '研究所需资源不足。' };
            ResourcesManager.spend(cfg.cost);
            cost = cfg.cost;
            count = 1;
        } else if (kind === 'upgrade') {
            const u = state.upgrades[name];
            const cfg = UPGRADES_CONFIG[name];
            if (!u || !cfg || !u.visible) return { ok: false, msg: '尚未解锁。' };
            if (u.level >= cfg.cap) return { ok: false, msg: '已达到等级上限。' };
            const price = ProductionEngine.upgradePrice(state, name);
            if (!ResourcesManager.canAfford(price)) return { ok: false, msg: '资源不足。' };
            ResourcesManager.spend(price);
            cost = price;
            count = 1;
        } else {
            return { ok: false, msg: '未知的队列类型。' };
        }

        const dur = durationOf(state, kind, cost, count);
        const item = {
            id: 'q' + (seq++),
            kind: kind,
            name: name,
            count: count,
            cost: cost,
            start: state.gameDays,
            end: state.gameDays + dur,
            dur: dur,
        };
        state.queue.items.push(item);
        EventEngine.addLog(state, '🛠️ ' + KIND_LABEL[kind] + '「' + name + '」×' + count +
            ' 已加入队列，预计 ' + Utils.fmtDuration(dur) + '。');
        ProductionEngine.updatePrices(state);
        ProductionEngine.computeProductionAndCaps(state);
        return { ok: true, item: item, msg: '已加入队列：' + name + '（' + Utils.fmtDuration(dur) + '）' };
    }

    /* 取消并全额退还 */
    function cancel(state, id) {
        const idx = state.queue.items.findIndex(it => it.id === id);
        if (idx < 0) return { ok: false };
        const item = state.queue.items[idx];
        for (const k in item.cost) {
            const r = state.resources[k];
            if (!r) continue;
            r.amount = Math.min(r.cap, r.amount + item.cost[k]);
        }
        state.queue.items.splice(idx, 1);
        EventEngine.addLog(state, '↩️ 已取消' + KIND_LABEL[item.kind] + '「' + item.name + '」，材料已退回。');
        ProductionEngine.updatePrices(state);
        ProductionEngine.computeProductionAndCaps(state);
        return { ok: true, msg: '已取消：' + item.name };
    }

    function clear(state) {
        state.queue.items = [];
    }

    function progress(state, item) {
        return Utils.clamp((state.gameDays - item.start) / Math.max(1e-6, item.end - item.start), 0, 1);
    }
    function remaining(state, item) {
        return Math.max(0, item.end - state.gameDays);
    }

    /* 完成结算 */
    function complete(state, item) {
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
        } else if (item.kind === 'upgrade') {
            const u = state.upgrades[item.name];
            if (u) u.level++;
            EventEngine.addLog(state, '⚗️ 升级完成「' + item.name + '」→ 等级 ' + (u ? u.level : 1) + '。');
        }
        if (window.UI && UI.toast) {
            UI.toast((item.kind === 'tech' ? '📖 研究完成：' : (item.kind === 'upgrade' ? '⚗️ 升级完成：' : '🏗️ 建造完成：')) + item.name +
                (item.count > 1 ? ' ×' + item.count : ''), 'gold');
        }
        ProductionEngine.updatePrices(state);
        ProductionEngine.computeProductionAndCaps(state);
        if (item.kind === 'tech' && window.AchievementEngine) AchievementEngine.check(state);
    }

    /* 每 tick 推进 */
    function tick(state) {
        if (!state.queue || !state.queue.items.length) return;
        const done = [];
        state.queue.items = state.queue.items.filter(it => {
            if (state.gameDays + 1e-9 >= it.end) { done.push(it); return false; }
            return true;
        });
        for (const it of done) complete(state, it);
    }

    /* 队列中某目标的总数量（用于卡片角标） */
    function queuedCount(state, kind, name) {
        let n = 0;
        for (const it of state.queue.items) {
            if (it.kind === kind && it.name === name) n += it.count;
        }
        return n;
    }

    window.QueueEngine = {
        slots, speed, items, used, isFull, enqueue, cancel, clear,
        progress, remaining, tick, queuedCount, durationOf, batchPrice, valueOf,
        KIND_LABEL,
    };
})();
