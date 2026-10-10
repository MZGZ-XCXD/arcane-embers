/* =========================================================
   遗迹远征：派出队伍 → 等待若干游戏日 → 按军力判定成败
   远征队可以同时有多支（由遗迹英雄「门后的低语」解锁第二支）。
   遗迹限定英雄会在这里改变规则：熟悉路线、败不空手、鉴定秘宝、
   保底探宝、缩短行程、多派一队。
   ========================================================= */
(function () {
    let seq = 1;
    const M = () => window.HERO_MECHS || {};

    function findRegion(name) { return EXPEDITIONS_CONFIG.find(r => r.name === name); }

    /* 在外面的远征队 */
    function parties(state) {
        if (!Array.isArray(state.expedition.active)) state.expedition.active = [];
        return state.expedition.active;
    }
    function activeCount(state) { return parties(state).length; }
    function maxParties(state) {
        const m = M().secondParty;
        return 1 + (m && window.Heroes && Heroes.hasMech(state, 'secondParty') ? (m.extra || 1) : 0);
    }
    function masteredClears(state, region) {
        const map = state.expedition.mastery || {};
        return map[region.name] || 0;
    }
    /* 熟路带来的耗时折扣（0 ~ 上限） */
    function masteryCut(state, region) {
        const m = M().mastery;
        if (!m || !window.Heroes || !Heroes.hasMech(state, 'mastery')) return 0;
        return Math.min(m.max || 0.5, masteredClears(state, region) * (m.per || 0.05));
    }
    /* 这层遗迹的实际耗时（含熟路与「背星而行」） */
    function durationOf(state, region) {
        let days = region.days * (1 - masteryCut(state, region));
        const fast = M().fastTravel;
        if (fast && window.Heroes && Heroes.hasMech(state, 'fastTravel')) days *= (fast.mul || 0.5);
        return Math.max(1, Math.round(days));
    }

    function successChance(state, region) {
        const power = state.localResources.power.amount * (1 + EffectsManager.additive(state, 'expeditionPower'));
        const ratio = power / Math.max(1, region.power);
        return Utils.clamp(0.25 + 0.45 * Math.log10(1 + ratio * 3), 0.05, 0.98);
    }

    function canStart(state, region) {
        if (!region) return { ok: false, msg: '未知区域。' };
        const slots = maxParties(state);
        if (activeCount(state) >= slots) {
            return { ok: false, msg: slots > 1 ? '两支远征队都在外面，等它们回来。' : '远征队仍在外面。' };
        }
        if (!ResourcesManager.canAfford(region.cost)) return { ok: false, msg: '物资不足。', lack: ResourcesManager.missing(region.cost) };
        return { ok: true };
    }

    function start(state, name) {
        const region = findRegion(name);
        if (!region) return { ok: false, msg: '未知区域。' };
        const check = canStart(state, region);
        if (!check.ok) return check;
        ResourcesManager.spend(region.cost);
        const dur = durationOf(state, region);
        const party = {
            id: 'ex' + (seq++),
            region: name,
            startDay: state.gameDays,
            endDay: state.gameDays + dur,
            duration: dur,
        };
        parties(state).push(party);
        return { ok: true, msg: '远征队已出发前往「' + name + '」（预计 ' + dur + ' 日）。', party: party };
    }

    function progress(state, party) {
        if (!party) return 0;
        return Utils.clamp((state.gameDays - party.startDay) / Math.max(1e-6, party.endDay - party.startDay), 0, 1);
    }

    function remaining(state, party) {
        if (!party) return 0;
        return Math.max(0, party.endDay - state.gameDays);
    }

    function rollLoot(state, region, factor) {
        const gained = {};
        for (const res in region.loot) {
            const range = region.loot[res];
            let amount = Utils.rnd(range[0], range[1]) * factor;
            if (amount > 0) gained[res] = Math.floor(amount * 100) / 100;
        }
        if (region.relics && region.relics[1] > 0) {
            const relics = region.relics[0] + Utils.rnd(0, region.relics[1] - region.relics[0]);
            gained['奥术遗物'] = (gained['奥术遗物'] || 0) + Math.floor(relics * factor);
        }
        return gained;
    }

    /* 结算一支远征队（由主循环在到点时调用） */
    function finish(state, party) {
        const list = parties(state);
        const idx = list.indexOf(party);
        if (idx >= 0) list.splice(idx, 1);
        const region = findRegion(party.region);
        if (!region) return null;

        const noLoss = !!(M().noLoss && window.Heroes && Heroes.hasMech(state, 'noLoss'));
        const rewardMult = (1 + EffectsManager.additive(state, 'expeditionReward'));
        const chance = successChance(state, region);
        const success = Math.random() < chance;
        const factor = (success ? 1 : (noLoss ? 1 : 0.25)) * rewardMult;
        const loot = rollLoot(state, region, factor);

        /* 走熟的路线：只有成功才累积 */
        state.expedition.mastery = state.expedition.mastery || {};
        const clearsBefore = state.expedition.mastery[region.name] || 0;
        if (success) state.expedition.mastery[region.name] = clearsBefore + 1;

        /* 秘宝：原本按概率，拥有「必有所得」后每 N 次成功保底一件 */
        let artifact = null;
        if (success) {
            const pity = M().artifactPity;
            const hasPity = !!(pity && window.Heroes && Heroes.hasMech(state, 'artifactPity'));
            state.expedition.dry = (state.expedition.dry || 0) + 1;
            const base = region.artifact * Utils.clamp(1 + EffectsManager.additive(state, 'artifactQuality'), 0.5, 3);
            const guaranteed = hasPity && state.expedition.dry >= (pity.need || 5);
            if (window.Artifacts && (Math.random() < base || guaranteed)) {
                artifact = Artifacts.generate(state, region.tier);
                state.expedition.dry = 0;
            }
        }

        for (const res in loot) ResourcesManager.add({ [res]: loot[res] });

        state.stats.expeditions++;
        if (!success) state.stats.expeditionsFailed++;

        const record = {
            region: region.name,
            day: state.gameDays,
            success: success,
            chance: chance,
            loot: loot,
            artifact: artifact ? artifact.name : null,
        };
        state.expedition.history.unshift(record);
        if (state.expedition.history.length > 30) state.expedition.history.pop();

        /* 这一层遗迹的限定英雄：首次成功必得，之后还没拿到时每次成功 15% 再遇一次 */
        let heroDrop = null;
        const drop = window.Heroes ? Heroes.expeditionHeroFor(region.name) : null;
        if (success && drop && !Heroes.hasHero(state, drop.id)) {
            const firstClear = clearsBefore === 0;
            if (firstClear || Math.random() < 0.15) {
                const r = Heroes.recruit(state, drop.id);
                heroDrop = { hero: drop, isNew: !!r.isNew, relic: r.relic || 0 };
                record.hero = drop.name;
            }
        }

        const name = region.name;
        return Object.assign(record, { regionName: name, artifactObj: artifact, heroDrop: heroDrop });
    }

    window.ExpeditionEngine = {
        findRegion, successChance, canStart, start, progress, remaining, finish,
        parties, activeCount, maxParties, durationOf, masteryCut, masteredClears,
    };
})();
