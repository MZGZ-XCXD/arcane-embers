/* =========================================================
   英雄与传送阵（抽卡引擎）
   英雄效果 = 分类基础效果 × 稀有度倍率 × 觉醒加成
   卡池里除了英雄，还有资源奖励与「空」结果；并有 A / S / EX 三档保底。
   ========================================================= */
(function () {
    /* 稀有度阶梯：按 config 里的定义顺序推导，避免两处各写一份对不上 */
    const RARITY_RANK = (function () {
        const m = {};
        let i = 0;
        for (const k in HERO_RARITIES) m[k] = i++;
        return m;
    })();

    function heroById(id) {
        return HEROES_CONFIG.find(h => h.id === id) || null;
    }

    /* 是否已经拥有这只英雄（觉醒 0 级也算拥有） */
    function hasHero(state, id) {
        return !!(state.heroes && state.heroes.owned && state.heroes.owned[id] !== undefined);
    }

    /* 这只英雄提供的机制（遗迹限定英雄用），没有则返回 null */
    function heroMech(heroOrId) {
        const hero = typeof heroOrId === 'string' ? heroById(heroOrId) : heroOrId;
        return hero && hero.mech ? (window.HERO_MECHS[hero.mech] || null) : null;
    }

    /* 某一层遗迹掉落的限定英雄 */
    function expeditionHeroFor(regionName) {
        return HEROES_CONFIG.find(h => h.source === 'expedition' && h.drop === regionName) || null;
    }

    /* 某个机制的拥有者 / 是否已经拥有该机制 */
    function heroWithMech(key) {
        return HEROES_CONFIG.find(h => h.mech === key) || null;
    }
    function hasMech(state, key) {
        const h = heroWithMech(key);
        return !!(h && hasHero(state, h.id));
    }

    /* 从遗迹招募一只英雄：首次获得即入收藏；重复获得直接转成奥术遗物
       （机制型英雄没有觉醒等级，多出来的份数换成实在的资源） */
    function recruit(state, id) {
        const hero = heroById(id);
        if (!hero || !state.heroes) return { ok: false };
        const owned = state.heroes.owned;
        state.heroes.byRarity[hero.rarity] = (state.heroes.byRarity[hero.rarity] || 0) + 1;
        if (owned[id] === undefined) {
            owned[id] = 0;
            state.heroes.history.unshift({ type: 'hero', rarity: hero.rarity, name: hero.name, isNew: true, day: state.gameDays });
            if (state.heroes.history.length > 30) state.heroes.history.pop();
            return { ok: true, isNew: true, hero: hero };
        }
        const relic = HERO_RARITIES[hero.rarity].dupRelic;
        ResourcesManager.add({ 奥术遗物: relic });
        state.heroes.dupRelics = (state.heroes.dupRelics || 0) + relic;
        state.heroes.history.unshift({ type: 'hero', rarity: hero.rarity, name: hero.name, dupRelic: relic, day: state.gameDays });
        if (state.heroes.history.length > 30) state.heroes.history.pop();
        return { ok: true, isNew: false, relic: relic, hero: hero };
    }

    function scaleEffect(eff, mult) {
        const out = {};
        for (const k in eff) {
            const v = eff[k];
            if (typeof v === 'number') out[k] = v * mult;
            else if (typeof v === 'object' && v !== null) {
                const inner = {};
                for (const k2 in v) inner[k2] = v[k2] * mult;
                out[k] = inner;
            }
        }
        return out;
    }

    /* 单个英雄的完整效果（含额外效果，额外效果不随稀有度缩放） */
    function heroEffect(hero) {
        const cat = HERO_CATEGORIES[hero.category];
        const rarity = HERO_RARITIES[hero.rarity];
        const eff = cat ? scaleEffect(cat.effect, rarity.mult) : {};
        if (hero.extra) {
            for (const k in hero.extra) {
                if (typeof hero.extra[k] === 'number' && typeof eff[k] === 'number') eff[k] += hero.extra[k];
                else eff[k] = hero.extra[k];
            }
        }
        return eff;
    }

    function awakenMultiplier(awaken) {
        return 1 + GACHA_CONFIG.awakeningStep * (awaken || 0);
    }

    /* 所有已获得英雄提供的效果（供 effects.js 汇总） */
    function ownedEffects(state) {
        const out = [];
        if (!state.heroes || !state.heroes.owned) return out;
        for (const id in state.heroes.owned) {
            const hero = heroById(id);
            if (!hero) continue;
            out.push({
                hero: hero,
                awaken: state.heroes.owned[id] || 0,
                mult: awakenMultiplier(state.heroes.owned[id] || 0),
                effect: heroEffect(hero),
            });
        }
        return out;
    }

    /* ---------------- 召唤消耗 ---------------- */
    function pullCost(state, count) {
        count = Math.max(1, count || 1);
        const e = EffectsManager.get(state);
        const discount = Utils.clamp(e.summonDiscount || 0, 0, GACHA_CONFIG.discountCap);
        const batchMul = count >= GACHA_CONFIG.batchSize ? (1 - GACHA_CONFIG.batchDiscount) : 1;
        const cost = {};
        for (const k in GACHA_CONFIG.costs) {
            cost[k] = Math.max(1, Math.round(GACHA_CONFIG.costs[k] * count * batchMul * (1 - discount)));
        }
        return cost;
    }

    function canSummon(state, count) {
        const cost = pullCost(state, count);
        if (!ResourcesManager.canAfford(cost)) return { ok: false, msg: '召唤材料不足。', cost: cost };
        return { ok: true, cost: cost };
    }

    /* 幸运对 S / EX 权重的实际倍率（带上限，避免稀有度权重失衡） */
    function luckMultiplier(state) {
        return 1 + Math.min(EffectsManager.get(state).luck || 0, GACHA_CONFIG.luckCap);
    }
    /* 实际生效的召唤折扣（同样带上限） */
    function effectiveDiscount(state) {
        return Utils.clamp(EffectsManager.get(state).summonDiscount || 0, 0, GACHA_CONFIG.discountCap);
    }

    /* ---------------- 抽取 ---------------- */
    function pickRarity(state) {
        const pity = state.heroes.pity;
        /* 保底最高只到 SS：EX 没有任何保底，也不会从保底升级里冒出来，只能靠普通抽取撞上 */
        if (pity.SS >= GACHA_CONFIG.pity.SS) return 'SS';
        if (pity.S >= GACHA_CONFIG.pity.S) return Math.random() < 0.12 ? 'SS' : 'S';
        if (pity.A >= GACHA_CONFIG.pity.A) return Utils.weightedPick(['A', 'S', 'SS'], k => HERO_RARITIES[k].weight);

        const luck = Math.min(EffectsManager.get(state).luck || 0, GACHA_CONFIG.luckCap);
        const list = [];
        for (const key in HERO_RARITIES) list.push(key);
        const heroWeight = list.reduce((sum, k) => sum + HERO_RARITIES[k].weight * (GACHA_CONFIG.luckRarities.indexOf(k) >= 0 ? (1 + luck) : 1), 0);
        const total = heroWeight + GACHA_CONFIG.rewardWeight + GACHA_CONFIG.emptyWeight;
        let roll = Math.random() * total;
        for (const k of list) {
            const w = HERO_RARITIES[k].weight * (GACHA_CONFIG.luckRarities.indexOf(k) >= 0 ? (1 + luck) : 1);
            roll -= w;
            if (roll <= 0) return k;
        }
        roll -= GACHA_CONFIG.rewardWeight;
        if (roll <= 0) return 'RESOURCE';
        return 'EMPTY';
    }

    function pickHero(rarity) {
        /* 遗迹限定英雄不进卡池——它们只能从对应那一层遗迹掉落 */
        const pool = HEROES_CONFIG.filter(h => h.rarity === rarity && h.source !== 'expedition');
        if (!pool.length) return HEROES_CONFIG.filter(h => h.source !== 'expedition')[0];
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function rollReward(state) {
        const cfg = GACHA_CONFIG;
        const pool = cfg.rewardRes.filter(r => state.resources[r] && state.resources[r].visible);
        const list = pool.length ? pool : cfg.rewardRes;
        const n = Utils.rndInt(cfg.rewardCount[0], cfg.rewardCount[1]);
        const gained = {};
        for (let i = 0; i < n; i++) {
            const res = list[Math.floor(Math.random() * list.length)];
            const r = state.resources[res];
            if (!r) continue;
            const amount = Math.max(1, Math.floor(r.cap * Utils.rnd(cfg.rewardMin, cfg.rewardMax)));
            gained[res] = (gained[res] || 0) + amount;
        }
        return { type: 'reward', resources: gained };
    }

    function rollOnce(state) {
        const rarity = pickRarity(state);
        if (rarity === 'RESOURCE') return rollReward(state);
        if (rarity === 'EMPTY') return { type: 'empty' };
        const hero = pickHero(rarity);
        return { type: 'hero', rarity: rarity, hero: hero };
    }

    function bumpPity(state, result) {
        const p = state.heroes.pity;
        const r = result.type === 'hero' ? result.rarity : null;
        const rank = r ? RARITY_RANK[r] : -1;
        p.A = rank >= RARITY_RANK.A ? 0 : p.A + 1;
        p.S = rank >= RARITY_RANK.S ? 0 : p.S + 1;
        p.SS = rank >= RARITY_RANK.SS ? 0 : p.SS + 1;
    }

    /* 应用一次抽取结果 */
    function applyResult(state, result) {
        if (result.type === 'hero') {
            const id = result.hero.id;
            const owned = state.heroes.owned;
            if (owned[id] === undefined) {
                owned[id] = 0;
                result.isNew = true;
            } else if (owned[id] < GACHA_CONFIG.awakeningMax) {
                owned[id]++;
                result.awaken = owned[id];
            } else {
                const relic = HERO_RARITIES[result.hero.rarity].dupRelic;
                ResourcesManager.add({ 奥术遗物: relic });
                result.dupRelic = relic;
                state.heroes.dupRelics = (state.heroes.dupRelics || 0) + relic;
            }
            state.heroes.byRarity[result.hero.rarity] = (state.heroes.byRarity[result.hero.rarity] || 0) + 1;
        } else if (result.type === 'reward') {
            ResourcesManager.add(result.resources);
        }
        state.heroes.pulls = (state.heroes.pulls || 0) + 1;
        bumpPity(state, result);
        state.heroes.history.unshift({
            type: result.type,
            rarity: result.rarity || null,
            name: result.hero ? result.hero.name : (result.type === 'reward' ? '资源馈赠' : '虚空回响'),
            isNew: !!result.isNew,
            awaken: result.awaken,
            day: state.gameDays,
        });
        if (state.heroes.history.length > 30) state.heroes.history.pop();
    }

    /* 召唤 count 次 */
    function summon(state, count) {
        count = Math.floor(count || 0);
        if (count < 1) return { ok: false, msg: '召唤次数无效。' };
        const check = canSummon(state, count);
        if (!check.ok) return check;
        ResourcesManager.spend(check.cost);
        const results = [];
        for (let i = 0; i < count; i++) {
            const result = rollOnce(state);
            applyResult(state, result);
            results.push(result);
        }
        ProductionEngine.updatePrices(state);
        ProductionEngine.computeProductionAndCaps(state);
        if (window.AchievementEngine) AchievementEngine.check(state);
        const best = results.reduce((acc, r) => {
            if (r.type !== 'hero') return acc;
            return (RARITY_RANK[r.rarity] > RARITY_RANK[acc]) ? r.rarity : acc;
        }, 'C');
        const heroNames = results.filter(r => r.type === 'hero').map(r => r.hero.name).join('、');
        EventEngine.addLog(state, '🔮 传送阵召唤 ×' + count + '，最高获得 ' + best + ' 级' +
            (heroNames ? '（' + heroNames + '）' : '（无英雄回应）'));
        return { ok: true, results: results, best: best, msg: '召唤完成：获得 ' + results.length + ' 项结果' };
    }

    /* 汇总统计 */
    function stats(state) {
        const h = state.heroes;
        const owned = Object.keys(h.owned).length;
        const total = HEROES_CONFIG.length;
        return {
            pulls: h.pulls || 0,
            owned: owned,
            total: total,
            byRarity: h.byRarity,
            dupRelics: h.dupRelics || 0,
            pity: h.pity,
            fullCollection: owned >= total,
        };
    }

    function ownedCount(state, rarity) {
        let n = 0;
        for (const id in state.heroes.owned) {
            const hero = heroById(id);
            if (hero && hero.rarity === rarity) n++;
        }
        return n;
    }
    function totalCount(rarity) {
        return HEROES_CONFIG.filter(h => h.rarity === rarity).length;
    }

    /* 该档位的基础出现概率（不含幸运加成与保底，仅按权重算） */
    function rarityChance(rarity) {
        let heroWeight = 0;
        for (const k in HERO_RARITIES) heroWeight += HERO_RARITIES[k].weight;
        const total = heroWeight + GACHA_CONFIG.rewardWeight + GACHA_CONFIG.emptyWeight;
        const r = HERO_RARITIES[rarity];
        return r ? r.weight / total : 0;
    }

    window.Heroes = {
        heroById, heroEffect, awakenMultiplier, ownedEffects,
        pullCost, canSummon, summon, stats, ownedCount, totalCount, pickRarity,
        luckMultiplier, effectiveDiscount, rarityChance,
        hasHero, heroMech, expeditionHeroFor, recruit,
        heroWithMech, hasMech, pickHero,
    };
})();
