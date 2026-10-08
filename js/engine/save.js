/* 存档：本地存储、导入导出、离线收益 */
(function () {
    const SAVE_KEY = 'magic-rebuilder-save';

    function serialize(state) {
        const data = {};
        for (const k in state) {
            if (k === 'effects') continue;
            data[k] = state[k];
        }
        data.lastSave = Date.now();
        return JSON.stringify(data);
    }

    function save(state) {
        try {
            localStorage.setItem(SAVE_KEY, serialize(state));
            state.lastSave = Date.now();
            return true;
        } catch (e) {
            console.warn('保存失败', e);
            return false;
        }
    }

    function hasSave() {
        try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
    }

    /* 把存档数据应用到全局状态（缺失字段用默认值补齐） */
    function applyData(state, data) {
        initState();
        for (const k in data) {
            if (k === 'effects') continue;
            state[k] = data[k];
        }
        /* 兼容新增内容 */
        for (const k in RESOURCES_CONFIG) {
            if (!state.resources[k]) state.resources[k] = { amount: 0, cap: RESOURCES_CONFIG[k].cap, baseCap: RESOURCES_CONFIG[k].cap, production: 0, visible: false };
        }
        for (const k in BUILDINGS_CONFIG) {
            if (!state.buildings[k]) state.buildings[k] = { count: 0, active: 0, visible: false, locked: false, price: {}, efficiency: 1, mode: 0 };
            else if (typeof state.buildings[k].mode !== 'number') state.buildings[k].mode = 0;
        }
        for (const k in TECHS_CONFIG) if (!state.techs[k]) state.techs[k] = { researched: false, visible: false };
        for (const k in UPGRADES_CONFIG) if (!state.upgrades[k]) state.upgrades[k] = { level: 0, visible: false, price: {} };
        for (const k in POLICIES_CONFIG) if (!state.policies[k]) state.policies[k] = { value: POLICIES_CONFIG[k].def, visible: false };
        for (const k in PERMANENT_CONFIG) if (!state.permanent[k]) state.permanent[k] = { level: 0, researched: false };
        for (const c of CHALLENGES_CONFIG) if (!state.challenges[c.id]) state.challenges[c.id] = { active: false, completed: false };
        if (!state.artifacts) state.artifacts = { inventory: [], equipped: [], slots: 3 };
        if (!Array.isArray(state.artifacts.equipped)) state.artifacts.equipped = [];
        if (!state.queue || !Array.isArray(state.queue.items)) state.queue = { items: [] };
        if (!state.heroes) state.heroes = freshHeroes();
        else {
            if (!state.heroes.owned) state.heroes.owned = {};
            if (!state.heroes.pity) state.heroes.pity = { A: 0, S: 0, EX: 0 };
            if (state.heroes.pulls === undefined) state.heroes.pulls = 0;
            if (!state.heroes.byRarity) state.heroes.byRarity = { C: 0, B: 0, A: 0, S: 0, EX: 0 };
            if (state.heroes.dupRelics === undefined) state.heroes.dupRelics = 0;
            if (!Array.isArray(state.heroes.history)) state.heroes.history = [];
        }
        if (!state.expedition) state.expedition = { active: null, auto: false, history: [] };
        if (!state.stats) state.stats = { playSeconds: 0, resets: { relic: 0, star: 0, core: 0 }, expeditions: 0, expeditionsFailed: 0, artifactsFound: 0, maxChallengeStars: 0, events: 0, history: [] };
        if (!state.settings) state.settings = { theme: 'dark', autosave: true, autoBuild: true, autoExpedition: true, buyAmount: 1 };
        if (!state.market) state.market = { resources: {}, heat: {}, volume: 0, trades: 0 };
        for (const k in RESOURCES_CONFIG) {
            if (!RESOURCES_CONFIG[k].prestige && !state.market.resources[k]) state.market.resources[k] = { mode: 'off', level: 1 };
            if (state.market.heat[k] === undefined) state.market.heat[k] = 1;
        }
        if (!Array.isArray(state.activeEffects)) state.activeEffects = [];
        if (!Array.isArray(state.eventLogs)) state.eventLogs = [];
        if (state.pendingEvent === undefined) state.pendingEvent = null;
        ProductionEngine.updatePrices(state);
        ProductionEngine.computeProductionAndCaps(state);
    }

    function load(state) {
        let raw;
        try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
        if (!raw) return false;
        try {
            const data = JSON.parse(raw);
            if (!data || typeof data !== 'object') return false;
            const seconds = data.lastTick ? Math.max(0, (Date.now() - data.lastTick) / 1000) : 0;
            applyData(state, data);
            state.pendingEvent = null;
            if (seconds > 60) applyOffline(state, seconds);
            state.lastTick = Date.now();
            return true;
        } catch (e) {
            console.error('读档失败', e);
            return false;
        }
    }

    function applyOffline(state, seconds) {
        const maxSec = (2 + EffectsManager.additive(state, 'offlineHours')) * 3600;
        const capped = Math.min(seconds, maxSec);
        if (capped < 60) return null;
        const speed = state.speed || 1;
        const days = capped * speed;
        const factor = EffectsManager.hasSpecial(state, 'offlinePerfect') ? 1 : 0.5;
        const gains = {};
        for (const k in state.resources) {
            const r = state.resources[k];
            if (RESOURCES_CONFIG[k].prestige) continue;
            if (r.production > 0) {
                const g = r.production * days * factor;
                const before = r.amount;
                r.amount = Math.min(r.cap, r.amount + g);
                if (r.amount - before > 1e-6) gains[k] = r.amount - before;
            }
        }
        state.gameDays += days;
        state.offlineReport = {
            seconds: capped,
            realSeconds: seconds,
            days: days,
            factor: factor,
            gains: gains,
            efficiency: factor,
        };
        EventEngine.addLog(state, '🌙 离线 ' + Utils.fmtDuration(seconds) + '（结算 ' + Utils.fmtDuration(capped) + '，效率 ' + effectivePct(factor) + '）');
        return state.offlineReport;
    }

    function effectivePct(f) { return Math.round(f * 100) + '%'; }

    function exportSave(state) {
        const json = serialize(state);
        try { return btoa(unescape(encodeURIComponent(json))); }
        catch (e) { return json; }
    }

    function importSave(state, text) {
        text = (text || '').trim();
        if (!text) return { ok: false, msg: '存档内容为空。' };
        let json = text;
        if (text[0] !== '{') {
            try { json = decodeURIComponent(escape(atob(text))); } catch (e) { return { ok: false, msg: '无法解析这段存档文本。' }; }
        }
        try {
            const data = JSON.parse(json);
            applyData(state, data);
            state.lastTick = Date.now();
            state.offlineReport = null;
            save(state);
            return { ok: true, msg: '存档导入成功。' };
        } catch (e) {
            return { ok: false, msg: '存档格式错误。' };
        }
    }

    function hardReset() {
        try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
        location.reload();
    }

    window.SaveEngine = { save, load, hasSave, exportSave, importSave, hardReset, applyOffline, applyData, SAVE_KEY };
})();
