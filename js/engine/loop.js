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
    const seenErrors = {};

    /* 单帧出错不应该让整个 requestAnimationFrame 链断掉（否则玩家看到的就是「卡死，要刷新」） */
    function safeCall(tag, fn) {
        try { fn(); }
        catch (err) {
            const key = tag + ':' + (err && err.message ? err.message : String(err));
            if (!seenErrors[key]) {
                seenErrors[key] = 1;
                console.error('[主循环] ' + tag + ' 出错：', err);
                if (window.UI && UI.toast) UI.toast('内部错误，已跳过这一帧（详情见控制台）。', 'bad');
            }
        }
    }

    function advance(dt) {
        if (dt <= 0) return;
        const speed = state.speed || 1;
        const gdt = dt * speed;

        TradeEngine.tick(state, gdt);
        ProductionEngine.computeProductionAndCaps(state);

        for (const k in state.resources) {
            const r = state.resources[k];
            /* 兜底自愈：历史上被 NaN 污染过的存档（例如拿没有市价的资源去交易）
               会在这里被清回 0，玩家不必重新开始。 */
            if (!isFinite(r.amount)) r.amount = 0;
            if (!isFinite(r.production)) r.production = 0;
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
                safeCall('advance', () => advance(step));
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
            if (window.UI && UI.render) safeCall('render', () => UI.render());
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
