/* =========================================================
   秘宝流派与套装共鸣
   每件秘宝生成时会随机带一个流派；同时装备同一流派 2 件 / 3 件时触发共鸣。
   共鸣效果也用标准效果对象，直接进入加成汇总，不需要另写一套引擎。
   3 件那一档尽量做成「机制」，而不是继续堆数值。
   ========================================================= */
(function () {
    const SETS = [
        {
            key: '炽焰', name: '炽焰', icon: '🔥', color: '#ff8f5a', desc: '炉火与焦炭之道。',
            two:   { eff: { knowledgeProd: 0.25 },                        text: '魔法知识产出 +25%' },
            three: { eff: { globalProd: 0.15 },                           text: '所有建筑产出 +15%' },
        },
        {
            key: '星界', name: '星界', icon: '🌌', color: '#7fb4ff', desc: '从陨星与星轨里读出来的东西。',
            two:   { eff: { offlineHours: 2 },                            text: '离线结算时长 +2 小时' },
            three: { eff: { expeditionReward: 0.4, expeditionPower: 0.1 }, text: '远征收益 +40%、军力 +10%' },
        },
        {
            key: '虚空', name: '虚空', icon: '🌀', color: '#c98bff', desc: '写在规则之外的文字。',
            two:   { eff: { summonDiscount: 0.1 },                        text: '召唤消耗 −10%' },
            three: { eff: { luck: 0.25 },                                 text: '抽卡运气 +0.25' },
        },
        {
            key: '生灵', name: '生灵', icon: '🌿', color: '#57d99a', desc: '活下来的东西会自己照顾自己。',
            two:   { eff: { happiness: 120 },                             text: '民望 +120' },
            three: { eff: { populationCap: 0.25 },                        text: '人口上限 +25%' },
        },
        {
            key: '金石', name: '金石', icon: '⚙️', color: '#d9c07a', desc: '不会说话，但特别结实。',
            two:   { eff: { queueSlots: 1 },                              text: '建造队列 +1 个槽位' },
            three: { eff: { globalCost: -0.05 },                          text: '所有建筑成本增长率 −5%' },
        },
    ];

    window.ARTIFACT_SETS = SETS;
})();
