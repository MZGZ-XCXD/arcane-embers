/* 主循环：推进游戏时间、结算生产、触发事件与远征 */
(function () {
    const state = GameState;
    let last = 0;
    let acc = 0;
    let autosaveAcc = 0;
    let secondAcc = 0;
    let renderAcc = 0;
    let running = false;
    let autoBuildAcc = 0;

    function advance(dt) {
        if (dt <= 0) return;
        const speed = state.speed || 1;
        const gdt = dt * speed;

        TradeEngine.tick(state, gdt);
        ProductionEngine.computeProductionAndCaps(state);

        for (const k in state.resources) {
            const r = state.resources[k];
            if (Math.abs(r.production) < 1e-12) continue;
            r.amount += r.production * gdt;
            if (RESOURCES_CONFIG[k].prestige) {
                if (r.amount < 0) r.amount = 0;
            } else {
                if (r.amount < 0) r.amount = 0;
                if (r.amount > r.cap) r.amount = r.cap;
            }
        }

        state.gameDays += gdt;
        state.stats.playSeconds += dt;

        /* 建造队列结算 */
        if (window.QueueEngine) QueueEngine.tick(state);

        /* 远征结算 */
        if (state.expedition.active && state.gameDays >= state.expedition.active.endDay) {
            const result = ExpeditionEngine.finish(state);
            if (result) {
                const lootText = Object.keys(result.loot).map(k => Utils.fmtNum(result.loot[k]) + ' ' + k).join('、');
                EventEngine.addLog(state, (result.success ? '⚔️ 远征「' + result.regionName + '」成功' : '🏳️ 远征「' + result.regionName + '」失败') +
                    '，带回：' + (lootText || '几乎没有东西'));
                if (window.UI && UI.toast) UI.toast((result.success ? '⚔️ 远征成功：' : '🏳️ 远征受挫：') + result.regionName, result.success ? 'gold' : 'bad');
                if (result.artifactObj) {
                    Artifacts.addToInventory(state, result.artifactObj);
                    EventEngine.addLog(state, '💠 发现秘宝「' + result.artifactObj.name + '」！');
                    if (window.UI && UI.toast) UI.toast('💠 发现秘宝：' + result.artifactObj.name, 'gold');
                }
                ProductionEngine.computeProductionAndCaps(state);
            }
        }

        EventEngine.tick(state, gdt);
    }

    function tick(now) {
        if (!running) return;
        const dtReal = last ? Math.min(1.5, (now - last) / 1000) : 0;
        last = now;

        if (!state.paused) {
            /* 分段推进，保证计算稳定 */
            acc += dtReal;
            let guard = 0;
            while (acc > 0.0001 && guard++ < 40) {
                const step = Math.min(0.1, acc);
                advance(step);
                acc -= step;
            }
            secondAcc += dtReal;
            if (secondAcc >= 1) {
                secondAcc = 0;
                AchievementEngine.check(state);
                const stars = Actions.activeStars(state);
                if (stars > state.stats.maxChallengeStars) state.stats.maxChallengeStars = stars;
                state.stats.peakPopulation = Math.max(state.stats.peakPopulation || 0, state.localResources.population.capacity);
                state.stats.peakKnowledge = Math.max(state.stats.peakKnowledge || 0, state.resources['魔法知识'].cap);
            }
            autoBuildAcc += dtReal;
            if (autoBuildAcc >= 0.5) {
                autoBuildAcc = 0;
                Actions.autoBuildStep(state);
                Actions.autoExpeditionStep(state);
            }
            autosaveAcc += dtReal;
            if (autosaveAcc >= 25 && state.settings.autosave) {
                autosaveAcc = 0;
                SaveEngine.save(state);
            }
        }

        renderAcc += dtReal;
        if (renderAcc >= 0.1) {
            renderAcc = 0;
            if (window.UI && UI.render) UI.render();
        }
        requestAnimationFrame(tick);
    }

    function start() {
        if (running) return;
        running = true;
        last = 0;
        requestAnimationFrame(tick);
    }

    window.GameLoop = { start, advance, get running() { return running; } };
})();
