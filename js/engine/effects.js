/* =========================================================
   效果聚合器
   把科技 / 升级 / 政策 / 传承 / 成就 / 试炼 / 秘宝 / 事件 / 建筑全局效果
   统一汇总成一份可直接查询的加成表
   ========================================================= */
(function () {
    const ADDITIVE_KEYS = [
        'globalProd', 'globalCost', 'happiness', 'knowledgeProd', 'capAll',
        'populationCap', 'relicGain', 'resetGain', 'expeditionPower',
        'expeditionReward', 'speed', 'marketVolume', 'artifactQuality',
        'capPerRelic', 'knowledgeCapPerRelic', 'offlineHours',
        /* 建造队列与英雄召唤相关 */
        'queueSlots', 'queueDiscount', 'powerMult', 'luck', 'summonDiscount', 'heroPower',
    ];

    function emptyEffects() {
        const e = {
            buildings: {},
            resources: {},
            happinessList: [],
            specials: {},
            knowledgeCapMult: 1,
            startResources: 0,
        };
        for (const k of ADDITIVE_KEYS) e[k] = 0;
        return e;
    }

    function ensureBuilding(e, name) {
        if (!e.buildings[name]) e.buildings[name] = { prod: 0, cons: 0, cap: 0 };
        return e.buildings[name];
    }

    /* 把一份效果对象叠加进汇总表 */
    function applyEffect(e, eff, scale, source) {
        if (!eff) return;
        scale = scale === undefined ? 1 : scale;
        for (const key in eff) {
            const val = eff[key];
            if (val === undefined || val === null) continue;

            if (ADDITIVE_KEYS.indexOf(key) >= 0) {
                if (typeof val === 'number') e[key] += val * scale;
                continue;
            }
            if (key === 'resourceProd') {
                for (const r in val) {
                    if (!e.resources[r]) e.resources[r] = { prod: 0 };
                    e.resources[r].prod += val[r] * scale;
                }
                continue;
            }
            if (key === 'startResources') { e.startResources += val * scale; continue; }
            if (key === 'knowledgeCapMult') { e.knowledgeCapMult *= Math.pow(val, scale); continue; }
            if (key === 'special') { e.specials[val] = true; continue; }
            if (key === 'happinessPerRelic') { e.happinessPerRelic = (e.happinessPerRelic || 0) + val * scale; continue; }

            if (BUILDINGS_CONFIG[key]) {
                const b = ensureBuilding(e, key);
                if (typeof val.prod === 'number') b.prod += val.prod * scale;
                if (typeof val.cons === 'number') b.cons += val.cons * scale;
                if (typeof val.cap === 'number') b.cap += val.cap * scale;
                continue;
            }
            if (RESOURCES_CONFIG[key] && typeof val === 'number') {
                if (!e.resources[key]) e.resources[key] = { prod: 0 };
                e.resources[key].prod += val * scale;
                continue;
            }
        }
    }

    function addHappiness(e, source, value) {
        if (!value) return;
        e.happiness += value;
        e.happinessList.push({ source: source, value: value });
    }

    /* ---------------- 汇总 ---------------- */
    function refreshAllEffects(state) {
        const e = emptyEffects();
        state.effects = e;

        /* 科技 */
        for (const name in state.techs) {
            const t = state.techs[name];
            if (!t.researched) continue;
            const cfg = TECHS_CONFIG[name];
            if (cfg && cfg.effect) applyEffect(e, cfg.effect, 1, '科技·' + name);
        }

        /* 可重复升级 */
        for (const name in state.upgrades) {
            const u = state.upgrades[name];
            if (!u.level) continue;
            const cfg = UPGRADES_CONFIG[name];
            if (cfg && cfg.effect) applyEffect(e, cfg.effect, u.level, '升级·' + name);
        }

        /* 国策 */
        for (const name in state.policies) {
            const p = state.policies[name];
            const cfg = POLICIES_CONFIG[name];
            if (!p.visible || !cfg || !cfg.get) continue;
            const eff = cfg.get(p.value);
            if (eff) applyEffect(e, eff, 1, '国策·' + name);
        }

        /* 传承 */
        for (const name in state.permanent) {
            const perm = state.permanent[name];
            if (!perm.level) continue;
            const cfg = PERMANENT_CONFIG[name];
            if (!cfg) continue;
            if (cfg.effect) applyEffect(e, cfg.effect, perm.level, '传承·' + name);
            if (cfg.special) e.specials[cfg.special] = true;
        }

        /* 成就 */
        for (const id in state.achievements) {
            if (!state.achievements[id]) continue;
            const cfg = ACHIEVEMENTS_CONFIG.find(a => a.id === id);
            if (cfg && cfg.effect) applyEffect(e, cfg.effect, 1, '成就·' + id);
        }

        /* 试炼（激活中的负面效果） */
        for (const c of CHALLENGES_CONFIG) {
            const st = state.challenges[c.id];
            if (st && st.active) applyEffect(e, c.effect, 1, '试炼·' + c.id);
            if (st && st.completed) applyEffect(e, c.reward, 1, '试炼奖励·' + c.id);
        }

        /* 秘宝 */
        for (const art of state.artifacts.equipped) {
            if (!art) continue;
            for (const eff of art.effects) applyEffect(e, eff, 1, '秘宝·' + art.name);
        }

        /* 英雄：分类效果 × 稀有度倍率 × 觉醒加成 × 传承「英雄共鸣」加成 */
        if (state.heroes && state.heroes.owned && window.Heroes) {
            const heroMult = 1 + (e.heroPower || 0);
            for (const item of Heroes.ownedEffects(state)) {
                const scaled = {}, plain = {};
                for (const k in item.effect) {
                    if (k === 'queueSlots') plain[k] = item.effect[k];   // 槽位是整数，不随觉醒缩放
                    else scaled[k] = item.effect[k];
                }
                applyEffect(e, scaled, item.mult * heroMult, '英雄·' + item.hero.name);
                applyEffect(e, plain, 1, '英雄·' + item.hero.name);
            }
        }

        /* 随机事件带来的临时效果 */
        for (const ae of state.activeEffects) {
            applyEffect(e, ae.effect, 1, '事件·' + ae.name);
            if (ae.effect && typeof ae.effect.happiness === 'number') {
                /* happiness 已在 applyEffect 中累加 */
            }
        }

        /* 建筑提供的全局效果（按启用数量叠加） */
        for (const name in state.buildings) {
            const b = state.buildings[name];
            if (!b.active) continue;
            const cfg = BUILDINGS_CONFIG[name];
            if (cfg && cfg.global) applyEffect(e, cfg.global, b.active, '建筑·' + name);
        }

        return e;
    }

    const EffectsManager = {
        refreshAllEffects,
        applyEffect,
        ensureBuilding,
        emptyEffects,

        get(state) { return state.effects || refreshAllEffects(state); },
        additive(state, key) { return this.get(state)[key] || 0; },

        buildingMultipliers(state, name) {
            const e = this.get(state);
            const b = e.buildings[name] || { prod: 0, cons: 0, cap: 0 };
            return {
                prod: 1 + b.prod + e.globalProd,
                cons: 1 + b.cons,
                cap: 1 + Math.max(-0.9, b.cap),
            };
        },

        resourceMultiplier(state, res) {
            const e = this.get(state);
            const r = e.resources[res];
            let m = 1 + (r ? r.prod : 0);
            if (res === '魔法知识') m *= 1 + e.knowledgeProd;
            return Math.max(0, m);
        },

        hasSpecial(state, key) { return !!this.get(state).specials[key]; },
    };

    window.EffectsManager = EffectsManager;
})();
