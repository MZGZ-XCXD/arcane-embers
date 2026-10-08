/* =========================================================
   传承（永久强化，重置后保留）
   tree: relic(奥术遗物) / star(星辉) / core(原初之核)
   成本 = cost × costG ^ 当前等级
   ========================================================= */
(function () {
    const REG = {};
    const ORDER = [];

    function P(name, o) {
        REG[name] = {
            name: name,
            tree: o.tree,
            cost: o.cost,
            costG: o.costG || 1.7,
            max: o.max || 1,
            req: o.req || null,
            effect: o.eff || {},
            special: o.special || null,
            desc: o.desc || '',
        };
        ORDER.push(name);
    }

    /* ---------------- 奥术遗物 ---------------- */
    P('文明火种', {
        tree: 'relic', cost: 2, max: 1, eff: { startResources: 1 },
        desc: '重置后立即获得 300 木材、200 石料、100 食物与 80 魔力，让第一小时不再枯燥。',
    });
    P('智慧符文', {
        tree: 'relic', cost: 3, costG: 1.55, max: 10, eff: { knowledgeProd: 0.08 },
        desc: '刻在塔基上的引路符文。魔法知识产出每级 +8%。',
    });
    P('丰饶仪式', {
        tree: 'relic', cost: 4, costG: 1.55, max: 15, eff: { globalProd: 0.04 },
        desc: '每年举行一次的丰收仪式。所有建筑产出每级 +4%。',
    });
    P('精算式建造', {
        tree: 'relic', cost: 5, costG: 1.7, max: 8, eff: { globalCost: -0.015 },
        desc: '把每一块石头的搬运路径都算清楚。所有建筑成本增长率每级 -1.5%。',
    });
    P('遗物共鸣', {
        tree: 'relic', cost: 8, costG: 1.8, max: 10, eff: { capPerRelic: 0.012 },
        desc: '每持有 1 枚奥术遗物，所有资源上限 +1.2%（每级递增）。',
    });
    P('学识共鸣', {
        tree: 'relic', cost: 12, costG: 1.85, max: 8, eff: { knowledgeCapPerRelic: 0.15 },
        desc: '魔法知识上限随遗物数量对数增长，让后期研究不再被上限卡死。',
    });
    P('民望之赐', {
        tree: 'relic', cost: 6, costG: 1.6, max: 10, eff: { happiness: 25 },
        desc: '一道让人心情变好的祝福。民望每级 +25。',
    });
    P('远征装备', {
        tree: 'relic', cost: 10, costG: 1.6, max: 10, eff: { expeditionPower: 0.08, expeditionReward: 0.05 },
        desc: '更好的护符与补给。远征军力每级 +8%，远征收益 +5%。',
    });
    P('秘宝槽位', {
        tree: 'relic', cost: 25, costG: 3.2, max: 2, eff: { artifactSlots: 1 },
        desc: '为秘宝增设一个悬浮基座。永久 +1 个装备槽。',
    });
    P('秘宝工艺', {
        tree: 'relic', cost: 40, costG: 1.9, max: 10, eff: { artifactQuality: 0.08 },
        desc: '更精细的鉴定与镶嵌。秘宝词条数值每级 +8%，更容易出现正面词条。',
    });
    P('记忆水晶', {
        tree: 'relic', cost: 60, req: '秘宝槽位', max: 1, special: 'keepArtifacts',
        desc: '重置时保留全部秘宝与装备槽，专家级的传承投资。',
    });
    P('自动符文', {
        tree: 'relic', cost: 50, max: 1, special: 'autoBuild',
        desc: '让符文代替你按建造按钮：自动购买当前最便宜且买得起的建筑（可在设置中关闭）。',
    });
    P('自动远征', {
        tree: 'relic', cost: 90, req: '自动符文', max: 1, special: 'autoExpedition',
        desc: '远征队学会自己出发。上一支队伍归来后会立刻前往同区域。',
    });
    P('时之匙', {
        tree: 'relic', cost: 35, costG: 2.4, max: 3, eff: { speed: 0.06 },
        desc: '插入沙漏侧面的小钥匙。世界流速永久 +6%（每级递增）。',
    });
    P('永恒延长', {
        tree: 'relic', cost: 20, costG: 2.2, max: 5, eff: { offlineHours: 2 },
        desc: '离线收益时长上限 +2 小时（每级递增）。',
    });
    P('工坊扩建', {
        tree: 'relic', cost: 12, costG: 2.1, max: 4, eff: { queueSlots: 1 },
        desc: '在塔基下再挖出几间工坊。建造队列 +1 个槽位（每级递增）。',
    });
    P('疾速施工', {
        tree: 'relic', cost: 8, costG: 1.85, max: 6, eff: { queueSpeed: 0.12 },
        desc: '把吊臂与滑轮组重新设计一遍。建造与研究的耗时每级 −10.7%（等价于速度 +12%）。',
    });
    P('召唤精通', {
        tree: 'relic', cost: 15, costG: 1.9, max: 8, eff: { heroPower: 0.15 },
        desc: '你更懂如何让英雄发挥全力。所有英雄的效果每级 +15%。',
    });
    P('命运微光', {
        tree: 'relic', cost: 18, costG: 2.0, max: 6, eff: { luck: 0.2, summonDiscount: 0.05 },
        desc: '在传送阵边缘点上一圈微光。召唤运气每级 +0.2，消耗每级 −5%。',
    });

    /* ---------------- 星辉 ---------------- */
    P('星辉灌注', {
        tree: 'star', cost: 2, costG: 1.6, max: 12, eff: { globalProd: 0.25 },
        desc: '让星辉流进每一座建筑的地基。所有建筑产出每级 +25%。',
    });
    P('星轨计算', {
        tree: 'star', cost: 3, costG: 1.6, max: 12, eff: { knowledgeProd: 0.4 },
        desc: '按星轨排课。魔法知识产出每级 +40%。',
    });
    P('空间折叠', {
        tree: 'star', cost: 4, costG: 1.7, max: 12, eff: { capAll: 0.5 },
        desc: '所有仓库内部空间翻倍再翻倍。存量上限每级 +50%。',
    });
    P('文明薪火', {
        tree: 'star', cost: 6, costG: 2.2, max: 3, special: 'autoTech',
        desc: '重置后自动完成第一时代的科技。1 级：拾荒；2 级：再加搭建帐篷/伐木/采石；3 级：整个第一时代。',
    });
    P('星界庇护', {
        tree: 'star', cost: 5, costG: 1.7, max: 10, eff: { happiness: 80 },
        desc: '一层看不见的屋顶，挡风也挡坏消息。民望每级 +80。',
    });
    P('生命之泉', {
        tree: 'star', cost: 8, costG: 1.8, max: 10, eff: { populationCap: 0.15 },
        desc: '清泉让居民愿意留下更多孩子。人口上限每级 +15%。',
    });
    P('星辉熔炉', {
        tree: 'star', cost: 7, costG: 1.75, max: 10, eff: { resourceProd: { 魔力: 0.6 } },
        desc: '魔力产出每级 +60%。魔力是后期一切系统的血液。',
    });
    P('灵魂共鸣', {
        tree: 'star', cost: 10, costG: 1.8, max: 10, eff: { relicGain: 0.25 },
        desc: '重置获得的奥术遗物每级 +25%。',
    });
    P('双倍远征', {
        tree: 'star', cost: 9, costG: 1.8, max: 10, eff: { expeditionReward: 0.3, expeditionPower: 0.1 },
        desc: '远征收益每级 +30%，军力 +10%。冒险终于成了生意。',
    });
    P('永恒律动', {
        tree: 'star', cost: 15, costG: 2.3, max: 5, eff: { speed: 0.1 },
        desc: '世界流速每级 +10%。',
    });
    P('并行法阵', {
        tree: 'star', cost: 4, costG: 2.4, max: 3, eff: { queueSlots: 2 },
        desc: '让同一座城市的两个瞬间同时开工。建造队列 +2 个槽位（每级递增）。',
    });
    P('时间折叠', {
        tree: 'star', cost: 4, costG: 2.2, max: 5, eff: { queueSpeed: 0.2 },
        desc: '把工期折起来。建造与研究速度每级 +20%。',
    });
    P('星界召唤', {
        tree: 'star', cost: 6, costG: 2.1, max: 6, eff: { heroPower: 0.4 },
        desc: '让传送阵连到更远的星界。所有英雄的效果每级 +40%。',
    });
    P('命运编织', {
        tree: 'star', cost: 7, costG: 2.2, max: 5, eff: { luck: 0.5, summonDiscount: 0.08 },
        desc: '亲手编一段更好的运气。召唤运气每级 +0.5，召唤消耗每级 −8%。',
    });

    /* ---------------- 原初之核 ---------------- */
    P('原初之力', {
        tree: 'core', cost: 1, costG: 2.0, max: 5, eff: { globalProd: 1.0 },
        desc: '世界第一次被书写时的力道。所有建筑产出每级 +100%。',
    });
    P('完美效率', {
        tree: 'core', cost: 2, max: 1, special: 'perfectEfficiency',
        desc: '人口永远充足：所有建筑不再因人手不足而降低效率。',
    });
    P('无尽知识', {
        tree: 'core', cost: 2, costG: 2.4, max: 5, special: 'knowledgeCapMult',
        desc: '魔法知识上限 ×3（每级再 ×3）。研究不再被人为的上限拦下。',
    });
    P('轮回加速', {
        tree: 'core', cost: 3, costG: 2.2, max: 5, eff: { resetGain: 0.5 },
        desc: '每次重置获得的遗物、星辉与原初之核每级 +50%。',
    });
    P('因果抹除', {
        tree: 'core', cost: 3, costG: 2.4, max: 3, eff: { globalCost: -0.03 },
        desc: '把建造过程中的冗余直接从未发生。成本增长率每级 -3%。',
    });
    P('虚空自转', {
        tree: 'core', cost: 5, max: 1, special: 'offlinePerfect',
        desc: '你不在时，城市依然以全效率运转：离线收益不再打 50% 折扣。',
    });
    P('万界共鸣', {
        tree: 'core', cost: 2, costG: 2.5, max: 3, eff: { heroPower: 1.0, queueSlots: 2 },
        desc: '让所有时间线的英雄同时回应你：英雄效果每级 +100%，建造队列每级 +2 槽位。',
    });

    window.PERMANENT_CONFIG = REG;
    window.PERMANENT_ORDER = ORDER;
})();
