/* =========================================================
   生产计算核心
   1. 汇总所有加成
   2. 迭代求解每座建筑的「效率」（受原料短缺与人口短缺限制）
   3. 写入资源产量 / 上限、人口与军力、民望
   ========================================================= */
(function () {
    const ITERATIONS = 3;
    const DT = 0.25;

    function resolve(v, state) { return typeof v === 'function' ? v(state) : (v || {}); }

    /* 取建筑当前模式（未设置模式时就是自身） */
    function activeConfig(cfg, building) {
        if (!cfg.modes || !cfg.modes.length) return cfg;
        const m = cfg.modes[building.mode || 0] || cfg.modes[0];
        const merged = Object.assign({}, cfg, m);
        merged.modeName = m.name;
        return merged;
    }

    function stdCost(baseCost, growth, count, costMult) {
        const g = 1 + (growth - 1) * Math.max(0.05, costMult);
        const price = {};
        for (const r in baseCost) price[r] = Math.floor(baseCost[r] * Math.pow(g, count));
        return price;
    }

    function costMultiplier(state) {
        const e = EffectsManager.get(state);
        return 1 + (e.globalCost || 0);
    }

    function buildingPrice(state, name) {
        const cfg = BUILDINGS_CONFIG[name];
        const b = state.buildings[name];
        return stdCost(cfg.cost, cfg.growth, b.count, costMultiplier(state));
    }

    /* 指定「已建数量」时的价格（队列里批量建造需要预扣多座的成本） */
    function buildingPriceCount(state, name, count) {
        const cfg = BUILDINGS_CONFIG[name];
        if (!cfg) return {};
        return stdCost(cfg.cost, cfg.growth, count, costMultiplier(state));
    }

    function upgradePrice(state, name) {
        const cfg = UPGRADES_CONFIG[name];
        const u = state.upgrades[name];
        return stdCost(cfg.cost, cfg.growth, u.level, costMultiplier(state));
    }

    /* 指定等级时的升级价格（队列里批量升级需要预扣多级成本） */
    function upgradePriceCount(state, name, level) {
        const cfg = UPGRADES_CONFIG[name];
        if (!cfg) return {};
        return stdCost(cfg.cost, cfg.growth, level, costMultiplier(state));
    }

    /* 民望软上限：极高的民望收益递减，避免无限叠乘 */
    function happinessSoftCap(state, happiness) {
        const relic = ResourcesManager.amount('奥术遗物');
        const soft = 400 + Math.sqrt(relic) * 20;
        if (happiness <= soft) return happiness;
        return soft - 100 + 200 * Math.sqrt(0.25 + 0.005 * (happiness - soft));
    }

    /* 民望产出乘数：每 100 点民望 = ×1 建筑产出。
       这里用的是「上一次结算出来的民望」——因为民望本身要看人口与食物状况，
       而人口与食物又由产量决定，直接用当帧的值会绕成一个圈。
       上下限只是防呆（下限防止民望归零时彻底停产，上限防止异常数值把经济打爆）；
       真正约束后期数值的是民望的软上限与仓库上限，不是这里。 */
    function happinessMult(state) {
        const f = state.happinessFactor === undefined ? 1 : state.happinessFactor;
        return Utils.clamp(f, 0.1, 50);
    }

    function computeProductionAndCaps(state) {
        const e = EffectsManager.refreshAllEffects(state);
        const perfectPop = !!e.specials.perfectEfficiency;
        const happyMult = happinessMult(state);

        /* ---------- 1. 收集建筑理论数据 ---------- */
        const raw = {};
        for (const name in state.buildings) {
            const b = state.buildings[name];
            if (!b.active) continue;
            const baseCfg = BUILDINGS_CONFIG[name];
            if (!baseCfg) continue;
            const cfg = activeConfig(baseCfg, b);
            const mult = EffectsManager.buildingMultipliers(state, name);

            const prod = {};
            const baseProd = resolve(cfg.produces, state);
            for (const r in baseProd) {
                prod[r] = baseProd[r] * mult.prod * EffectsManager.resourceMultiplier(state, r) * happyMult;
            }
            const cons = {};
            const baseCons = resolve(cfg.consumes, state);
            for (const r in baseCons) cons[r] = baseCons[r] * mult.cons;
            const caps = {};
            const baseCaps = resolve(cfg.caps, state);
            for (const r in baseCaps) caps[r] = baseCaps[r] * mult.cap;

            const requiresLocal = {};
            if (baseCfg.pop) requiresLocal.population = baseCfg.pop;

            raw[name] = {
                active: b.active,
                prod: prod,
                cons: cons,
                caps: caps,
                providesLocal: resolve(cfg.providesLocal, state),
                requiresLocal: requiresLocal,
                happiness: (typeof cfg.happiness === 'function' ? cfg.happiness(state) : (cfg.happiness || 0)),
                cfg: cfg,
            };
        }

        /* ---------- 2. 迭代求解效率 ---------- */
        for (const name in raw) {
            const b = state.buildings[name];
            if (typeof b.efficiency !== 'number' || isNaN(b.efficiency)) b.efficiency = 1;
        }

        for (let iter = 0; iter < ITERATIONS; iter++) {
            const totalProd = {}, totalCons = {}, localCap = {}, localUsed = {};
            for (const name in raw) {
                const r = raw[name];
                const ea = state.buildings[name].efficiency * r.active;
                for (const k in r.prod) totalProd[k] = (totalProd[k] || 0) + r.prod[k] * ea;
                for (const k in r.cons) totalCons[k] = (totalCons[k] || 0) + r.cons[k] * ea;
                for (const k in r.providesLocal) localCap[k] = (localCap[k] || 0) + r.providesLocal[k] * ea;
                for (const k in r.requiresLocal) localUsed[k] = (localUsed[k] || 0) + r.requiresLocal[k] * ea;
            }

            const Rg = {};
            for (const res in totalCons) {
                const cons = totalCons[res] || 0;
                if (cons < 1e-9) { Rg[res] = 1; continue; }
                const stock = state.resources[res] ? state.resources[res].amount : 0;
                const prod = totalProd[res] || 0;
                Rg[res] = Utils.clamp((stock + prod * DT) / (cons * DT), 0, 1.2);
            }

            const Rl = {};
            for (const lr in LOCAL_RESOURCES_CONFIG) {
                const cap = localCap[lr] || 0, used = localUsed[lr] || 0;
                if (perfectPop) Rl[lr] = 1.2;
                else Rl[lr] = used < 1e-9 ? 1 : Utils.clamp(cap / used, 0, 1.2);
            }

            for (const name in raw) {
                const r = raw[name];
                let minR = 1.5;
                for (const k in r.cons) {
                    const v = Rg[k] === undefined ? 1 : Rg[k];
                    if (v < minR) minR = v;
                }
                for (const k in r.requiresLocal) {
                    const v = Rl[k] === undefined ? 1 : Rl[k];
                    if (v < minR) minR = v;
                }
                const b = state.buildings[name];
                if (b.efficiency < 1e-5 && minR > 1e-5) b.efficiency = Math.min(1, (1e-5 + b.efficiency) * minR);
                b.efficiency = Math.min(1, b.efficiency * minR);
            }
        }

        /* ---------- 3. 写入产量 / 上限 / 局部资源 ---------- */
        for (const k in state.resources) {
            state.resources[k].production = 0;
            state.resources[k].cap = state.resources[k].baseCap;
        }
        for (const lr in state.localResources) {
            state.localResources[lr].capacity = 0;
            state.localResources[lr].used = 0;
        }

        const relic = ResourcesManager.amount('奥术遗物');
        const capBoost = (1 + (e.capAll || 0)) * (1 + relic * (e.capPerRelic || 0));
        const knowledgeCapBoost = capBoost *
            (1 + Math.log(1 + relic) * (e.knowledgeCapPerRelic || 0)) *
            (e.knowledgeCapMult || 1);

        for (const name in raw) {
            const r = raw[name];
            const b = state.buildings[name];
            const effActive = b.efficiency * r.active;

            for (const k in r.prod) state.resources[k].production += r.prod[k] * effActive;
            for (const k in r.cons) state.resources[k].production -= r.cons[k] * effActive;
            for (const k in r.caps) {
                const mult = (k === '魔法知识') ? knowledgeCapBoost : capBoost;
                state.resources[k].cap += r.caps[k] * r.active * mult;
            }
            for (const lr in r.providesLocal) {
                const v = r.providesLocal[lr] * effActive;
                let mult = 1;
                if (lr === 'population') mult = 1 + (e.populationCap || 0);
                else if (lr === 'power') mult = 1 + (e.powerMult || 0);
                state.localResources[lr].capacity += v * mult;
            }
            for (const lr in r.requiresLocal) {
                state.localResources[lr].used += r.requiresLocal[lr] * effActive;
            }
        }

        /* 市场贸易流 */
        if (window.TradeEngine) TradeEngine.applyToProduction(state);

        for (const name in state.buildings) {
            if (!raw[name]) {
                const cfg = BUILDINGS_CONFIG[name];
                if (!state.buildings[name].active) state.buildings[name].efficiency = 1;
                else state.buildings[name].efficiency = 0;
            }
        }

        /* 资源只能为负到 0，产量展示用净值 */
        for (const k in state.resources) {
            const r = state.resources[k];
            if (!RESOURCES_CONFIG[k].prestige && r.amount > r.cap) r.amount = r.cap;
        }

        /* ---------- 4. 民望 ---------- */
        e.happinessList = [];
        let happy = 100;
        for (const name in raw) {
            const r = raw[name];
            if (r.happiness) {
                e.happinessList.push({ source: name + ' ×' + Math.round(r.active * state.buildings[name].efficiency), value: r.happiness * r.active });
                happy += r.happiness * r.active;
            }
        }
        if (e.happiness) { e.happinessList.push({ source: '加成 / 传承 / 成就', value: e.happiness }); happy += e.happiness; }
        if (relic * (e.happinessPerRelic || 0)) {
            const v = relic * e.happinessPerRelic;
            e.happinessList.push({ source: '遗物共鸣', value: v });
            happy += v;
        }

        /* 食物短缺：存量见底且净产量为负 */
        const food = state.resources['食物'];
        if (food.amount < food.cap * 0.02 && food.production < -1e-6) {
            e.happinessList.push({ source: '饥饿', value: -45 });
            happy -= 45;
            state.happinessStarving = true;
        } else {
            state.happinessStarving = false;
        }

        /* 人口不足的社会压力 */
        const pop = state.localResources.population;
        if (!perfectPop && pop.used > pop.capacity + 1e-6) {
            const pressure = Math.min(40, 40 * (pop.used - pop.capacity) / Math.max(1, pop.capacity));
            e.happinessList.push({ source: '人手不足', value: -pressure });
            happy -= pressure;
        }

        state.happinessRaw = happy;
        state.happiness = Math.max(0, happinessSoftCap(state, Math.max(0, happy)));
        state.happinessFactor = state.happiness / 100;

        /* 人口 = 当前容量（住房提供），军力 = 提供值 */
        state.localResources.population.amount = state.localResources.population.capacity;
        state.localResources.power.amount = state.localResources.power.capacity;

        /* ---------- 5. 全局速度 ---------- */
        state.speed = Math.max(0.1, 1 + (e.speed || 0));

        /* ---------- 6. 可见性 ---------- */
        refreshVisibility(state);

        /* ---------- 7. 价格（可见性变化后必须同步刷新，否则新解锁项会显示为空价格） ---------- */
        updatePrices(state);

        return e;
    }

    /* 已解锁 = 前置科技全部研究完毕；可见 = 前置科技不足一项未研究 或 已解锁 */
    function techAvailable(state, name) {
        const cfg = TECHS_CONFIG[name];
        if (!cfg) return false;
        const t = state.techs[name];
        if (t.researched) return true;
        for (const p of cfg.prereq) {
            const pt = state.techs[p];
            if (!pt || !pt.researched) return false;
        }
        return true;
    }

    function techVisible(state, name) {
        const t = state.techs[name];
        if (t.researched) return true;
        const cfg = TECHS_CONFIG[name];
        const missing = cfg.prereq.filter(p => !(state.techs[p] && state.techs[p].researched));
        if (missing.length === 0) return true;
        /* 只提前显示「再完成一项前置即可研究」的科技，避免整棵科技树一次性展开 */
        if (missing.length > 1) return false;
        return techAvailable(state, missing[0]);
    }

    function refreshVisibility(state) {
        /* 科技 */
        for (const name in state.techs) {
            state.techs[name].visible = techVisible(state, name);
        }
        /* 建筑：科技已研究 → 解锁；科技可研究 → 预告（半透明） */
        for (const name in state.buildings) {
            const cfg = BUILDINGS_CONFIG[name];
            const b = state.buildings[name];
            if (!cfg.tech) { b.visible = true; b.unlocked = true; continue; }
            const tech = state.techs[cfg.tech];
            if (tech && tech.researched) { b.visible = true; b.unlocked = true; }
            else if (tech && tech.visible) { b.visible = true; b.unlocked = false; }
            else { b.visible = b.count > 0; b.unlocked = b.count > 0; }
        }
        /* 升级 */
        for (const name in state.upgrades) {
            const cfg = UPGRADES_CONFIG[name];
            const tech = state.techs[cfg.tech];
            state.upgrades[name].visible = !!(tech && tech.researched);
        }
        /* 国策 */
        for (const name in state.policies) {
            const cfg = POLICIES_CONFIG[name];
            const tech = state.techs[cfg.tech];
            state.policies[name].visible = !!(tech && tech.researched);
        }
        /* 资源可见性 */
        const seen = {};
        for (const k in state.resources) {
            const r = state.resources[k];
            if (r.amount > 1e-9 || Math.abs(r.production) > 1e-9) seen[k] = true;
        }
        for (const name in state.buildings) {
            const b = state.buildings[name];
            if (!b.visible || !b.unlocked) continue;
            const cfg = BUILDINGS_CONFIG[name];
            const modes = cfg.modes || [cfg];
            for (const m of modes) {
                for (const k in (m.produces || {})) seen[k] = true;
                for (const k in (m.consumes || {})) seen[k] = true;
                for (const k in (m.caps || {})) seen[k] = true;
            }
            for (const k in b.price) seen[k] = true;
        }
        for (const name in state.techs) {
            if (!state.techs[name].visible) continue;
            const cfg = TECHS_CONFIG[name];
            for (const k in cfg.cost) seen[k] = true;
        }
        for (const name in state.upgrades) {
            if (!state.upgrades[name].visible) continue;
            for (const k in state.upgrades[name].price) seen[k] = true;
        }
        /* 传承资源一旦获得就永久显示 */
        for (const k in state.resources) {
            if (RESOURCES_CONFIG[k].prestige && state.resources[k].amount > 0) state.resources[k].visible = true;
            else state.resources[k].visible = !!seen[k];
        }
        state.resources['木材'].visible = true;
        state.resources['石料'].visible = true;
        state.resources['魔法知识'].visible = state.resources['魔法知识'].visible || state.techs['抄写术'].visible;
        for (const lr in state.localResources) {
            if (lr === 'power') state.localResources[lr].visible = state.localResources[lr].capacity > 0.001 || state.localResources[lr].used > 0.001;
            else state.localResources[lr].visible = true;
        }
    }

    function updatePrices(state) {
        for (const name in state.buildings) {
            state.buildings[name].price = buildingPrice(state, name);
        }
        for (const name in state.upgrades) {
            if (state.upgrades[name].visible) state.upgrades[name].price = upgradePrice(state, name);
        }
    }

    function getBuildingStats(state, name) {
        const cfg = BUILDINGS_CONFIG[name];
        const b = state.buildings[name];
        if (!cfg || !b) return null;
        const active = activeConfig(cfg, b);
        const mult = EffectsManager.buildingMultipliers(state, name);
        const happyMult = happinessMult(state);
        const eff = b.active ? b.efficiency : 1;
        const prod = [], cons = [], caps = [];
        const baseProd = resolve(active.produces, state);
        for (const r in baseProd) {
            const per = baseProd[r] * mult.prod * EffectsManager.resourceMultiplier(state, r) * happyMult;
            prod.push({ res: r, per: per, total: per * b.active * eff });
        }
        const baseCons = resolve(active.consumes, state);
        for (const r in baseCons) {
            const per = baseCons[r] * mult.cons;
            cons.push({ res: r, per: per, total: per * b.active * eff });
        }
        const baseCaps = resolve(active.caps, state);
        for (const r in baseCaps) caps.push({ res: r, per: baseCaps[r] * mult.cap, total: baseCaps[r] * mult.cap * b.active });
        return {
            prod: prod, cons: cons, caps: caps,
            efficiency: eff,
            providesLocal: resolve(active.providesLocal, state),
            requiresLocal: cfg.pop ? { population: cfg.pop } : {},
            happiness: active.happiness || 0,
            modifiers: active.modifiers || [],
            modeName: active.modeName || null,
            price: b.price,
        };
    }

    /* 某资源的产量来源明细（用于悬浮提示） */
    function getResourceContributions(state, res) {
        const out = [];
        for (const name in state.buildings) {
            const b = state.buildings[name];
            if (!b.active) continue;
            const stats = getBuildingStats(state, name);
            if (!stats) continue;
            const p = stats.prod.find(x => x.res === res);
            if (p) out.push({ source: name, value: p.total });
            const c = stats.cons.find(x => x.res === res);
            if (c) out.push({ source: name + '（消耗）', value: -c.total });
        }
        if (window.TradeEngine) {
            const t = TradeEngine.rates(state)[res];
            if (t) out.push({ source: '贸易', value: t });
            if (res === '黄金') {
                const g = TradeEngine.goldFlow(state);
                if (g) out.push({ source: '贸易结算', value: g });
            }
        }
        for (const ae of state.activeEffects) {
            if (ae.effect && ae.effect.resourceProd && ae.effect.resourceProd[res]) {
                out.push({ source: '事件·' + ae.name, value: 0, note: '修正 ' + Utils.fmtPct(ae.effect.resourceProd[res]) });
            }
        }
        return out;
    }

    window.ProductionEngine = {
        computeProductionAndCaps,
        updatePrices,
        happinessMult,
        buildingPrice,
        buildingPriceCount,
        upgradePrice,
        upgradePriceCount,
        getBuildingStats,
        getResourceContributions,
        activeConfig,
        happinessSoftCap,
        techAvailable,
        refreshVisibility,
        costMultiplier,
    };
    window.computeProductionAndCaps = computeProductionAndCaps;
})();
