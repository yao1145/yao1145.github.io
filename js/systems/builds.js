import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

const ROUTES = [
    {
        line: 'rapid',
        cards: ['passion', 'blitz'],
        builds: [
            ['rapid_entry', 'entry', '热机运转', '直接射击命中累计12次后进入热机', []],
            ['rapid_reignite', 'branch', '快速复燃', '热机结束后保留4点进度', ['rapid_entry']],
            ['rapid_wide', 'branch', '横向压制', '热机期间指定主弹额外穿透提升至2次', ['rapid_entry']],
            ['rapid_capstone', 'capstone', '持续火力', '热机期间击杀可延长热机时间', ['rapid_entry', ['rapid_reignite', 'rapid_wide']]],
        ],
    },
    {
        line: 'fortress',
        cards: ['survival', 'peace', 'thorns'],
        builds: [
            ['fortress_entry', 'entry', '稳态屏障', '连续15秒未受实际伤害获得屏障', []],
            ['fortress_regroup', 'branch', '快速重整', '获得屏障所需的无伤时间缩短至12秒', ['fortress_entry']],
            ['fortress_echo', 'branch', '防御回响', '屏障消耗时伤害附近普通敌人', ['fortress_entry']],
            ['fortress_capstone', 'capstone', '安全窗口', '屏障消耗时清除附近敌弹并进入冷却', ['fortress_entry', ['fortress_regroup', 'fortress_echo']]],
        ],
    },
    {
        line: 'desperate',
        cards: ['comeback', 'bloodlust'],
        builds: [
            ['desperate_entry', 'entry', '背水蓄势', '低血时直接命中累计12次追加打击', []],
            ['desperate_strike', 'branch', '破围一击', '追加打击同时清除近身敌弹', ['desperate_entry']],
            ['desperate_execute', 'branch', '绝境追击', '追加打击可对低血目标造成更高伤害', ['desperate_entry']],
            ['desperate_capstone', 'capstone', '最后储备', '低血击杀敌人累计后尝试回复生命', ['desperate_entry', ['desperate_strike', 'desperate_execute']]],
        ],
    },
    {
        line: 'chain',
        cards: ['chain'],
        builds: [
            ['chain_entry', 'entry', '爆破种子', '直接射击击杀普通敌人产生小型爆炸', []],
            ['chain_wide', 'branch', '广域爆破', '合并后的爆炸半径增加15像素', ['chain_entry']],
            ['chain_ignite', 'branch', '二次引燃', '允许爆炸击杀继续产生有限传播', ['chain_entry']],
            ['chain_capstone', 'capstone', '连锁震荡', '爆炸链达到击杀门槛时清除附近敌弹', ['chain_entry', ['chain_wide', 'chain_ignite']]],
        ],
    },
    {
        line: 'hunter',
        cards: ['glass', 'boss'],
        builds: [
            ['hunter_entry', 'entry', '弱点标记', '同一目标连续命中10次后追加精准打击', []],
            ['hunter_stable', 'branch', '稳定锁定', '标记失去命中后的清空时间延长', ['hunter_entry']],
            ['hunter_execute', 'branch', '处决校准', '目标低血时精准打击造成更高伤害', ['hunter_entry']],
            ['hunter_capstone', 'capstone', '猎王窗口', '对Boss精准打击后开启短暂额外命中窗口', ['hunter_entry', ['hunter_stable', 'hunter_execute']]],
        ],
    },
    {
        line: 'supply',
        cards: ['supply', 'boost'],
        builds: [
            ['supply_entry', 'entry', '物资回路', '收取自然道具累计3个后获得补给脉冲', []],
            ['supply_magnet', 'branch', '远程牵引', '近距离且允许拾取的道具缓慢靠近玩家', ['supply_entry']],
            ['supply_extended', 'branch', '延时供给', '补给脉冲持续时间延长至6秒', ['supply_entry']],
            ['supply_capstone', 'capstone', '余量转化', '允许治疗且满生命时生命道具贡献额外物资进度', ['supply_entry', ['supply_magnet', 'supply_extended']]],
        ],
    },
];

const builds = {};
for (const route of ROUTES) {
    const branchIds = route.builds.filter(([, stage]) => stage === 'branch').map(([id]) => id);
    for (const [id, stage, name, summary, requires] of route.builds) {
        const excludes = stage === 'branch'
            ? branchIds.filter((branchId) => branchId !== id)
            : [];
        builds[id] = { id, line: route.line, stage, name, summary, requires, excludes, cards: route.cards };
    }
}

const routeOrder = ROUTES.map(({ line }) => line);
const associatedLines = {
    passion: ['rapid'],
    blitz: ['rapid'],
    survival: ['fortress'],
    peace: ['fortress'],
    thorns: ['fortress'],
    comeback: ['desperate'],
    bloodlust: ['desperate'],
    chain: ['chain'],
    glass: ['hunter'],
    boss: ['hunter'],
    supply: ['supply'],
    boost: ['supply'],
    fog: [],
};

function getOwned() {
    if (!Game.buildState) Game.resetBuildState();
    return Game.buildState.owned;
}

function requirementMet(requirement, owned) {
    if (Array.isArray(requirement)) {
        return requirement.some((alternative) => requirementMet(alternative, owned));
    }
    return owned.includes(requirement);
}

