/* =========================================================
   轮回祝福
   每次重置之后，从 3 个候选里选 1 个，本轮（这条时间线）内有效；
   下一次重置重新抽 —— 于是每一轮都有「这轮走哪条路」的变化。
   effect 用标准效果对象，直接参与 effects.js 的汇总（和传承、科技同一套机制）。
   ========================================================= */
(function () {
    const LIST = [];

    function BL(name, o) {
        LIST.push({
            id: o.id || name,
            name: name,
            icon: o.icon || '✦',
            desc: o.desc || '',
            effect: o.eff || {},
        });
    }

    BL('拾荒者的火种', { icon: '🔥', eff: { globalProd: 0.2 },
        desc: '废墟里刨出的第一把火。所有建筑产出 +20%。' });
    BL('灰烬之种', { icon: '🏛️', eff: { relicGain: 0.5 },
        desc: '一粒不肯熄灭的种子。重置时获得的奥术遗物 +50%。' });
    BL('学者之烛', { icon: '📖', eff: { knowledgeProd: 0.5 },
        desc: '图书馆里最后一根蜡烛。魔法知识产出 +50%。' });
    BL('商队通行证', { icon: '🪙', eff: { marketVolume: 0.8 },
        desc: '一张盖了旧章的文书。贸易规模 +80%。' });
    BL('丰饶之壤', { icon: '🌾', eff: { resourceProd: { 食物: 0.4, 木材: 0.3 } },
        desc: '土壤自己愿意长出东西。食物产出 +40%、木材产出 +30%。' });
    BL('魔网回响', { icon: '✨', eff: { resourceProd: { 魔力: 0.5 } },
        desc: '断裂的魔网还在轻轻震动。魔力产出 +50%。' });
    BL('石匠誓言', { icon: '🪨', eff: { capAll: 0.4 },
        desc: '工匠们把仓库又往上砌了一层。所有存量上限 +40%。' });
    BL('远征补给', { icon: '🧭', eff: { expeditionReward: 0.5, expeditionPower: 0.15 },
        desc: '提前把物资埋在路上了。远征收益 +50%、军力 +15%。' });
    BL('幸运符', { icon: '🍀', eff: { luck: 0.3, summonDiscount: 0.08 },
        desc: '不知道是谁塞给你的。抽卡运气 +0.3，召唤消耗 −8%。' });
    BL('工匠契约', { icon: '🔧', eff: { queueSlots: 2 },
        desc: '两队工匠愿意同时开工。建造队列 +2 个槽位。' });
    BL('时间之隙', { icon: '⏳', eff: { speed: 0.2 },
        desc: '某个角落的时间流得比别处快。世界流速 +20%。' });
    BL('秘宝猎人', { icon: '💠', eff: { artifactQuality: 0.25 },
        desc: '更懂得从废墟里挑东西。秘宝品质 +0.25。' });
    BL('人丁兴旺', { icon: '👥', eff: { populationCap: 0.4 },
        desc: '这一年出生的人格外多。人口上限 +40%。' });
    BL('民心所向', { icon: '🕊️', eff: { happiness: 150 },
        desc: '人们开始相信你真的能重建点什么。民望 +150。' });
    BL('轮回刻度', { icon: '🌌', eff: { resetGain: 0.4 },
        desc: '你看清了时间线折叠时的折痕。重置收益 +40%。' });
    BL('静默工坊', { icon: '🔮', eff: { globalCost: -0.08 },
        desc: '不用喊话工匠也知道下一步做什么。所有建筑成本增长率 −8%。' });
    BL('守夜人的灯', { icon: '🕯️', eff: { offlineHours: 2 },
        desc: '灯一直亮着，你不在的时候城市也在干活。离线结算时长 +2 小时。' });

    window.BLESSINGS_CONFIG = LIST;
})();
