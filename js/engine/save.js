/* 存档：本地存储、导入导出、离线收益 */
(function () {
    /* 存档键：改名后使用新键，但会读取旧键并自动迁移，避免老玩家丢档 */
    const SAVE_KEY = 'arcane-embers-save';
    const LEGACY_SAVE_KEYS = ['magic-rebuilder-save'];

    function readRaw() {
        try {
            const cur = localStorage.getItem(SAVE_KEY);
            if (cur) return { raw: cur, key: SAVE_KEY };
        } catch (e) { /* 忽略 */ }
        for (const k of LEGACY_SAVE_KEYS) {
            try {
                const old = localStorage.getItem(k);
                if (old) return { raw: old, key: k };
            } catch (e) { /* 忽略 */ }
        }
        return null;
    }

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
        return !!readRaw();
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
        /* 建筑拆分迁移（写成幂等的：迁移过的存档再迁一次不会有任何变化）：
           旧的「元素祭坛」本来是一个建筑三种模式（模式是全体共用的），现在拆成火 / 水 / 土三座独立建筑，
           按旧档当时选中的模式把数量搬过去；「观星台」的预言模式拆成独立的「预言台」。
           这里刻意不做「只迁一次」的标记——标记本身也会被上一份存档残留影响，
           而这段逻辑本身就是幂等的（旧键删除后第二次找不到东西，数量也不会重复累加）。 */
        {
            const legacyElement = state.buildings['元素祭坛'];
            if (legacyElement && legacyElement.count > 0) {
                const target = ['火之祭坛', '水之祭坛', '土之祭坛'][legacyElement.mode || 0] || '火之祭坛';
                const t = state.buildings[target];
                if (t) {
                    t.count += legacyElement.count;
                    t.active = Math.min(t.count, (t.active || 0) + Math.min(legacyElement.active || 0, legacyElement.count));
                    t.unlocked = true;
                    t.visible = true;
                }
            }
            delete state.buildings['元素祭坛'];
            const legacyObs = state.buildings['观星台'];
            if (legacyObs && (legacyObs.mode || 0) === 1 && legacyObs.count > 0) {
                const p = state.buildings['预言台'];
                if (p) {
                    p.count += legacyObs.count;
                    p.active = Math.min(p.count, (p.active || 0) + Math.min(legacyObs.active || 0, legacyObs.count));
                    p.unlocked = true;
                    p.visible = true;
                }
                legacyObs.count = 0;
                legacyObs.active = 0;
            }
        }
        for (const k in TECHS_CONFIG) if (!state.techs[k]) state.techs[k] = { researched: false, visible: false };
        for (const k in UPGRADES_CONFIG) if (!state.upgrades[k]) state.upgrades[k] = { level: 0, visible: false, price: {} };
        for (const k in POLICIES_CONFIG) if (!state.policies[k]) state.policies[k] = { value: POLICIES_CONFIG[k].def, visible: false };
        for (const k in PERMANENT_CONFIG) if (!state.permanent[k]) state.permanent[k] = { level: 0, researched: false };
        for (const c of CHALLENGES_CONFIG) if (!state.challenges[c.id]) state.challenges[c.id] = { active: false, completed: false };
        if (!state.artifacts) state.artifacts = { inventory: [], equipped: [], slots: 3 };
        if (!Array.isArray(state.artifacts.equipped)) state.artifacts.equipped = [];
        /* 旧秘宝里指向「元素祭坛」的词条改指火之祭坛（其它建筑名没变） */
        const fixBuildingKeys = art => {
            if (!art || !Array.isArray(art.effects)) return;
            for (const eff of art.effects) {
                if (eff && eff['元素祭坛']) {
                    eff['火之祭坛'] = eff['元素祭坛'];
                    delete eff['元素祭坛'];
                }
            }
            /* 脆弱秘宝机制已移除：旧档里的标记直接去掉，词条数值保持原样（不再会碎裂） */
            if (art.fragile) delete art.fragile;
        };
        if (Array.isArray(state.artifacts.inventory)) state.artifacts.inventory.forEach(fixBuildingKeys);
        state.artifacts.equipped.forEach(fixBuildingKeys);
        if (!state.queue || !Array.isArray(state.queue.items)) state.queue = { items: [] };
        /* 旧队列条目兼容：
           v1.1「先付款、后施工」与 v1.2「等资源 → 施工」两代存档里的订单，
           统一转成 v1.3 的「等材料的订单」；已经付过款的把材料退回，避免重复扣费。 */
        for (const it of state.queue.items) {
            if (it.state === 'building' && it.cost) {
                for (const k in it.cost) {
                    const r = state.resources[k];
                    if (r) r.amount = Math.min(r.cap, r.amount + it.cost[k]);
                }
            }
            delete it.state;
            delete it.dur;
            delete it.start;
            delete it.end;
            it.cost = null;
            if (!it.est) it.est = {};
        }
        if (!state.heroes) state.heroes = freshHeroes();
        else {
            if (!state.heroes.owned) state.heroes.owned = {};
            if (!state.heroes.pity) state.heroes.pity = {};
            if (state.heroes.pulls === undefined) state.heroes.pulls = 0;
            if (!state.heroes.byRarity) state.heroes.byRarity = {};
            /* 稀有度改版（旧档只迁移一次）：旧档里的「EX」是现在的「SS」，
               保底计数、获得次数与历史记录都要搬过来，否则老玩家的进度会白丢。
               新版自己的 EX 记录不会再被改写。 */
            if (!state.heroes.rarityMigrated) {
                state.heroes.pity.SS = state.heroes.pity.EX || state.heroes.pity.SS || 0;
                state.heroes.byRarity.SS = (state.heroes.byRarity.SS || 0) + (state.heroes.byRarity.EX || 0);
                state.heroes.byRarity.EX = 0;
                if (Array.isArray(state.heroes.history)) {
                    for (const h of state.heroes.history) if (h && h.rarity === 'EX') h.rarity = 'SS';
                }
                state.heroes.rarityMigrated = true;
            }
            delete state.heroes.pity.EX;
            for (const k in GACHA_CONFIG.pity) if (state.heroes.pity[k] === undefined) state.heroes.pity[k] = 0;
            for (const k in HERO_RARITIES) if (state.heroes.byRarity[k] === undefined) state.heroes.byRarity[k] = 0;
            if (state.heroes.dupRelics === undefined) state.heroes.dupRelics = 0;
            if (!Array.isArray(state.heroes.history)) state.heroes.history = [];
        }
        if (!state.expedition) state.expedition = { active: [], auto: false, history: [], mastery: {}, dry: 0 };
        /* 远征结构改版：以前只能同时派一支队伍（active 是单个对象），现在是一组队伍。
           旧档里正在外面的那支队伍包进数组继续跑，不会丢。 */
        if (state.expedition.active && !Array.isArray(state.expedition.active)) {
            state.expedition.active = [state.expedition.active];
        }
        if (!Array.isArray(state.expedition.active)) state.expedition.active = [];
        if (!Array.isArray(state.expedition.history)) state.expedition.history = [];
        if (!state.expedition.mastery || typeof state.expedition.mastery !== 'object') state.expedition.mastery = {};
        if (typeof state.expedition.dry !== 'number') state.expedition.dry = 0;
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
        const found = readRaw();
        if (!found) return false;
        try {
            const data = JSON.parse(found.raw);
            if (!data || typeof data !== 'object') return false;
            const seconds = data.lastTick ? Math.max(0, (Date.now() - data.lastTick) / 1000) : 0;
            applyData(state, data);
            state.pendingEvent = null;
            if (seconds > 60) applyOffline(state, seconds);
            state.lastTick = Date.now();
            if (found.key !== SAVE_KEY) {
                /* 从旧名字的存档迁移到新键 */
                save(state);
                try { localStorage.removeItem(found.key); } catch (e) { /* 忽略 */ }
                EventEngine.addLog(state, '📜 存档已迁移到新版本（秘法余烬）。');
            }
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
        try {
            localStorage.removeItem(SAVE_KEY);
            for (const k of LEGACY_SAVE_KEYS) localStorage.removeItem(k);
        } catch (e) {}
        location.reload();
    }

    window.SaveEngine = { save, load, hasSave, exportSave, importSave, hardReset, applyOffline, applyData, SAVE_KEY, LEGACY_SAVE_KEYS };
})();
