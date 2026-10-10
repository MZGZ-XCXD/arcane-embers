/* =========================================================
   秘宝：远征带回的随机增益物品，可装备（默认 3 槽，可用传承扩展）
   每条词条都是一个标准效果对象，直接参与加成汇总。
   ========================================================= */
(function () {
    const PREFIX = ['龙语', '星辰', '深渊', '炽焰', '霜华', '虚空', '晨曦', '幽影', '圣辉', '秘银', '枯木', '雷鸣', '时砂', '萤火', '残月'];
    const SUFFIX = ['护符', '指环', '法球', '徽记', '骨笛', '碎镜', '怀表', '钥匙', '面具', '短杖', '羽饰', '灯焰'];
    const GLYPH = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ'];

    function artifactSlots(state) {
        return 3 + Math.round(EffectsManager.additive(state, 'artifactSlots'));
    }

    function candidateBuildings(state, kind) {
        const out = [];
        for (const name in state.buildings) {
            if (!state.buildings[name].visible) continue;
            const cfg = BUILDINGS_CONFIG[name];
            const hasProd = Object.keys(cfg.produces || {}).length > 0 || (cfg.modes && cfg.modes.some(m => Object.keys(m.produces || {}).length > 0));
            const hasCons = Object.keys(cfg.consumes || {}).length > 0 || (cfg.modes && cfg.modes.some(m => Object.keys(m.consumes || {}).length > 0));
            const hasCap = Object.keys(cfg.caps || {}).length > 0 || (cfg.modes && cfg.modes.some(m => Object.keys(m.caps || {}).length > 0));
            if (kind === 'prod' && !hasProd) continue;
            if (kind === 'cons' && !hasCons) continue;
            if (kind === 'cap' && !hasCap) continue;
            out.push(name);
        }
        return out;
    }

    /* 生成一件秘宝；tier 越高词条越多、数值越强 */
    function generate(state, tier) {
        tier = tier || 1;
        const quality = tier + EffectsManager.additive(state, 'artifactQuality') * 3;
        const count = Utils.clamp(1 + Math.floor(Utils.rnd(0, 2 + quality * 0.6)), 1, 6);
        /* 「浮空技师」在场时，带回来的秘宝只出正面词条 */
        const positiveOnly = !!(window.Heroes && Heroes.hasMech(state, 'positiveOnly'));
        const positiveChance = positiveOnly ? 1 : Utils.clamp(0.42 + quality * 0.045, 0.3, 0.78);
        const effects = [];
        const usedKeys = {};

        for (let i = 0; i < count; i++) {
            const kinds = ['prod', 'cons', 'cap', 'global', 'resource', 'happy'];
            const kind = Utils.pick(kinds);
            let eff = null, key = '';
            const scale = 0.03 + Utils.rnd(0, 0.05) + quality * 0.012;

            if (kind === 'prod' || kind === 'cons' || kind === 'cap') {
                const list = candidateBuildings(state, kind);
                const target = list.length ? Utils.pick(list) : null;
                if (!target) continue;
                key = kind + ':' + target;
                if (usedKeys[key]) continue;
                usedKeys[key] = true;
                let v = scale * (kind === 'cap' ? 0.8 : 1);
                const positive = Math.random() < positiveChance;
                if (kind === 'cons') v = positive ? -v : v;      // 负 = 减少消耗（好）
                else v = positive ? v : -v;
                const inner = {};
                inner[kind] = v;
                eff = {}; eff[target] = inner;
            } else if (kind === 'global') {
                key = 'global';
                if (usedKeys[key]) continue;
                usedKeys[key] = true;
                const v = (positiveOnly || Math.random() < positiveChance) ? scale : -scale;
                eff = { globalProd: v };
            } else if (kind === 'resource') {
                const list = Object.keys(state.resources).filter(r => !RESOURCES_CONFIG[r].prestige && state.resources[r].visible);
                if (!list.length) continue;
                const res = Utils.pick(list);
                key = 'res:' + res;
                if (usedKeys[key]) continue;
                usedKeys[key] = true;
                const v = (positiveOnly || Math.random() < positiveChance) ? scale * 1.2 : -scale * 1.2;
                const inner = {}; inner[res] = v;
                eff = { resourceProd: inner };
            } else {
                key = 'happy';
                if (usedKeys[key]) continue;
                usedKeys[key] = true;
                const v = (10 + Utils.rnd(0, 25)) * (1 + quality * 0.25);
                eff = { happiness: (positiveOnly || Math.random() < positiveChance) ? v : -v };
            }
            if (eff) effects.push(eff);
        }
        if (!effects.length) effects.push({ globalProd: 0.02 });

        const roman = GLYPH[Utils.clamp(tier - 1, 0, 9)];
        const artifact = {
            id: Date.now() + '_' + Math.floor(Math.random() * 1e6),
            name: Utils.pick(PREFIX) + Utils.pick(SUFFIX) + ' ' + roman,
            tier: tier,
            effects: effects,
        };
        state.stats.artifactsFound++;
        return artifact;
    }

    /* 把秘宝加入库存（库存在重置时会被清空，除记忆水晶外） */
    function addToInventory(state, artifact) {
        if (state.artifacts.inventory.length >= 12) {
            state.artifacts.inventory.shift();
        }
        state.artifacts.inventory.push(artifact);
        return artifact;
    }

    function equip(state, id) {
        const slots = artifactSlots(state);
        while (state.artifacts.equipped.length < slots) state.artifacts.equipped.push(null);
        const idx = state.artifacts.inventory.findIndex(a => a.id === id);
        if (idx < 0) return { ok: false, msg: '秘宝不存在。' };
        let slot = state.artifacts.equipped.findIndex((x, i) => !x && i < slots);
        if (slot < 0) return { ok: false, msg: '装备槽已满，请先卸下一件秘宝。' };
        const art = state.artifacts.inventory.splice(idx, 1)[0];
        state.artifacts.equipped[slot] = art;
        return { ok: true, msg: '已装备「' + art.name + '」。' };
    }

    function unequip(state, slot) {
        const art = state.artifacts.equipped[slot];
        if (!art) return { ok: false };
        if (state.artifacts.inventory.length >= 12) return { ok: false, msg: '库存已满，无法卸下。' };
        state.artifacts.equipped[slot] = null;
        state.artifacts.inventory.push(art);
        return { ok: true, msg: '已卸下「' + art.name + '」。' };
    }

    function discard(state, id) {
        const idx = state.artifacts.inventory.findIndex(a => a.id === id);
        if (idx < 0) return;
        state.artifacts.inventory.splice(idx, 1);
    }

    /* 效果文字描述
       传入的既可能是单个效果对象，也可能是效果数组（秘宝的 art.effects 就是数组）——
       两种都支持，否则会按数组下标遍历，输出成「0 [object Object]」。 */
    function describe(effects) {
        const list = Array.isArray(effects) ? effects : [effects];
        const out = [];
        for (const eff of list) {
            if (!eff || typeof eff !== 'object') continue;
            for (const key in eff) {
                const v = eff[key];

                if (typeof v === 'number') {
                    if (key === 'happiness') out.push('民望 ' + (v >= 0 ? '+' : '') + Utils.fmtNum(v, 0));
                    else if (key === 'globalProd') out.push('所有建筑产出 ' + Utils.fmtPct(v, 1));
                    else if (key === 'globalCost') out.push('成本增长率 ' + Utils.fmtPct(v, 1));
                    else if (key === 'speed') out.push('世界流速 ' + Utils.fmtPct(v, 1));
                    else if (key === 'resourceProd') out.push('全局产出 ' + Utils.fmtPct(v, 1));
                    else out.push(key + ' ' + Utils.fmtPct(v, 1));
                    continue;
                }

                if (key === 'resourceProd') {
                    for (const r in v) out.push(r + ' 产出 ' + Utils.fmtPct(v[r], 1));
                    continue;
                }

                if (v && typeof v === 'object') {
                    /* 以建筑 / 资源为目标的词条：{ 目标: { prod|cons|cap } } */
                    const bits = [];
                    if (typeof v.prod === 'number') bits.push('产出 ' + Utils.fmtPct(v.prod, 1));
                    if (typeof v.cons === 'number') bits.push('消耗 ' + Utils.fmtPct(v.cons, 1));
                    if (typeof v.cap === 'number') bits.push('上限 ' + Utils.fmtPct(v.cap, 1));
                    if (bits.length) { out.push(key + ' ' + bits.join('，')); continue; }
                    /* 其它没见过的复合词条：逐项展开，绝不打印 [object Object] */
                    const inner = [];
                    for (const k2 in v) {
                        const v2 = v[k2];
                        inner.push(k2 + ' ' + (typeof v2 === 'number' ? Utils.fmtPct(v2, 1) : String(v2)));
                    }
                    out.push(key + '：' + (inner.join('，') || '—'));
                    continue;
                }

                out.push(key + ' ' + String(v));
            }
        }
        return out;
    }

    window.Artifacts = { generate, addToInventory, equip, unequip, discard, describe, artifactSlots };
})();
