/* 游戏状态与资源管理 */
(function () {
    const SAVE_VERSION = 4;

    /* 全局唯一状态对象（引用始终不变，便于各模块共享） */
    const GameState = {
        version: SAVE_VERSION,
        gameDays: 0,
        paused: false,
        speed: 1,
        happiness: 100,
        happinessList: [],
        resources: {},
        localResources: {},
        buildings: {},
        techs: {},
        upgrades: {},
        policies: {},
        permanent: {},
        achievements: {},
        challenges: {},
        artifacts: { inventory: [], equipped: [], slots: 3 },
        queue: { items: [] },
        heroes: null,
        market: { resources: {}, heat: {}, volume: 0, trades: 0 },
        expedition: { active: null, auto: false, history: [] },
        activeEffects: [],
        eventLogs: [],
        pendingEvent: null,
        nextEventDay: 120,
        effects: null,
        stats: {},
        settings: {},
        lastSave: 0,
        lastTick: 0,
        offlineReport: null,
    };

    function freshStats() {
        return {
            playSeconds: 0,
            startedAt: Date.now(),
            resets: { relic: 0, star: 0, core: 0 },
            expeditions: 0,
            expeditionsFailed: 0,
            artifactsFound: 0,
            maxChallengeStars: 0,
            events: 0,
            peakPopulation: 0,
            peakKnowledge: 0,
            totalBuildingBuilt: 0,
            history: [],
        };
    }

    function freshSettings() {
        return {
            theme: 'dark',
            autosave: true,
            autoBuild: true,
            autoBuildKeep: 0,
            autoExpedition: true,
            buyAmount: 1,
        };
    }

    /* 英雄与召唤的初始状态 */
    function freshHeroes() {
        return {
            owned: {},                          // 英雄 id → 觉醒等级（0~5）
            pity: { A: 0, S: 0, EX: 0 },        // 距离上次获得该档位以上的抽数
            pulls: 0,
            byRarity: { C: 0, B: 0, A: 0, S: 0, EX: 0 },
            dupRelics: 0,
            history: [],
        };
    }

    function initState() {
        const s = GameState;
        s.version = SAVE_VERSION;
        s.gameDays = 0;
        s.paused = false;
        s.speed = 1;
        s.happiness = 100;
        s.happinessList = [];
        s.resources = {};
        s.localResources = {};
        s.buildings = {};
        s.techs = {};
        s.upgrades = {};
        s.policies = {};
        s.permanent = {};
        s.achievements = {};
        s.challenges = {};
        s.artifacts = { inventory: [], equipped: [], slots: 3 };
        s.queue = { items: [] };
        s.heroes = freshHeroes();
        s.market = { resources: {}, heat: {}, volume: 0, trades: 0 };
        s.expedition = { active: null, auto: false, history: [] };
        s.activeEffects = [];
        s.eventLogs = [];
        s.pendingEvent = null;
        s.nextEventDay = 100;
        s.effects = null;
        s.stats = freshStats();
        s.settings = freshSettings();
        s.lastSave = Date.now();
        s.lastTick = Date.now();
        s.offlineReport = null;

        for (const k in RESOURCES_CONFIG) {
            const cfg = RESOURCES_CONFIG[k];
            s.resources[k] = {
                amount: 0,
                cap: cfg.cap,
                baseCap: cfg.cap,
                production: 0,
                visible: false,
            };
        }
        /* 起始物资：废墟里还能找到的东西 */
        s.resources['木材'].amount = 25;
        s.resources['石料'].amount = 15;

        for (const k in LOCAL_RESOURCES_CONFIG) {
            s.localResources[k] = { amount: 0, capacity: 0, used: 0, visible: k === 'population' };
        }

        for (const k in BUILDINGS_CONFIG) {
            s.buildings[k] = { count: 0, active: 0, visible: false, locked: false, price: {}, efficiency: 1, mode: 0 };
        }
        for (const k in TECHS_CONFIG) s.techs[k] = { researched: false, visible: false };
        for (const k in UPGRADES_CONFIG) s.upgrades[k] = { level: 0, visible: false, price: {} };
        for (const k in POLICIES_CONFIG) {
            const cfg = POLICIES_CONFIG[k];
            s.policies[k] = { value: cfg.def, visible: false };
        }
        for (const k in PERMANENT_CONFIG) s.permanent[k] = { level: 0, researched: false };
        for (const c of CHALLENGES_CONFIG) s.challenges[c.id] = { active: false, completed: false };
        for (const k in RESOURCES_CONFIG) {
            const cfg = RESOURCES_CONFIG[k];
            if (!cfg.prestige) s.market.resources[k] = { mode: 'off', level: 1 };
            s.market.heat[k] = 1;
        }
        return s;
    }

    /* ---------------- 资源操作 ---------------- */
    const ResourcesManager = {
        get(name) { return GameState.resources[name]; },
        amount(name) {
            const r = GameState.resources[name];
            return r ? r.amount : 0;
        },
        add(map) {
            for (const k in map) {
                const r = GameState.resources[k];
                if (!r) continue;
                r.amount = Math.max(0, r.amount + map[k]);
                const cfg = RESOURCES_CONFIG[k];
                if (!cfg.prestige && r.amount > r.cap) r.amount = r.cap;
            }
        },
        canAfford(map) {
            for (const k in map) {
                if (!map[k]) continue;
                const r = GameState.resources[k];
                if (!r || r.amount + 1e-9 < map[k]) return false;
            }
            return true;
        },
        spend(map) {
            if (!this.canAfford(map)) return false;
            for (const k in map) {
                if (!map[k]) continue;
                GameState.resources[k].amount -= map[k];
            }
            return true;
        },
        missing(map) {
            const out = {};
            for (const k in map) {
                const r = GameState.resources[k];
                const lack = map[k] - (r ? r.amount : 0);
                if (lack > 1e-9) out[k] = lack;
            }
            return out;
        },
    };

    window.GameState = GameState;
    window.initState = initState;
    window.freshHeroes = freshHeroes;
    window.SAVE_VERSION = SAVE_VERSION;
    window.ResourcesManager = ResourcesManager;
})();
