/* =========================================================
   国策（滑杆，调整时消耗政策点）
   P(名称, {tech, min, max, step, def, unit, cost, desc, get(state, value) -> 效果})
   ========================================================= */
(function () {
    const REG = {};
    const ORDER = [];

    function P(name, o) {
        REG[name] = {
            name: name,
            tech: o.tech,
            min: o.min, max: o.max, step: o.step || 1,
            def: o.def,
            unit: o.unit || '',
            cost: o.cost === undefined ? 1 : o.cost,
            desc: o.desc,
            get: o.get,
        };
        ORDER.push(name);
    }

    P('税收政策', {
        tech: '铸币学', min: 0, max: 60, def: 25, unit: '%', cost: 1,
        desc: '向居民与商人征税。税率越高，黄金产出越多，但民望下降。',
        get: v => ({
            金矿: { prod: (v - 25) * 0.05 },
            集市: { prod: (v - 25) * 0.05 },
            happiness: -(v - 25) * 0.8,
        }),
    });

    P('开采倾向', {
        tech: '矿物学', min: -50, max: 50, def: 0, cost: 1,
        desc: '把劳力投向森林还是岩层。负值偏木材，正值偏石料与矿石。',
        get: v => ({
            伐木场: { prod: -v * 0.02 },
            拾荒棚: { prod: -v * 0.01 },
            采石场: { prod: v * 0.02 },
            铁矿场: { prod: v * 0.015 },
        }),
    });

    P('魔力配给', {
        tech: '魔网学', min: -30, max: 50, def: 0, cost: 2,
        desc: '把魔力优先供给生产还是节约储备。正值提速但增加魔力消耗。',
        get: v => ({
            魔力井: { prod: v * 0.012 },
            魔网节点: { prod: v * 0.012, cons: v * 0.02 },
            火之祭坛: { prod: v * 0.012, cons: v * 0.02 },
            水之祭坛: { prod: v * 0.012, cons: v * 0.02 },
            土之祭坛: { prod: v * 0.012, cons: v * 0.02 },
            星辰塔: { prod: v * 0.01, cons: v * 0.02 },
        }),
    });

    P('研究重心', {
        tech: '议会制度', min: -30, max: 30, def: 0, cost: 3,
        desc: '资源投向学院还是国库。正值偏知识，负值偏黄金。',
        get: v => ({
            藏书阁: { prod: v * 0.015, cap: v * 0.005 },
            咒法学院: { prod: v * 0.015, cap: v * 0.005 },
            大图书馆: { prod: v * 0.015, cap: v * 0.005 },
            秘法实验室: { prod: v * 0.012, cap: v * 0.004 },
            金矿: { prod: -v * 0.015 },
            集市: { prod: -v * 0.015 },
        }),
    });

    P('尚武风气', {
        tech: '法师卫队', min: -30, max: 30, def: 0, cost: 3,
        desc: '把人力与财力投入军备。正值军力大增，但生产与民望受损。',
        get: v => ({
            石砌城墙: { prod: v * 0.02 },
            法师卫队: { prod: v * 0.02 },
            魔像工坊: { prod: v * 0.02 },
            猎魔人营地: { prod: v * 0.02 },
            星界军团: { prod: v * 0.02 },
            globalProd: -v * 0.002,
            happiness: -v * 0.6,
        }),
    });

    P('元素倾向', {
        tech: '元素契约', min: -30, max: 30, def: 0, cost: 4,
        desc: '让元素服务大地还是服务熔炉。负值偏农业与民生，正值偏加工与魔力。',
        get: v => ({
            农田: { prod: -v * 0.015 },
            草药园: { prod: -v * 0.01 },
            火之祭坛: { prod: v * 0.02 },
            水之祭坛: { prod: v * 0.02 },
            土之祭坛: { prod: v * 0.02 },
            元素熔炉核心: { prod: v * 0.02 },
            符文作坊: { prod: v * 0.012 },
            happiness: -v * 0.3,
        }),
    });

    window.POLICIES_CONFIG = REG;
    window.POLICIES_ORDER = ORDER;
})();
