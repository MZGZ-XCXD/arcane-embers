/* =========================================================
   随机事件
   E(id, { weight, once, require(state), minDay, title, text, choices:[{text, hint, run(api)}] })
   api 提供：give / take / happy / buff / log / artifact / state / rnd / has
   ========================================================= */
(function () {
    const LIST = [];

    function E(o) {
        LIST.push({
            id: o.id, title: o.title, text: o.text,
            weight: o.weight || 10, once: !!o.once,
            minDay: o.minDay || 0,
            require: o.require || (() => true),
            choices: o.choices,
        });
    }

    E({
        id: 'wandering_apprentice', weight: 12, title: '迷途的学徒',
        text: '一个瘦削的年轻人站在你塔下，抱着一本被雨泡烂的咒式笔记。他说他走了十四天，只为了找个还肯教人施法的地方。',
        choices: [
            {
                text: '收留他', hint: '民望 +15，知识产出提升 5 分钟',
                run: a => { a.happy(15); a.buff('apprentice', '学徒热忱', 300, { knowledgeProd: 0.15 }, '新学徒让整座塔都在讨论咒式'); a.log('你收留了迷途的学徒。'); },
            },
            {
                text: '给他一些干粮就让他走', hint: '消耗 60 食物，获得 150 黄金',
                cost: { 食物: 60 },
                run: a => { a.take({ 食物: 60 }); a.give({ 黄金: 150 }); a.log('学徒留下了一枚旧金币作为感谢。'); },
            },
        ],
    });

    E({
        id: 'beast_tide', weight: 10, minDay: 60, title: '兽潮',
        text: '森林边缘的魔物开始成批向城市移动。它们不叫，只是沉默地走过来。',
        require: s => s.buildings['石砌城墙'].count > 0 || s.localResources.power.amount > 0,
        choices: [
            {
                text: '出兵迎击', hint: '需要 30 军力；成功则民望 +25 与大量材料',
                needPower: 30,
                run: a => {
                    if (a.state.localResources.power.amount < 30) { a.log('军力不足，兽群冲进了城郊。'); a.happy(-20); return; }
                    a.give({ 木材: 400, 石料: 300, 食物: 200 });
                    a.happy(25);
                    a.log('卫队把兽群拦在了城墙外，带回大量兽骨与皮革。');
                },
            },
            {
                text: '加固城墙，闭门不出', hint: '消耗 500 石料，民望 +5',
                cost: { 石料: 500 },
                run: a => { a.take({ 石料: 500 }); a.happy(5); a.log('连夜加固城墙，兽群在墙外徘徊三日后退去。'); },
            },
        ],
    });

    E({
        id: 'meteor', weight: 8, minDay: 120, title: '陨石坠落',
        text: '夜空被划开一道亮线。落点在城市东侧三里，土还是烫的。',
        choices: [
            {
                text: '组织回收', hint: '获得星尘与铁矿',
                run: a => { a.give({ 星尘: 60, 铁矿: 400, 石料: 300 }); a.log('从陨石坑里取出大量闪光碎屑。'); },
            },
            {
                text: '在落点建造观测阵', hint: '消耗 500 木材、300 石料；获得持续的知识加成',
                cost: { 木材: 500, 石料: 300 },
                run: a => { a.take({ 木材: 500, 石料: 300 }); a.buff('meteor_watch', '陨石观测阵', 480, { knowledgeProd: 0.25 }, '观测阵持续记录陨石残留的魔力'); a.log('观测阵开始运转。'); },
            },
        ],
    });

    E({
        id: 'plague', weight: 9, minDay: 200, title: '灰咳病',
        text: '一种止不住的咳嗽在居民区扩散。医者说，病来自城墙外的灰尘。',
        choices: [
            {
                text: '封锁病区，全力救治', hint: '消耗 800 食物、300 魔力；民望 +10',
                cost: { 食物: 800, 魔力: 300 },
                run: a => { a.take({ 食物: 800, 魔力: 300 }); a.happy(10); a.log('病区被及时封锁，疫情在一月内平息。'); },
            },
            {
                text: '继续照常生活', hint: '民望 -35，产出短时下降',
                run: a => { a.happy(-35); a.buff('plague', '灰咳病流行', 300, { globalProd: -0.2 }, '大量居民病倒'); a.log('疫情扩散，街上的人明显少了。'); },
            },
        ],
    });

    E({
        id: 'caravan', weight: 12, minDay: 90, title: '远方商队',
        text: '一支挂着七面不同旗帜的商队停在集市外。他们带来了南方的香料和北方的铁器，也想带点东西走。',
        choices: [
            {
                text: '正常交易', hint: '按市场价卖出木材与石料，换取黄金',
                run: a => { a.give({ 黄金: 600 }); a.log('商队带走了三百车木石，留下满满一箱黄金。'); },
            },
            {
                text: '征收高额入城税', hint: '获得 1800 黄金，民望 -12',
                run: a => { a.give({ 黄金: 1800 }); a.happy(-12); a.log('商队交了税，但离开时没有人向你道别。'); },
            },
            {
                text: '用黄金换他们的藏书', hint: '消耗 800 黄金，获得魔法知识与符文',
                cost: { 黄金: 800 },
                run: a => { a.take({ 黄金: 800 }); a.give({ 魔法知识: 400, 符文: 60 }); a.log('你买下了商队所有的旧书与破损符板。'); },
            },
        ],
    });

    E({
        id: 'stone_tablet', weight: 9, minDay: 150, title: '古老的石碑',
        text: '石匠在采石场挖出一块刻满反向符文的碑。它让靠近的人耳朵里响起同一个音。',
        choices: [
            {
                text: '组织学者解读', hint: '消耗 300 魔法知识，获得奥术遗物',
                cost: { 魔法知识: 300 },
                run: a => { a.take({ 魔法知识: 300 }); a.give({ 奥术遗物: 3 }); a.log('碑文被译出一小段——它记录的正是大崩坏当天。'); },
            },
            {
                text: '砸开用作建材', hint: '获得 2000 石料',
                run: a => { a.give({ 石料: 2000 }); a.log('石碑被砸成石块，那个声音消失了。'); },
            },
        ],
    });

    E({
        id: 'mana_tide', weight: 11, minDay: 30, title: '魔力潮汐',
        text: '秋分这天，空气里的魔力浓得像雾。孩子们在街上追着发光的浮尘跑。',
        choices: [
            {
                text: '全城收集', hint: '立刻获得大量魔力，持续 5 分钟',
                run: a => { a.give({ 魔力: 800 }); a.buff('mana_tide', '魔力潮汐', 300, { resourceProd: { 魔力: 0.6 } }, '潮汐期间魔力产出大幅提升'); a.log('全城的水缸都装满了魔力。'); },
            },
            {
                text: '让学徒在潮汐中练习', hint: '持续 8 分钟知识产出 +30%，但民望 -5',
                run: a => { a.happy(-5); a.buff('tide_train', '潮汐特训', 480, { knowledgeProd: 0.3 }, '学徒们在魔力潮汐中密集练习'); a.log('塔里连续八天都亮着灯。'); },
            },
        ],
    });

    E({
        id: 'net_unstable', weight: 8, minDay: 120, title: '魔网紊乱',
        text: '魔网节点突然开始波动，魔力管道里发出类似呻吟的声音。',
        choices: [
            {
                text: '投入魔力稳定网络', hint: '消耗 1500 魔力，避免损失',
                cost: { 魔力: 1500 },
                run: a => { a.take({ 魔力: 1500 }); a.log('你亲自下场稳定了魔网，管道重新安静下来。'); },
            },
            {
                text: '暂时无视', hint: '魔力产出短时大幅下降',
                run: a => { a.buff('net_wobble', '魔网紊乱', 240, { resourceProd: { 魔力: -0.4 } }, '魔网持续波动'); a.log('魔网继续紊乱，井里涌出的魔力时多时少。'); },
            },
        ],
    });

    E({
        id: 'harvest', weight: 11, minDay: 80, title: '难得的丰收',
        text: '今年的麦穗压弯了整片田。农人们在田埂上跳了整整一夜的舞。',
        choices: [
            {
                text: '全部入库', hint: '获得大量食物',
                run: a => { a.give({ 食物: 2500 }); a.log('粮仓被填满，冬天不用再担心。'); },
            },
            {
                text: '举办丰收祭', hint: '民望 +30，产出提升 5 分钟',
                run: a => { a.happy(30); a.buff('festival', '丰收祭', 300, { globalProd: 0.15 }, '全城都在庆祝'); a.log('丰收祭持续了三天，工匠们干活的劲头比平时足。'); },
            },
        ],
    });

    E({
        id: 'winter', weight: 10, minDay: 150, title: '严冬',
        text: '今年冬天比记忆中任何一个都冷。城墙上的火把也会被风吹灭。',
        choices: [
            {
                text: '全力供暖', hint: '消耗 1200 木炭，民望 +10',
                cost: { 木炭: 1200 },
                run: a => { a.take({ 木炭: 1200 }); a.happy(10); a.log('每家每户都分到了炭。冬天很冷，但没人冻着。'); },
            },
            {
                text: '节约燃料', hint: '民望 -25，生产短时下降',
                run: a => { a.happy(-25); a.buff('cold_winter', '严冬', 360, { globalProd: -0.15 }, '寒冷让工匠们手脚发僵'); a.log('居民蜷在屋里，工地几乎停摆。'); },
            },
        ],
    });

    E({
        id: 'bandits', weight: 9, minDay: 100, title: '盗匪',
        text: '一伙逃兵占住了山道，专抢运往城市的材料。',
        choices: [
            {
                text: '派兵清剿', hint: '需要 50 军力；获得黄金与民望',
                needPower: 50,
                run: a => {
                    if (a.state.localResources.power.amount < 50) { a.log('兵力不足，山道依旧不安全。'); a.happy(-8); return; }
                    a.give({ 黄金: 900 }); a.happy(18); a.log('盗匪被清剿，山道重新通畅。');
                },
            },
            {
                text: '交赎金', hint: '消耗 700 黄金',
                cost: { 黄金: 700 },
                run: a => { a.take({ 黄金: 700 }); a.log('赎金交了出去。商队暂时安全，但这种事还会有下次。'); },
            },
        ],
    });

    E({
        id: 'rune_surge', weight: 7, minDay: 250, title: '符文暴走',
        text: '符文作坊的一整批符板同时发亮。工匠们已经撤出来了——没人敢靠近。',
        require: s => s.buildings['符文作坊'].count > 0,
        choices: [
            {
                text: '亲自压制', hint: '消耗 400 魔力，获得 300 符文',
                cost: { 魔力: 400 },
                run: a => { a.take({ 魔力: 400 }); a.give({ 符文: 300 }); a.log('你把失控的咒式重新排序，反而得到了一批上等符文。'); },
            },
            {
                text: '让它们烧完', hint: '损失部分符文，作坊短时停摆',
                cost: { 符文: 80 },
                run: a => { a.take({ 符文: 80 }); a.buff('rune_fire', '作坊停摆', 180, { 符文作坊: { prod: -0.8 } }, '作坊在重修'); a.log('火熄之后，作坊只剩一片焦痕。'); },
            },
        ],
    });

    E({
        id: 'lost_blueprint', weight: 10, minDay: 180, title: '遗失的图纸',
        text: '拆掉一面旧墙时，工人从夹层里抽出一卷羊皮纸——是崩坏前某座工坊的全套图纸。',
        choices: [
            {
                text: '交给学院研究', hint: '获得大量魔法知识',
                run: a => { a.give({ 魔法知识: 1200 }); a.log('图纸被整理成三十七册，学院为此停课三天。'); },
            },
            {
                text: '直接按图建造', hint: '获得材料，产出提升 5 分钟',
                run: a => { a.give({ 铁锭: 400, 木炭: 600 }); a.buff('blueprint', '旧世工艺', 300, { globalProd: 0.1 }, '按旧图纸改造的生产线'); a.log('按照图纸改造的生产线效率明显更高。'); },
            },
        ],
    });

    E({
        id: 'fae', weight: 8, minDay: 300, title: '妖精的挑衅',
        text: '一群翅膀薄如纸的妖精每晚都来把晾在架子上的符文石换个位置。它们觉得这很有趣。',
        choices: [
            {
                text: '摆一桌蜂蜜谈判', hint: '消耗 300 食物；获得持续增益',
                cost: { 食物: 300 },
                run: a => { a.take({ 食物: 300 }); a.buff('fae_pact', '妖精的承诺', 600, { globalProd: 0.12, happiness: 30 }, '妖精答应不再捣乱，还顺手做了点小事'); a.log('妖精们把蜂蜜带走了，临走时在墙上画了个笑脸。'); },
            },
            {
                text: '设陷阱驱赶', hint: '民望 -10，但立刻获得黄金奖励',
                run: a => { a.happy(-10); a.give({ 黄金: 500 }); a.log('陷阱抓住了两只妖精，它们留下的金粉换了一笔钱。'); },
            },
        ],
    });

    E({
        id: 'refugees', weight: 10, minDay: 220, title: '难民潮',
        text: '三百多人从更北的地方走来。他们的城市在上个月被魔物踏平了。',
        choices: [
            {
                text: '全部接纳', hint: '消耗 1500 食物，民望 +35，人口上限短时提升',
                cost: { 食物: 1500 },
                run: a => { a.take({ 食物: 1500 }); a.happy(35); a.buff('refugees', '新的居民', 900, { populationCap: 0.2 }, '难民在城中安顿下来'); a.log('三百多人留了下来，其中一半是能干活的人。'); },
            },
            {
                text: '只收留工匠与孩子', hint: '民望 +5，获得黄金',
                run: a => { a.happy(5); a.give({ 黄金: 400 }); a.log('你收留了最有用的那部分，送走了其余的人。'); },
            },
            {
                text: '关闭城门', hint: '民望 -30',
                run: a => { a.happy(-30); a.log('城门关上了。第二天早上，外面只剩下雪和脚印。'); },
            },
        ],
    });

    E({
        id: 'element_stir', weight: 8, minDay: 350, title: '元素骚动',
        text: '祭坛上的三种元素同时抗议。它们说，你最近向它们索取得太多了。',
        require: s => ['火之祭坛', '水之祭坛', '土之祭坛'].some(n => s.buildings[n] && s.buildings[n].count > 0),
        choices: [
            {
                text: '举行安抚仪式', hint: '消耗 5000 魔力，获得持续增益',
                cost: { 魔力: 5000 },
                run: a => {
                    a.take({ 魔力: 5000 });
                    a.buff('element_calm', '元素的满意', 600, {
                        火之祭坛: { prod: 0.35 }, 水之祭坛: { prod: 0.35 }, 土之祭坛: { prod: 0.35 }, happiness: 20,
                    }, '元素重新愿意配合');
                    a.log('仪式之后，祭坛的火安静地燃烧着。');
                },
            },
            {
                text: '用契约压制它们', hint: '祭坛产量短时下降，但获得材料',
                run: a => {
                    a.give({ 石料: 20000 });
                    a.buff('element_anger', '元素的怒气', 300, {
                        火之祭坛: { prod: -0.5 }, 水之祭坛: { prod: -0.5 }, 土之祭坛: { prod: -0.5 },
                    }, '元素拒绝配合');
                    a.log('元素服从了，但土从祭坛里喷了出来——正好能当建材。');
                },
            },
        ],
    });

    E({
        id: 'ancient_guardian', weight: 6, minDay: 500, title: '远古守卫苏醒',
        text: '城郊的地面裂开，一具浑身符文的石制守卫站了起来。它看着你的城市，没有立刻攻击。',
        choices: [
            {
                text: '以军力击破它', hint: '需要 800 军力；获得遗物与大量材料',
                needPower: 800,
                run: a => {
                    if (a.state.localResources.power.amount < 800) { a.log('军力不足。守卫在城郊大闹一场后自行停摆。'); a.happy(-15); return; }
                    a.give({ 奥术遗物: 40, 奥术合金: 600, 符文: 1500 });
                    a.log('守卫的核心被取出，那是一枚仍然发亮的遗物。');
                },
            },
            {
                text: '尝试与它沟通', hint: '消耗 20000 魔力；成功则获得丰厚奖励',
                cost: { 魔力: 20000 },
                run: a => {
                    a.take({ 魔力: 20000 });
                    if (a.rnd() < 0.6) { a.give({ 奥术遗物: 80 }); a.happy(40); a.buff('guardian_peace', '守卫的守护', 900, { globalProd: 0.2 }, '守卫同意留在城外看护道路'); a.log('它用古老的语言说了一个词，然后单膝跪下。'); }
                    else { a.happy(-10); a.log('它没有回应你，转身走回了裂缝里。'); }
                },
            },
        ],
    });

    E({
        id: 'time_ripple', weight: 6, minDay: 700, title: '时间涟漪',
        text: '钟楼上所有的钟同时敲响，但没有任何一只手碰过它们。你感到整座城市慢了半拍。',
        choices: [
            {
                text: '顺着涟漪推一把', hint: '获得 12 分钟的巨额加成，随后短时减速',
                run: a => { a.buff('time_boost', '时间顺流', 720, { globalProd: 0.5, speed: 0.3 }, '城市处于时间顺流之中'); a.buff('time_back', '时间反噬', 180, { globalProd: -0.3 }, '时间开始索要代价'); a.log('你推了一把，整座城市的工作效率突然暴涨。'); },
            },
            {
                text: '记录并躲避', hint: '获得魔法知识与星尘',
                run: a => { a.give({ 魔法知识: 80000, 星尘: 1500 }); a.log('你记录下完整的涟漪数据——这本身就是巨大的收获。'); },
            },
        ],
    });

    E({
        id: 'tree_whisper', weight: 6, minDay: 1200, title: '世界树的低语',
        text: '世界树的幼枝在夜里发出极轻的声音。你听懂了其中一句：还有别的城市也活了下来。',
        require: s => s.buildings['世界树幼枝'].count > 0,
        choices: [
            {
                text: '回应它', hint: '消耗 300 星尘，获得奥术遗物',
                cost: { 星尘: 300 },
                run: a => { a.take({ 星尘: 300 }); a.give({ 奥术遗物: 2000 }); a.log('你对着树说了你的名字。它记住了。'); },
            },
            {
                text: '让它继续生长', hint: '所有产出提升 15 分钟',
                run: a => { a.buff('tree_growth', '世界树的生长', 900, { globalProd: 0.35, happiness: 150 }, '世界树在快速舒展枝叶'); a.log('幼枝在一夜之间长高了三层楼。'); },
            },
        ],
    });

    window.EVENTS_CONFIG = LIST;
})();
