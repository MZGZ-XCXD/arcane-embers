/* =========================================================
   成就（自动检测解锁，附带永久被动）
   A(id, 名称, 说明, 条件(state), 效果, 效果文本)
   ========================================================= */
(function () {
    const LIST = [];

    function A(id, desc, cond, eff, effText) {
        LIST.push({ id: id, name: id, desc: desc, cond: cond, effect: eff || {}, effectText: effText || '' });
    }

    A('第一块石头', '建造第一座拾荒棚。',
        s => s.buildings['拾荒棚'].count >= 1, {}, '');
    A('有屋顶的地方', '让 20 名居民住进你的城市。',
        s => s.localResources.population.capacity >= 20, { happiness: 10 }, '民望 +10');
    A('魔力苏醒', '第一次让魔力产量达到 1/日。',
        s => (s.resources['魔力'].production || 0) >= 1, { resourceProd: { 魔力: 0.05 } }, '魔力产出 +5%');
    A('识字的人', '研究「抄写术」并积累 100 魔法知识。',
        s => s.techs['抄写术'].researched && s.resources['魔法知识'].amount >= 100, { knowledgeProd: 0.05 }, '魔法知识产出 +5%');
    A('学院建立', '进入学院时代。',
        s => s.techs['咒法学'].researched, { globalProd: 0.03 }, '所有建筑产出 +3%');
    A('铁与火', '让铁锭产量达到 5/日。',
        s => (s.resources['铁锭'].production || 0) >= 5, { 冶炼坊: { prod: 0.1 } }, '冶炼坊 +10%');
    A('千人之城', '人口上限达到 1000。',
        s => s.localResources.population.capacity >= 1000, { populationCap: 0.1 }, '人口上限 +10%');
    A('知识的重量', '魔法知识存量上限达到 10000。',
        s => s.resources['魔法知识'].cap >= 10000, { knowledgeProd: 0.15 }, '魔法知识产出 +15%');
    A('浮空之城', '进入高塔时代。',
        s => s.techs['浮空石'].researched, { globalProd: 0.05 }, '所有建筑产出 +5%');
    A('星辰的碎片', '让星尘产量达到 1/日。',
        s => (s.resources['星尘'].production || 0) >= 1, { 星尘研磨坊: { prod: 0.1 } }, '星尘研磨坊 +10%');
    A('以太之滴', '第一次获得以太。',
        s => s.resources['以太'].amount >= 1, { resourceProd: { 以太: 0.1 } }, '以太产出 +10%');
    A('贤者之梦', '获得第一枚贤者之石。',
        s => s.resources['贤者之石'].amount >= 1, { globalProd: 0.1 }, '所有建筑产出 +10%');
    A('星界之门', '进入星界时代。',
        s => s.techs['星界航行'].researched, { speed: 0.03 }, '世界流速 +3%');
    A('第一次回响', '完成一次「时空回响」重置。',
        s => s.stats.resets.relic >= 1, { relicGain: 0.05 }, '奥术遗物获取 +5%');
    A('十次轮回', '累计完成 10 次重置。',
        s => (s.stats.resets.relic + s.stats.resets.star + s.stats.resets.core) >= 10, { globalProd: 0.08 }, '所有建筑产出 +8%');
    A('星辉初现', '完成一次「星辰升华」。',
        s => s.stats.resets.star >= 1, { knowledgeProd: 0.2 }, '魔法知识产出 +20%');
    A('原初回响', '完成一次「原初归寂」。',
        s => s.stats.resets.core >= 1, { globalProd: 0.25, globalCost: -0.01 }, '所有建筑产出 +25%，成本增长率 -1%');
    A('万民欢腾', '民望达到 400。',
        s => s.happiness >= 400, { happiness: 40 }, '民望 +40');
    A('考古学家', '完成 20 次远征。',
        s => s.stats.expeditions >= 20, { expeditionReward: 0.1 }, '远征收益 +10%');
    A('秘宝收藏家', '同时装备 5 件秘宝（需要传承扩展槽位）。',
        s => s.artifacts.equipped.filter(Boolean).length >= 5, { artifactQuality: 0.1 }, '秘宝品质 +10%');
    A('挑战者', '同时激活 3 个试炼并完成一次重置。',
        s => s.stats.maxChallengeStars >= 3, { relicGain: 0.1 }, '奥术遗物获取 +10%');
    A('虚空观测者', '进入虚空时代。',
        s => s.techs['虚空撕裂'].researched, { globalProd: 0.3 }, '所有建筑产出 +30%');
    A('长夜之后', '累计游戏时长达到 24 小时。',
        s => s.stats.playSeconds >= 86400, { happiness: 50, knowledgeProd: 0.1 }, '民望 +50，魔法知识 +10%');
    A('初次召唤', '在传送阵完成第一次召唤。',
        s => s.heroes && s.heroes.pulls >= 1, { happiness: 10 }, '民望 +10');
    A('幸运之子', '召唤到第一位 S 级英雄。',
        s => s.heroes && (s.heroes.byRarity.S || 0) >= 1, { luck: 0.1 }, '召唤运气 +0.1');
    A('神话降临', '召唤到第一位 EX 级英雄。',
        s => s.heroes && (s.heroes.byRarity.EX || 0) >= 1, { heroPower: 0.15 }, '英雄效果 +15%');
    A('英雄殿堂', '收集 15 位不同的英雄。',
        s => s.heroes && Object.keys(s.heroes.owned).length >= 15, { heroPower: 0.1 }, '英雄效果 +10%');
    A('工坊大师', '把建造队列扩展到 8 个槽位。',
        s => window.QueueEngine && QueueEngine.slots(s) >= 8, { queueSpeed: 0.08 }, '建造与研究速度 +8%');
    A('城建大师', '累计建成 300 座建筑。',
        s => (s.stats.totalBuildingBuilt || 0) >= 300, { queueSpeed: 0.05 }, '建造与研究速度 +5%');

    window.ACHIEVEMENTS_CONFIG = LIST;
})();