function isBuildLegal(id, owned = getOwned()) {
    const build = builds[id];
    if (!build || owned.includes(id)) return false;
    if (!build.requires.every((requirement) => requirementMet(requirement, owned))) return false;
    return !build.excludes.some((excludedId) => owned.includes(excludedId));
}

function allOwnedBuildsRemainLegal(owned) {
    return owned.every((id) => {
        const build = builds[id];
        return build
            && build.requires.every((requirement) => requirementMet(requirement, owned))
            && !build.excludes.some((excludedId) => owned.includes(excludedId));
    });
}

function nextLegalForLine(line, owned) {
    return ROUTES.find((route) => route.line === line).builds
        .map(([id]) => id)
        .filter((id) => isBuildLegal(id, owned));
}

function randomize(ids, rng) {
    const result = [...ids];
    for (let index = result.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(rng() * (index + 1));
        [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
    }
    return result;
}

Game.BUILDS = builds;

Game.resetBuildState = function() {
    this.buildState = {
        owned: [],
        rewardCount: 0,
        cycle: 0,
        timers: {
            rapidWarmup: 0,
            fortressBarrier: 0,
            fortressClearCooldown: 0,
            desperateClearCooldown: 0,
            chainShockCooldown: 0,
            hunterWindow: 0,
            supplyPulse: 0,
        },
        counters: {},
        locks: {
            fortressBarrier: false,
            hunterTargetId: null,
            hunterHits: 0,
            desperateCycleHeal: false,
        },
        metrics: {},
    };
};

Game.hasBuild = function(id) {
    return getOwned().includes(id);
};

Game.getBuildStageState = function(lineId) {
    const route = ROUTES.find(({ line }) => line === lineId);
    if (!route) return null;
    const owned = getOwned();
    const routeIds = route.builds.map(([id]) => id);
    return {
        line: lineId,
        owned: routeIds.filter((id) => owned.includes(id)),
        available: nextLegalForLine(lineId, owned),
        complete: owned.includes(routeIds[routeIds.length - 1]),
    };
};

Game.getLegalBuildRemovals = function(candidateId) {
    const owned = getOwned();
    if (!builds[candidateId] || owned.includes(candidateId) || owned.length < CONFIG.builds.maxOwned) return [];

    return owned.filter((removeId) => {
        const replacementOwned = owned.filter((id) => id !== removeId);
        const nextOwned = [...replacementOwned, candidateId];
        return isBuildLegal(candidateId, replacementOwned) && allOwnedBuildsRemainLegal(nextOwned);
    });
};

Game.getLegalBuildCandidates = function(rng = Math.random) {
    const owned = getOwned();
    const isFull = owned.length >= CONFIG.builds.maxOwned;
    const legal = Object.keys(builds).filter((id) => {
        return isFull
            ? this.getLegalBuildRemovals(id).length > 0
            : isBuildLegal(id, owned);
    });
    if (legal.length === 0) return [];

    const prioritized = [];
    const prioritizedLines = new Set();
    const addRouteCandidate = (line) => {
        if (prioritized.length >= CONFIG.builds.offerCount || prioritizedLines.has(line)) return;
        const next = ROUTES.find((route) => route.line === line).builds
            .map(([id]) => id)
            .filter((id) => legal.includes(id));
        if (next.length === 0) return;
        prioritized.push(next[0]);
        prioritizedLines.add(line);
    };

    // Reserve the first slot(s) for the current core card's associated route.
    // This is intentionally separate from the invested-route pass below.
    for (const line of associatedLines[this.activeCard] || []) addRouteCandidate(line);

    // Use every remaining slot for a distinct invested, unfinished route before
    // considering new routes or random fill. If more routes are eligible than
    // slots remain, routeOrder is the deterministic tie-breaker: the omitted
    // routes are the unavoidable consequence of the three-card offer cap.
    for (const line of routeOrder) {
        const invested = owned.some((id) => builds[id] && builds[id].line === line);
        if (invested) addRouteCandidate(line);
    }

    // Only after the core and invested-route passes may a fresh route entry use
    // a slot. The final random fill below still respects the same legal pool.
    for (const line of routeOrder) {
        const entry = `${line}_entry`;
        if (prioritized.length >= CONFIG.builds.offerCount) break;
        if (!owned.includes(entry) && legal.includes(entry) && !prioritizedLines.has(line)) {
            prioritized.push(entry);
            prioritizedLines.add(line);
        }
    }

    const remaining = randomize(legal.filter((id) => !prioritized.includes(id)), rng);
    return [...prioritized, ...remaining].slice(0, CONFIG.builds.offerCount);
};

Game.applyBuildChoice = function(candidateId, replaceId) {
    const owned = getOwned();

    if (owned.length >= CONFIG.builds.maxOwned) {
        if (!replaceId || !this.getLegalBuildRemovals(candidateId).includes(replaceId)) return false;
        const nextOwned = [...owned.filter((id) => id !== replaceId), candidateId];
        if (!allOwnedBuildsRemainLegal(nextOwned)) return false;
        this.buildState.owned = nextOwned;
    } else {
        if (!isBuildLegal(candidateId, owned)) return false;
        if (replaceId) return false;
        this.buildState.owned = [...owned, candidateId];
    }

    this.buildState.rewardCount += 1;
    return true;
};

Game.resetBuildState();
