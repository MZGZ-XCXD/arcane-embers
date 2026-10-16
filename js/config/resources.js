/* =========================================================
   资源定义
   cap        基础存量上限（可被仓库类建筑提高）
   value      基础价值（用于贸易定价）
   decay      贸易热度回落到 1 的速率（每日）
   change     贸易流量对价格的冲击强度
   prestige   传承资源（重置保留、无上限、不参与贸易）
   ========================================================= */
(function () {
    const RESOURCES_CONFIG = {
        /* ---------- 原料 ---------- */
        木材: { icon: '🪵', cap: 300, value: 1, decay: 0.010, change: 0.10, group: '原料', desc: '灰烬森林里砍下的木料。一切重建都从它开始。' },
        石料: { icon: '🪨', cap: 300, value: 1, decay: 0.010, change: 0.10, group: '原料', desc: '从崩塌的城墙与山体中凿出的石块。' },
        铁矿: { icon: '⛏️', cap: 200, value: 2.5, decay: 0.008, change: 0.12, group: '原料', desc: '带着锈色的粗矿，需冶炼后才能使用。' },
        木炭: { icon: '🔥', cap: 200, value: 2, decay: 0.008, change: 0.12, group: '原料', desc: '由木材闷烧而成。熔炉与祭坛的燃料。' },
        食物: { icon: '🍞', cap: 300, value: 1.5, decay: 0.014, change: 0.16, group: '原料', desc: '面包、熏肉与野果。没有食物，居民会离开。' },
        黄金: { icon: '🪙', cap: 200, value: 1, decay: 0.006, change: 0.10, group: '原料', desc: '通用货币。贸易与雇佣都靠它。' },

        /* ---------- 魔力 ---------- */
        魔力: { icon: '✨', cap: 300, group: '魔力', desc: '魔网碎片的余烬在你掌心重新凝聚。所有魔法设施都靠它运转，研究也大量消耗它。' },
        魔法知识: { icon: '📖', cap: 150, group: '魔力', desc: '符文、咒式与星图。研究科技的唯一凭据。' },

        /* ---------- 加工品 ---------- */
        铁锭: { icon: '🔩', cap: 200, value: 5, decay: 0.006, change: 0.16, group: '精炼', desc: '冶炼坊产出的标准铁料。' },
        魔晶: { icon: '💎', cap: 200, value: 8, decay: 0.005, change: 0.20, group: '精炼', desc: '凝结着魔力的晶体，能长期储存法术。' },
        符文: { icon: '🔯', cap: 200, value: 14, decay: 0.004, change: 0.24, group: '精炼', desc: '刻在石板与金属上的规则文字，是魔法的语法。' },
        秘银: { icon: '🥈', cap: 150, value: 26, decay: 0.004, change: 0.28, group: '精炼', desc: '轻若无物却坚不可摧的银色金属。' },

        /* ---------- 奥术 ---------- */
        奥术合金: { icon: '⚙️', cap: 150, value: 48, decay: 0.003, change: 0.45, group: '奥术', desc: '掺入符文的合金，是浮空与传送技术的骨架。' },
        星尘: { icon: '🌌', cap: 150, value: 95, decay: 0.003, change: 0.70, group: '奥术', desc: '从陨落星辰中研磨出的闪光粉末。' },
        以太: { icon: '🌀', cap: 150, value: 190, decay: 0.002, change: 1.10, group: '奥术', desc: '被压缩到液态的虚空介质。' },
        贤者之石: { icon: '🔴', cap: 150, value: 520, decay: 0.002, change: 1.60, group: '奥术', desc: '传说中的红色结晶，能改写物质本身。' },

        /* ---------- 行政 ---------- */
        政策点: { icon: '⚖️', cap: 300, group: '行政', desc: '议会的授权额度，用于调整国策。' },

        /* ---------- 传承资源 ---------- */
        奥术遗物: { icon: '🏛️', cap: 1e9, prestige: true, group: '传承', desc: '从崩塌的时间线里打捞出的文明残片。重置后永久保留。' },
        星辉: { icon: '⭐', cap: 1e9, prestige: true, group: '传承', desc: '星辰升华时凝出的辉光，能改写世界规则。' },
        原初之核: { icon: '🌑', cap: 1e9, prestige: true, group: '传承', desc: '大崩坏之前的原初之力，沉眠于虚空深处。' },
        归墟之烬: { icon: '🌘', cap: 1e9, prestige: true, group: '传承', desc: '世界被写回空白之后剩下的余烬。最深一层重置的产物。' },
    };

    /* 局部资源：不参与贸易与上限计算，由建筑提供与消耗 */
    const LOCAL_RESOURCES_CONFIG = {
        population: {
            name: '人口', icon: '👥',
            desc: '由居所提供的劳动力。绝大多数建筑都需要人口维持运转，人口不足时所有建筑效率会同步下降。',
        },
        power: {
            name: '军力', icon: '⚔️',
            desc: '由城防与军团建筑提供的战斗力，决定遗迹远征的成功率与可探索区域。',
        },
    };

    window.RESOURCES_CONFIG = RESOURCES_CONFIG;
    window.LOCAL_RESOURCES_CONFIG = LOCAL_RESOURCES_CONFIG;
})();
