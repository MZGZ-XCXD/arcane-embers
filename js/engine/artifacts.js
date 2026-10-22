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

    /* ---------- 流派与套装共鸣 ---------- */

    function setByKey(key) {
        if (!window.ARTIFACT_SETS) return null;
        return ARTIFACT_SETS.find(s => s.key === key) || null;
    }

    /* 老存档里的秘宝没有流派：用 id 做一个稳定的散列来补，
       这样同一件秘宝每次读档都落在同一个流派上，不会来回变。 */
    function setFromId(id) {
        const sets = window.ARTIFACT_SETS || [];
        if (!sets.length) return null;
        const str = String(id || '');
        let h = 0;
        for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100000;
        return sets[h % sets.length].key;
    }

    /* 已装备秘宝按流派计数 + 当前生效的共鸣（给界面用） */
    function setStatus(state) {
        const sets = window.ARTIFACT_SETS || [];
        const count = {};
        for (const art of state.artifacts.equipped) {
            if (!art || !art.set) continue;
            count[art.set] = (count[art.set] || 0) + 1;
        }
        return sets.map(s => ({
            set: s,
            count: count[s.key] || 0,
            two: (count[s.key] || 0) >= 2,
            three: (count[s.key] || 0) >= 3,
        }));
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
        const setName = window.ARTIFACT_SETS && ARTIFACT_SETS.length ? Utils.pick(ARTIFACT_SETS).key : null;
        const artifact = {
            id: Date.now() + '_' + Math.floor(Math.random() * 1e6),
            name: Utils.pick(PREFIX) + Utils.pick(SUFFIX) + ' ' + roman,
            tier: tier,
            set: setName,               // 流派：装备同流派 2 / 3 件触发共鸣
            effects: effects,
        };
        state.stats.artifactsFound++;
        return artifact;
    }

    /* 把秘宝加入库存（库存在重置时会被清空，除记忆水晶外） */
    /* ---------- 自动丢弃过滤 ----------
       黑名单语义：勾选的层级 / 流派 / 负面词条，命中任意一条就丢。 */
    function filterOf(state) {
        if (!state.settings) state.settings = {};
        let f = state.settings.artifactFilter;
        if (!f || typeof f !== 'object') {
            f = state.settings.artifactFilter = { enabled: false, tiers: [], sets: [], negative: false };
        }
        if (!Array.isArray(f.tiers)) f.tiers = [];
        if (!Array.isArray(f.sets)) f.sets = [];
        if (typeof f.enabled !== 'boolean') f.enabled = false;
        if (typeof f.negative !== 'boolean') f.negative = false;
        return f;
    }

    /* 一件秘宝是否带负面词条：建筑产出/上限变低、建筑消耗变高、资源/全局产出为负、
       民望为负、成本增长率为正。cons 为负是「少消耗」，算正面。 */
    function hasNegative(artifact) {
        if (!artifact || !Array.isArray(artifact.effects)) return false;
        for (const eff of artifact.effects) {
            if (!eff || typeof eff !== 'object') continue;
            for (const key in eff) {
                const v = eff[key];
                if (key === 'resourceProd') {
                    for (const r in v) if (typeof v[r] === 'number' && v[r] < -1e-9) return true;
                    continue;
                }
                if (typeof v === 'number') {
                    if (key === 'globalCost') { if (v > 1e-9) return true; }
                    else if (v < -1e-9) return true;
                    continue;
                }
                if (v && typeof v === 'object') {
                    if (typeof v.prod === 'number' && v.prod < -1e-9) return true;
                    if (typeof v.cap === 'number' && v.cap < -1e-9) return true;
                    if (typeof v.cons === 'number' && v.cons > 1e-9) return true;
                }
            }
        }
        return false;
    }

    function matchesFilter(state, artifact) {
        const f = filterOf(state);
        if (!f.enabled || !artifact) return false;
        if (f.tiers.indexOf(artifact.tier) >= 0) return true;
        if (artifact.set && f.sets.indexOf(artifact.set) >= 0) return true;
        if (f.negative && hasNegative(artifact)) return true;
        return false;
    }

    function addToInventory(state, artifact) {
        if (matchesFilter(state, artifact)) {
            state.stats.artifactsFiltered = (state.stats.artifactsFiltered || 0) + 1;
            artifact.filtered = true;
            return artifact;                    // 调用方看 .filtered 决定提示，不加入库存
        }
        /* 库存满了不再自动挤掉最旧的一件——那会让整列秘宝集体左移，
           看起来像「自动排序」。满格时新秘宝不带回，由调用方提示玩家先丢弃。 */
        if (state.artifacts.inventory.length >= 12) {
            artifact.skipped = 'full';
            return artifact;
        }
        ensureOrder(state, artifact);
        state.artifacts.inventory.push(artifact);
        return artifact;
    }

    /* 固定顺序号：显示只认 order，不看数组下标。
       这样装备（splice）与卸下（push）都不会让库存“乱刷排序”。 */
    function ensureOrder(state, art) {
        if (!state.artifacts) state.artifacts = { inventory: [], equipped: [], slots: 3 };
        const box = state.artifacts;
        /* 每次扫描现有最大 order：重置 / 导入 / 老存档之后都不会从 1 重新发号，
           否则新秘宝会插到最前面，看起来又像自动排序。 */
        let max = box.orderSeq || 0;
        for (const x of (box.inventory || [])) if (x && typeof x.order === 'number' && x.order > max) max = x.order;
        for (const x of (box.equipped || [])) if (x && typeof x.order === 'number' && x.order > max) max = x.order;
        if (typeof art.order !== 'number') {
            art.order = max + 1;
        }
        box.orderSeq = Math.max(max, art.order);
        return art;
    }

    /* 库存的稳定显示顺序（老存档没有 order 的按当前数组顺序补齐一次） */
    function sortedInventory(state) {
        const list = state.artifacts.inventory;
        let need = false;
        for (const a of list) if (a && typeof a.order !== 'number') need = true;
        if (need) for (const a of list) ensureOrder(state, a);
        return list.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    /* 手动调整库存顺序：和相邻一件交换，不自动排序 */
    function move(state, id, dir) {
        const list = sortedInventory(state);
        const idx = list.findIndex(a => a.id === id);
        if (idx < 0) return { ok: false };
        const to = idx + (dir < 0 ? -1 : 1);
        if (to < 0 || to >= list.length) return { ok: false };
        const a = list[idx], b = list[to];
        ensureOrder(state, a); ensureOrder(state, b);
        const tmp = a.order;
        a.order = b.order;
        b.order = tmp;
        return { ok: true };
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

    window.Artifacts = {
        generate, addToInventory, equip, unequip, discard, describe, artifactSlots,
        setByKey, setFromId, setStatus,
        filterOf, hasNegative, matchesFilter,
        move, ensureOrder, sortedInventory,
    };
})();
