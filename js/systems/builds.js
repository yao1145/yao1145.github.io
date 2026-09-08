import { Game } from '../core/game.js';
import { CONFIG } from '../core/config.js';

const ROUTES = [
    {
        line: 'rapid',
        cards: ['passion', 'blitz'],
        builds: [
            ['rapid_entry', 'entry', '热机运转', '8个不同命中启动4秒热机', []],
            ['rapid_reignite', 'branch', '快速复燃', '热机结束保留4/8命中进度', ['rapid_entry']],
            ['rapid_wide', 'branch', '横向压制', '强化主弹穿透提升至2次', ['rapid_entry']],
            ['rapid_capstone', 'capstone', '持续火力', '热机内击杀与Boss命中延长，最长6秒', ['rapid_entry', ['rapid_reignite', 'rapid_wide']]],
        ],
    },
    {
        line: 'fortress',
        cards: ['survival', 'peace', 'thorns'],
        builds: [
            ['fortress_entry', 'entry', '稳态屏障', '连续15秒未受实际伤害获得屏障', []],
            ['fortress_regroup', 'branch', '快速重整', '获得屏障所需的无伤时间缩短至12秒', ['fortress_entry']],
            ['fortress_echo', 'branch', '防御回响', '屏障消耗时对200px内普通敌人造成2.0回响', ['fortress_entry']],
            ['fortress_capstone', 'capstone', '安全窗口', '屏障消耗时清除250px内敌弹，冷却10秒', ['fortress_entry', ['fortress_regroup', 'fortress_echo']]],
        ],
    },
    {
        line: 'desperate',
        cards: ['comeback', 'bloodlust'],
        builds: [
            ['desperate_entry', 'entry', '背水蓄势', '低血时直接命中累计10次追加2D打击', []],
            ['desperate_clear', 'branch', '破围一击', '追加打击清除目标中心220px内敌弹', ['desperate_entry']],
            ['desperate_execute', 'branch', '绝境追击', '低血目标追加打击由2D提升至3D', ['desperate_entry']],
            ['desperate_capstone', 'capstone', '最后储备', '低血直接击杀累计8次尝试回复1命，每Boss周期1次', ['desperate_entry', ['desperate_clear', 'desperate_execute']]],
        ],
    },
    {
        line: 'chain',
        cards: ['chain'],
        builds: [
            ['chain_entry', 'entry', '爆破种子', '直接击杀普通敌人产生200px、1.0爆炸', []],
            ['chain_radius', 'branch', '广域爆破', '首代爆炸半径提升至260px', ['chain_entry']],
            ['chain_spread', 'branch', '二次引燃', '首代击杀产生一代220px、0.5传播爆炸', ['chain_entry']],
            ['chain_capstone', 'capstone', '连锁震荡', '同链3次击杀后清除末击杀点300px内敌弹', ['chain_entry', ['chain_radius', 'chain_spread']]],
        ],
    },
    {
        line: 'hunter',
        cards: ['glass', 'boss'],
        builds: [
            ['hunter_entry', 'entry', '弱点标记', '同一目标连续命中10次后追加精准打击', []],
            ['hunter_lock', 'branch', '稳定锁定', '锁定记忆窗口延长至3000ms', ['hunter_entry']],
            ['hunter_execute', 'branch', '处决校准', '目标低血时精准打击造成更高伤害', ['hunter_entry']],
            ['hunter_capstone', 'capstone', '猎王窗口', 'Boss精准打击后2秒追加2D并清除目标200px敌弹', ['hunter_entry', ['hunter_lock', 'hunter_execute']]],
        ],
    },
    {
        line: 'supply',
        cards: ['supply', 'boost'],
        builds: [
            ['supply_entry', 'entry', '物资回路', '自然道具累计3个开启4秒脉冲', []],
            ['supply_magnet', 'branch', '远程牵引', '玩家中心200px内自然道具持续牵引', ['supply_entry']],
            ['supply_duration', 'branch', '延时供给', '补给脉冲持续时间延长至6秒', ['supply_entry']],
            ['supply_capstone', 'capstone', '余量转化', '满血红心贡献2点进度，脉冲上限8秒', ['supply_entry', ['supply_magnet', 'supply_duration']]],
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
    fog: ['fortress'],
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
    // Card history belongs to the current run even though its recording hook
    // lives with the core-card flow. Resetting the build state is the single
    // run-start reset shared by both systems.
    if (typeof this.resetCardHistory === 'function') this.resetCardHistory();
    else this.cardHistory = [];
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
            hunterClearCooldown: 0,
            supplyPulse: 0,
        },
        counters: {
            rapidHits: 0,
            rapidLastHit: 0,
            rapidHeatupShots: 0,
            rapidBossHits: 0,
            rapidExtendedMs: 0,
            desperateHits: 0,
            desperateKills: 0,
            chainBlasts: 0,
            chainGeneration: 0,
            hunterLastHit: 0,
            supplyPickups: 0,
        },
        locks: {
            fortressBarrier: false,
            hunterTargetId: null,
            hunterHits: 0,
            desperateCycleHeal: false,
        },
        metrics: {},
        visualFeedbackEvents: [],
    };
};

function getBuildMetrics(state) {
    state.metrics = state.metrics || {};
    return state.metrics;
}

function numericMetric(metrics, key) {
    const value = Number(metrics[key]);
    return Number.isFinite(value) && value >= 0 ? value : 0;
}

function escapeSummaryText(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

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
    const getNextLegal = (line) => {
        const legalForLine = ROUTES.find((route) => route.line === line).builds
            .map(([id]) => id)
            .filter((id) => legal.includes(id));
        return legalForLine.find((id) => builds[id].stage === 'capstone') || legalForLine[0];
    };
    const addRouteCandidate = (line) => {
        if (prioritized.length >= CONFIG.builds.offerCount || prioritizedLines.has(line)) return;
        const next = getNextLegal(line);
        if (!next) return;
        prioritized.push(next);
        prioritizedLines.add(line);
    };

    const investedLines = routeOrder.filter((line) => {
        const route = ROUTES.find((candidateRoute) => candidateRoute.line === line);
        const capstoneId = route.builds.find(([, stage]) => stage === 'capstone')[0];
        return owned.some((id) => builds[id] && builds[id].line === line)
            && !owned.includes(capstoneId)
            && getNextLegal(line);
    });
    const associatedCandidateLines = [...new Set(associatedLines[this.activeCard] || [])]
        .filter((line) => getNextLegal(line));
    const associatedNewLines = associatedCandidateLines.filter((line) => !investedLines.includes(line));
    const associatedCanLead = investedLines.length + associatedNewLines.length <= CONFIG.builds.offerCount;

    if (associatedCanLead) {
        for (const line of associatedCandidateLines) addRouteCandidate(line);
        for (const line of investedLines) addRouteCandidate(line);
    } else {
        // The three-slot cap makes the associated route and every invested route
        // mutually incompatible here; preserve the invested-route guarantee.
        for (const line of investedLines) addRouteCandidate(line);
        for (const line of associatedCandidateLines) addRouteCandidate(line);
    }

    // Only after the core and invested-route passes may a fresh route entry use
    // a slot. The final random fill below still respects the same legal pool.
    const newRouteEntries = routeOrder
        .map((line) => `${line}_entry`)
        .filter((entry) => !owned.includes(entry)
            && legal.includes(entry)
            && !prioritizedLines.has(builds[entry].line));
    for (const entry of randomize(newRouteEntries, rng)) {
        if (prioritized.length >= CONFIG.builds.offerCount) break;
        prioritized.push(entry);
        prioritizedLines.add(builds[entry].line);
    }

    const remaining = randomize(legal.filter((id) => !prioritized.includes(id)), rng);
    return [...prioritized, ...remaining].slice(0, CONFIG.builds.offerCount);
};

Game.applyBuildChoice = function(candidateId, replaceId) {
    const owned = getOwned();
    const hadDesperateCapstone = owned.includes('desperate_capstone');

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

    if (hadDesperateCapstone && !this.buildState.owned.includes('desperate_capstone')) {
        this.buildState.counters.desperateKills = 0;
    }
    this.buildState.rewardCount += 1;
    return true;
};

// --- Two-stage boss reward flow -------------------------------------------
// Phase machine: 'core' (card selection) -> 'build' (choose/replace/skip a
// build) -> 'summary' (confirm). Only finishRewardFlow() resumes the
// simulation; every other branch keeps it paused. buildState.cycle counts
// completed boss cycles and is incremented by handleBossDeath.

const LINE_NAMES = {
    rapid: '疾速压制',
    fortress: '坚壁续航',
    desperate: '绝境反攻',
    chain: '连锁清场',
    hunter: '破甲猎王',
    supply: '补给运营',
};

const STAGE_NAMES = {
    entry: '入门',
    branch: '分支',
    capstone: '进阶',
};

function buildDetailText(build) {
    const parts = [];
    const required = build.requires.map((requirement) => Array.isArray(requirement)
        ? requirement.map((id) => Game.BUILDS[id].name).join(' 或 ')
        : Game.BUILDS[requirement].name);
    if (required.length) parts.push(`前置：${required.join('、')}`);
    if (build.excludes.length) {
        parts.push(`与 ${build.excludes.map((id) => Game.BUILDS[id].name).join('、')} 互斥`);
    }
    parts.push('本局保留，换卡后仍然保留');
    return parts.join('；');
}

Game.beginRewardFlow = function(firstPick = false) {
    this.rewardFlow = {
        phase: 'core',
        firstPick,
        candidates: [],
        pendingCandidate: null,
        chosenBuild: null,
    };
    this.openCardSelection(firstPick);
};

// Advance from the core-card stage to the build stage (or straight to the
// summary when nothing legal can be offered).
Game.advanceRewardFlow = function() {
    if (!this.rewardFlow || this.rewardFlow.phase !== 'core') return false;
    this.rewardFlow.candidates = this.getLegalBuildCandidates();
    this.rewardFlow.pendingCandidate = null;
    this.rewardFlow.chosenBuild = null;
    if (this.rewardFlow.candidates.length === 0) {
        this.showRewardSummary();
    } else {
        this.openBuildSelection();
    }
    return true;
};

Game.openBuildSelection = function() {
    if (!this.rewardFlow) return false;
    this.closeCardSelection();
    this.isBuildSelectionOpen = true;
    this.isRunning = false;
    this.accumulator = 0;
    this.lastTime = performance.now();
    if (typeof this.enableControlArea === 'function') this.enableControlArea(false);
    this.rewardFlow.phase = 'build';
    this.updateBuildSelectionUI();
    if (this.buildPanel) this.buildPanel.style.display = 'flex';
    return true;
};

// Without a free slot this only arms replacement mode; use
// selectBuildReplacement() to finalize a swap.
Game.selectBuild = function(candidateId) {
    if (!this.rewardFlow || this.rewardFlow.phase !== 'build') return false;
    if (!this.rewardFlow.candidates.includes(candidateId)) return false;

    if (this.buildState.owned.length >= CONFIG.builds.maxOwned) {
        this.rewardFlow.pendingCandidate = candidateId;
        this.updateBuildSelectionUI();
        return true;
    }
    if (!this.applyBuildChoice(candidateId)) return false;
    this.rewardFlow.chosenBuild = candidateId;
    this.showRewardSummary();
    return true;
};

Game.selectBuildReplacement = function(removeId) {
    if (!this.rewardFlow || this.rewardFlow.phase !== 'build') return false;
    const candidateId = this.rewardFlow.pendingCandidate;
    if (!candidateId) return false;
    if (!this.applyBuildChoice(candidateId, removeId)) return false;
    this.rewardFlow.pendingCandidate = null;
    this.rewardFlow.chosenBuild = candidateId;
    this.showRewardSummary();
    return true;
};

Game.skipBuildSelection = function() {
    if (!this.rewardFlow || this.rewardFlow.phase !== 'build') return false;
    this.rewardFlow.pendingCandidate = null;
    this.rewardFlow.chosenBuild = null;
    this.showRewardSummary();
    return true;
};

Game.showRewardSummary = function() {
    if (!this.rewardFlow) return false;
    this.isBuildSelectionOpen = false;
    if (this.buildPanel) this.buildPanel.style.display = 'none';
    this.rewardFlow.phase = 'summary';
    this.isRewardSummaryOpen = true;
    this.updateRewardSummaryUI();
    if (this.rewardSummaryPanel) this.rewardSummaryPanel.style.display = 'flex';
    return true;
};

// The only path that resumes the simulation after a boss reward.
Game.finishRewardFlow = function() {
    if (!this.rewardFlow) return false;
    this.rewardFlow = null;
    this.isBuildSelectionOpen = false;
    this.isRewardSummaryOpen = false;
    if (this.buildPanel) this.buildPanel.style.display = 'none';
    if (this.rewardSummaryPanel) this.rewardSummaryPanel.style.display = 'none';
    this.isRunning = true;
    this.accumulator = 0;
    this.lastTime = performance.now();
    if (typeof this.enableControlArea === 'function') this.enableControlArea(true);
    return true;
};

// --- Build / summary panels (DOM guarded so Node tests run headless) -------

Game.setupBuilds = function() {
    if (typeof document === 'undefined') return;
    this.buildPanel = document.getElementById('buildPanel');
    this.buildSubtitle = document.getElementById('buildSubtitle');
    this.buildHint = document.getElementById('buildHint');
    this.buildOptions = document.getElementById('buildOptions');
    this.buildBackButton = document.getElementById('buildBackButton');
    this.rewardSummaryPanel = document.getElementById('rewardSummaryPanel');
    this.rewardSummaryBody = document.getElementById('rewardSummaryBody');
    if (!this.buildPanel) return;

    this.buildPanel.addEventListener('click', (event) => {
        const detailToggle = event.target.closest('.buildDetailToggle');
        if (detailToggle) {
            const option = detailToggle.closest('.buildOption');
            if (option) option.classList.toggle('expanded');
            return;
        }
        const removeButton = event.target.closest('.buildRemoveOption');
        if (removeButton && !removeButton.disabled) {
            this.selectBuildReplacement(removeButton.dataset.remove);
            return;
        }
        const option = event.target.closest('.buildOption');
        if (option && !option.disabled) {
            this.selectBuild(option.dataset.build);
            return;
        }
        if (event.target.closest('#buildBackButton')) {
            this.rewardFlow.pendingCandidate = null;
            this.updateBuildSelectionUI();
            return;
        }
        if (event.target.closest('#buildSkipButton')) this.skipBuildSelection();
    });

    if (this.rewardSummaryPanel) {
        this.rewardSummaryPanel.addEventListener('click', (event) => {
            if (event.target.closest('#rewardConfirmButton')) this.finishRewardFlow();
        });
    }
};

Game.updateBuildSelectionUI = function() {
    if (typeof document === 'undefined' || !this.buildOptions || !this.rewardFlow) return;
    const flow = this.rewardFlow;
    const owned = this.buildState.owned;
    const isFull = owned.length >= CONFIG.builds.maxOwned;
    const replacing = Boolean(flow.pendingCandidate);

    if (this.buildSubtitle) {
        this.buildSubtitle.textContent = replacing
            ? `选择被「${Game.BUILDS[flow.pendingCandidate].name}」替换的强化`
            : isFull ? '强化槽位已满，可替换一项或跳过' : '换卡后仍然保留';
    }
    if (this.buildHint) {
        this.buildHint.textContent = `已持有 ${owned.length}/${CONFIG.builds.maxOwned} 项强化`;
    }
    if (this.buildBackButton) this.buildBackButton.style.display = replacing ? '' : 'none';

    if (replacing) {
        this.buildOptions.innerHTML = this.getLegalBuildRemovals(flow.pendingCandidate).map((id) => {
            const build = Game.BUILDS[id];
            return `<button type="button" class="buildOption buildRemoveOption" data-remove="${id}">`
                + `<span class="buildName">替换：${build.name}</span>`
                + `<span class="buildMeta">${LINE_NAMES[build.line]} · ${STAGE_NAMES[build.stage]}</span>`
                + `<span class="buildDesc">让位后获得：${Game.BUILDS[flow.pendingCandidate].name}</span>`
                + '</button>';
        }).join('');
        return;
    }

    this.buildOptions.innerHTML = flow.candidates.map((id) => {
        const build = Game.BUILDS[id];
        const meta = `${LINE_NAMES[build.line]} · ${STAGE_NAMES[build.stage]}`
            + (build.stage === 'branch' ? ' · 二选一' : '');
        return `<button type="button" class="buildOption" data-build="${id}">`
            + `<span class="buildName">${build.name}</span>`
            + `<span class="buildMeta">${meta}</span>`
            + `<span class="buildDesc">${build.summary}</span>`
            + '<span class="buildDetailToggle">详情</span>'
            + `<span class="buildDetail">${buildDetailText(build)}</span>`
            + '</button>';
    }).join('');
};

Game.updateRewardSummaryUI = function() {
    if (typeof document === 'undefined' || !this.rewardSummaryBody || !this.rewardFlow) return;
    const cardName = this.activeCard && this.CARDS[this.activeCard]
        ? this.CARDS[this.activeCard].name
        : '无';
    const buildId = this.rewardFlow.chosenBuild;
    const buildText = buildId
        ? `${Game.BUILDS[buildId].name} · ${LINE_NAMES[Game.BUILDS[buildId].line]}${STAGE_NAMES[Game.BUILDS[buildId].stage]}`
        : '无（跳过）';
    this.rewardSummaryBody.innerHTML = `
        <div class="summaryRow"><span class="summaryLabel">当前核心卡</span><span class="summaryValue">${cardName}</span></div>
        <div class="summaryRow"><span class="summaryLabel">本次强化</span><span class="summaryValue">${buildText}</span></div>`;
};

// --- Combat-event hooks -----------------------------------------------------
// This section is the only route runtime. Direct hits arrive once per shotId
// batch, while kill events arrive once per settled entity death. The helpers
// below deliberately keep route-local bookkeeping out of the combat modules.

function runtimeFor(state) {
    if (!state._runtime) {
        state._runtime = {
            rapidSeenShots: new Set(),
            rapidIdleMs: 0,
            desperateSeenShots: new Set(),
            hunterTargets: new Map(),
            cycleSeen: state.cycle,
            killKeys: new Set(),
        };
    }
    return state._runtime;
}

function addMetric(state, key, value = 1) {
    const metrics = getBuildMetrics(state);
    metrics[key] = numericMetric(metrics, key) + (Number(value) || 0);
    return metrics[key];
}

function centerOf(entity) {
    return {
        x: entity.x + entity.width / 2,
        y: entity.y + entity.height / 2,
    };
}

function targetIdFor(event) {
    return `${event.targetType}:${event.entityId}`;
}

function syncBossCycle(game) {
    const state = game.buildState;
    if (!state) return;
    const runtime = runtimeFor(state);
    if (runtime.cycleSeen === state.cycle) return;
    runtime.cycleSeen = state.cycle;
    state.counters.desperateHits = 0;
    state.counters.desperateKills = 0;
    state.locks.desperateCycleHeal = false;
}

// Route logic owns semantic feedback events; render.js only paints the events
// later.  Keeping the queue on buildState makes feedback observable in
// headless tests and, more importantly, prevents a full particle pool from
// suppressing route damage, clears, or progress.
Game.emitBuildFeedback = function(event = {}) {
    if (!this.buildState || !event || typeof event !== 'object') return null;
    const state = this.buildState;
    if (!Array.isArray(state.visualFeedbackEvents)) state.visualFeedbackEvents = [];
    const now = Number(this.gameTime) || 0;
    const feedback = {
        ...event,
        until: event.until == null ? now + 400 : event.until,
    };
    state.visualFeedbackEvents.push(feedback);
    // Feedback is presentation-only. Bound the retained history without ever
    // changing the gameplay result of the route trigger that emitted it.
    if (state.visualFeedbackEvents.length > 64) state.visualFeedbackEvents.splice(0, state.visualFeedbackEvents.length - 64);
    return feedback;
};

function clearCount(game, x, y, radius, metric) {
    if (typeof game.clearEnemyBulletsInRadius !== 'function') return 0;
    const cleared = Number(game.clearEnemyBulletsInRadius(x, y, radius)) || 0;
    if (cleared > 0) addMetric(game.buildState, metric, cleared);
    return cleared;
}

Game.onDirectShotBatch = function(batch) {
    if (!this.buildState || !batch || !Array.isArray(batch.events) || batch.events.length === 0) return;
    syncBossCycle(this);
    // Scatter/piercing batches may report a secondary event before the actual
    // primary.  The primary event is the canonical shared D source; only when
    // no primary exists do we use the first landed event as a safe fallback.
    const first = batch.events.find((event) => event && event.isPrimary) || batch.events[0] || {};
    // D is captured once, before any route bonus. Every bonus reads this value.
    this.buildState.counters.directBaseDamage = Number(first.baseDamage ?? first.amount) || 0;
    this.hunterWindowOnBatch(batch);
    this.rapidOnBatch(batch);
    this.hunterOnBatch(batch);
    this.desperateOnBatch(batch);
};

Game.getSupplyPulseDuration = function() {
    const cfg = CONFIG.builds.supply;
    const duration = this.hasBuild('supply_duration') ? cfg.longPulseMs : cfg.pulseMs;
    return Math.min(duration, cfg.maxPulseMs);
};

Game.getSupplyPrimaryDamageBonus = function() {
    return this.hasBuild('supply_entry') && (this.buildState?.timers?.supplyPulse || 0) > 0
        ? CONFIG.builds.supply.primaryDamageBonus
        : 0;
};

Game.onItemCollected = function(event) {
    if (!this.buildState || !this.hasBuild('supply_entry') || !event || event.spawnSource !== 'natural') return;
    const state = this.buildState;
    const cfg = CONFIG.builds.supply;
    const magnetPickup = Boolean(event.collectedByMagnet || event.magnetized || event.viaMagnet || event.wasMagnet);
    addMetric(state, 'supplyNaturalPickups');
    if (magnetPickup) addMetric(state, 'supplyMagnetPickups');

    let progress = 1;
    if (event.type === 0) {
        if (!event.healingAllowed && !event.wasFull) progress = 0;
        if (event.wasFull && this.hasBuild('supply_capstone')) progress = cfg.fullHeartProgress;
    }
    if (progress <= 0) return;

    const next = (state.counters.supplyPickups || 0) + progress;
    if (next < cfg.pickups) {
        state.counters.supplyPickups = next;
        return;
    }

    state.counters.supplyPickups = 0;
    const duration = this.getSupplyPulseDuration();
    const current = state.timers.supplyPulse || 0;
    state.timers.supplyPulse = Math.min(cfg.maxPulseMs, current + duration);
    addMetric(state, 'supplyPulseCount');
};

Game.onEnemyKilled = function(killEvent = {}) {
    if (!this.buildState) return;
    syncBossCycle(this);
    const runtime = runtimeFor(this.buildState);
    const killKey = `${this.buildState.cycle}:${killEvent.entityId ?? ''}:${killEvent.source || ''}`;
    if (runtime.killKeys.has(killKey)) return;
    runtime.killKeys.add(killKey);
    this.rapidOnKill(killEvent);
    this.chainSeedFromKill(killEvent);
    this.desperateOnKill(killEvent);
};

// One actual life loss resets fortress charge; shields/barriers never reach
// this hook. Core thorns remains owned by the combat module.
Game.onActualPlayerDamage = function() {
    if (!this.buildState) return;
    this.buildState.timers.fortressBarrier = 0;
    if (this.activeCard === 'thorns' && typeof this.onThornsHit === 'function') this.onThornsHit();
};

Game.onFortressBarrierConsumed = function() {
    const state = this.buildState;
    if (!state || !this.player) return;
    const cfg = CONFIG.builds.fortress;
    const metrics = getBuildMetrics(state);
    addMetric(state, 'fortressBlocks');
    const { x, y } = centerOf(this.player);

    if (this.hasBuild('fortress_echo')) {
        this.emitBuildFeedback({ kind: 'fortress', echo: true, x, y, radius: cfg.echoRadius });
        const radiusSquared = cfg.echoRadius * cfg.echoRadius;
        for (const enemy of (this.objectPools?.enemies?.active || []).slice()) {
            if (!enemy || enemy._dead || enemy.health <= 0) continue;
            const enemyCenter = centerOf(enemy);
            const dx = enemyCenter.x - x;
            const dy = enemyCenter.y - y;
            if (dx * dx + dy * dy <= radiusSquared && typeof this.applyCombatDamage === 'function') {
                const dealt = this.applyCombatDamage(enemy, 'enemy', cfg.echoDamage, 'retaliation');
                addMetric(state, 'fortressEchoDamage', dealt ? cfg.echoDamage : 0);
            }
        }
    }

    if (this.hasBuild('fortress_capstone') && (state.timers.fortressClearCooldown || 0) <= 0) {
        this.emitBuildFeedback({ kind: 'fortress', clear: true, x, y, radius: cfg.clearRadius });
        clearCount(this, x, y, cfg.clearRadius, 'fortressBulletClears');
        state.timers.fortressClearCooldown = cfg.clearCooldownMs;
    }
    if (typeof this.createShockwave === 'function') this.createShockwave(x, y, '#7cff8a');
    void metrics;
};

// --- 连锁清场 chain ---------------------------------------------------------

Game.chainSeedFromKill = function(killEvent = {}) {
    if (killEvent.source !== 'direct') return false;
    if (this.activeCard !== 'chain' && !this.hasBuild('chain_entry')) return false;
    return this.createDamageExplosion({ x: killEvent.x, y: killEvent.y });
};

Game.createDamageExplosion = function(spec = {}) {
    const hasCore = this.activeCard === 'chain';
    const hasEntry = this.hasBuild('chain_entry');
    if (!hasCore && !hasEntry) return false;
    const state = this.buildState;
    const cfg = CONFIG.builds.chain;
    const radius = this.hasBuild('chain_radius') ? cfg.wideRadius : cfg.baseRadius;
    const chainId = ++this.nextChainId;
    const hitIds = new Set();
    const queue = [{ x: spec.x, y: spec.y, generation: 0 }];
    let chainKills = 0;
    let clearTriggered = false;
    const runtime = runtimeFor(state);

    while (queue.length > 0) {
        const point = queue.shift();
        const pointRadius = point.generation === 0 ? radius : cfg.spreadRadius;
        const pointDamage = point.generation === 0 ? cfg.baseDamage : cfg.spreadDamage;
        state.counters.chainGeneration = Math.max(state.counters.chainGeneration || 0, point.generation);
        state.counters.chainBlasts = (state.counters.chainBlasts || 0) + 1;
        addMetric(state, 'chainBlasts');
        this.emitBuildFeedback({
            kind: 'chain',
            x: point.x,
            y: point.y,
            generation: point.generation,
            wide: point.generation === 0 && this.hasBuild('chain_radius'),
            radius: pointRadius,
        });
        if (typeof this.createExplosion === 'function') this.createExplosion(point.x, point.y, point.generation ? '#ff9f68' : '#ff6b00', 2);
        if (typeof this.createShockwave === 'function') this.createShockwave(point.x, point.y);

        const candidates = typeof this.spatialGrid?.getWithinRadius === 'function'
            ? this.spatialGrid.getWithinRadius(point.x, point.y, pointRadius)
            : (this.objectPools?.enemies?.active || []).map((obj) => ({ poolType: 'enemies', obj }));
        for (const entry of candidates) {
            if (entry.poolType && entry.poolType !== 'enemies') continue;
            const enemy = entry.obj || entry;
            if (!enemy || enemy._dead || enemy.health <= 0) continue;
            const id = enemy.entityId ?? enemy;
            if (hitIds.has(id)) continue;
            const enemyCenter = centerOf(enemy);
            const dx = enemyCenter.x - point.x;
            const dy = enemyCenter.y - point.y;
            if (dx * dx + dy * dy > pointRadius * pointRadius) continue;
            hitIds.add(id);
            const before = enemy.health;
            const dealt = typeof this.applyCombatDamage === 'function'
                && this.applyCombatDamage(enemy, 'enemy', pointDamage, 'explosion', { chainId });
            if (!dealt || enemy.health > 0) continue;
            chainKills += 1;
            addMetric(state, 'chainKills');
            addMetric(state, 'chainExplosionKills');
            addMetric(state, 'chainBonusDamage', Math.max(0, before - Math.max(0, enemy.health)));
            if (this.hasBuild('chain_spread') && point.generation < cfg.maxGeneration) {
                queue.push({ x: enemyCenter.x, y: enemyCenter.y, generation: point.generation + 1 });
            }
            if (this.hasBuild('chain_capstone') && !clearTriggered && chainKills >= cfg.capstoneKills) {
                clearTriggered = true;
                this.emitBuildFeedback({ kind: 'chain', capstone: true, x: enemyCenter.x, y: enemyCenter.y, radius: cfg.capstoneRadius });
                clearCount(this, enemyCenter.x, enemyCenter.y, cfg.capstoneRadius, 'chainBulletClears');
            }
        }
    }
    runtime.lastChainId = chainId;
    runtime.lastChainKills = chainKills;
    return true;
};

// --- 疾速压制 rapid ---------------------------------------------------------

Game.consumeRapidBatchEffect = function() {
    const result = {
        rapidBatchBoosted: false,
        rapidDamageBonus: 0,
        pierceRemaining: 0,
        rapidPierce: 0,
    };
    if (!this.buildState || !this.hasBuild('rapid_entry') || (this.buildState.timers.rapidWarmup || 0) <= 0) return result;
    const state = this.buildState;
    const cfg = CONFIG.builds.rapid;
    state.counters.rapidHeatupShots = (state.counters.rapidHeatupShots || 0) + 1;
    if (state.counters.rapidHeatupShots % cfg.strengthenEveryShots !== 0) return result;
    const pierce = this.hasBuild('rapid_wide') ? cfg.widePierce : cfg.basePierce;
    result.rapidBatchBoosted = true;
    result.rapidDamageBonus = cfg.primaryDamageBonus;
    result.pierceRemaining = pierce;
    result.rapidPierce = pierce;
    addMetric(state, 'rapidBoostedBatches');
    return result;
};

// Existing player code asks for the primary pierce count. It is now only a
// thin adapter over actual-batch consumption; it carries no legacy cadence.
Game.getPrimaryPierceForShot = function() {
    return this.consumeRapidBatchEffect().pierceRemaining;
};

Game.extendRapidWarmup = function(ms) {
    if (!this.buildState || !this.hasBuild('rapid_capstone')) return 0;
    const state = this.buildState;
    const cfg = CONFIG.builds.rapid;
    if ((state.timers.rapidWarmup || 0) <= 0) return 0;
    const remainingExtension = Math.max(0, cfg.maxExtensionMs - (state.counters.rapidExtendedMs || 0));
    const room = Math.max(0, cfg.maxActiveMs - state.timers.rapidWarmup);
    const gain = Math.min(Math.max(0, Number(ms) || 0), remainingExtension, room);
    if (gain <= 0) return 0;
    state.timers.rapidWarmup += gain;
    state.counters.rapidExtendedMs = (state.counters.rapidExtendedMs || 0) + gain;
    addMetric(state, 'rapidExtensionMs', gain);
    return gain;
};

Game.rapidOnBatch = function(batch) {
    if (!this.hasBuild('rapid_entry')) return;
    const state = this.buildState;
    const runtime = runtimeFor(state);
    const shotId = batch.shotId ?? batch.events[0]?.shotId;
    if (shotId != null && runtime.rapidSeenShots.has(shotId)) return;
    if (shotId != null) runtime.rapidSeenShots.add(shotId);
    runtime.rapidIdleMs = 0;
    state.counters.rapidLastHit = this.gameTime;

    if ((state.timers.rapidWarmup || 0) > 0) {
        if (batch.events.some((event) => event.targetType === 'boss')) {
            state.counters.rapidBossHits = (state.counters.rapidBossHits || 0) + 1;
            if (state.counters.rapidBossHits >= CONFIG.builds.rapid.bossHitsForExtension) {
                state.counters.rapidBossHits = 0;
                this.extendRapidWarmup(CONFIG.builds.rapid.extensionMs);
            }
        }
        return;
    }

    state.counters.rapidHits = (state.counters.rapidHits || 0) + 1;
    if (state.counters.rapidHits < CONFIG.builds.rapid.hits) return;
    state.counters.rapidHits = 0;
    state.timers.rapidWarmup = CONFIG.builds.rapid.activeMs;
    state.counters.rapidHeatupShots = 0;
    state.counters.rapidBossHits = 0;
    state.counters.rapidExtendedMs = 0;
    addMetric(state, 'rapidActivations');
};

Game.rapidOnKill = function(killEvent = {}) {
    if (killEvent.source !== 'direct' || !this.hasBuild('rapid_capstone')) return;
    if ((this.buildState.timers.rapidWarmup || 0) <= 0) return;
    this.extendRapidWarmup(CONFIG.builds.rapid.extensionMs);
};

// --- 破甲猎王 hunter --------------------------------------------------------

Game.resolveBuildTarget = function(targetType, entityId) {
    if (targetType === 'boss') return this.boss && this.boss.entityId === entityId ? this.boss : null;
    if (typeof this.resolveLiveTarget === 'function') return this.resolveLiveTarget(targetType, entityId);
    return (this.objectPools?.enemies?.active || []).find((enemy) => enemy.entityId === entityId) || null;
};

Game.triggerBonusStrike = function(targetRef, multiplier, metric) {
    const state = this.buildState;
    const d = Number(state.counters.directBaseDamage) || 0;
    const amount = typeof this.roundCombatDamage === 'function'
        ? this.roundCombatDamage(d * multiplier)
        : Math.max(0, d * multiplier);
    const target = this.resolveBuildTarget(targetRef.targetType, targetRef.entityId);
    if (!target || amount <= 0 || typeof this.applyCombatDamage !== 'function') return false;
    if (!this.applyCombatDamage(target, targetRef.targetType, amount, 'bonus')) return false;
    addMetric(state, metric, amount);
    addMetric(state, 'bonusDamage', amount);
    if (typeof this.requestVisualHitStop === 'function' && metric === 'hunterPrecisionDamage') {
        this.requestVisualHitStop(CONFIG.builds.hunter.hitStopMs);
    }
    if (typeof this.createShockwave === 'function') {
        const { x, y } = centerOf(target);
        this.createShockwave(x, y, '#8ef');
    }
    return true;
};

Game.hunterWindowOnBatch = function(batch) {
    const state = this.buildState;
    if (!this.hasBuild('hunter_capstone') || (state.timers.hunterWindow || 0) <= 0) return;
    const event = batch.events.find((candidate) => this.resolveBuildTarget(candidate.targetType, candidate.entityId));
    if (!event) return;
    if (this.triggerBonusStrike(event, CONFIG.builds.hunter.windowMult, 'hunterWindowDamage')) {
        state.timers.hunterWindow = 0;
    }
};

Game.hunterOnBatch = function(batch) {
    if (!this.hasBuild('hunter_entry')) return;
    const state = this.buildState;
    const runtime = runtimeFor(state);
    const events = batch.events.filter((event) => this.resolveBuildTarget(event.targetType, event.entityId));
    if (events.length === 0) return;
    const locked = events.find((event) => event.entityId === state.locks.hunterTargetId) || events[0];
    const id = targetIdFor(locked);
    let targetState = runtime.hunterTargets.get(id);
    if (!targetState) targetState = { targetType: locked.targetType, entityId: locked.entityId, hits: 0, lastShotId: null, idleMs: 0 };
    const shotId = batch.shotId ?? locked.shotId;
    if (!targetState.seenShots) targetState.seenShots = new Set();
    if (targetState.seenShots.has(shotId)) return;
    targetState.seenShots.add(shotId);
    targetState.lastShotId = shotId;
    targetState.hits += 1;
    targetState.idleMs = 0;
    runtime.hunterTargets.set(id, targetState);
    state.locks.hunterTargetId = targetState.entityId;
    state.locks.hunterHits = targetState.hits;
    state.counters.hunterLastHit = this.gameTime;

    if (targetState.hits < CONFIG.builds.hunter.hits) return;
    targetState.hits = 0;
    targetState.seenShots.clear();
    state.locks.hunterHits = 0;
    const target = this.resolveBuildTarget(targetState.targetType, targetState.entityId);
    if (!target) return;
    const cfg = CONFIG.builds.hunter;
    const execute = target.health <= cfg.executeHealthRatio * target.maxHealth;
    const multiplier = execute ? cfg.executeMult : cfg.strikeMult;
    if (!this.triggerBonusStrike(targetState, multiplier, 'hunterPrecisionDamage')) return;
    addMetric(state, 'hunterPrecisionCount');
    if (targetState.targetType === 'boss' && this.hasBuild('hunter_capstone')) {
        state.timers.hunterWindow = cfg.windowMs;
    }
    if (this.hasBuild('hunter_capstone') && (state.timers.hunterClearCooldown || 0) <= 0) {
        const { x, y } = centerOf(target);
        this.emitBuildFeedback({
            kind: 'hunter',
            x,
            y,
            radius: cfg.clearRadius,
            targetId: targetState.entityId,
            damageLabel: `${multiplier}D`,
        });
        clearCount(this, x, y, cfg.clearRadius, 'hunterBulletClears');
        state.timers.hunterClearCooldown = cfg.clearCooldownMs;
    }
};

// --- 绝境反攻 desperate -----------------------------------------------------

Game.isDesperateActive = function() {
    const cfg = CONFIG.builds.desperate;
    const maxLives = this.getMaxLives();
    return this.hasBuild('desperate_entry')
        && maxLives >= 3
        && this.lives <= Math.floor(maxLives / 3);
};

Game.desperateOnBatch = function(batch) {
    if (!this.hasBuild('desperate_entry') || !this.isDesperateActive()) return;
    const state = this.buildState;
    const runtime = runtimeFor(state);
    const shotId = batch.shotId ?? batch.events[0]?.shotId;
    if (runtime.desperateSeenShots.has(shotId)) return;
    runtime.desperateSeenShots.add(shotId);
    state.counters.desperateHits = (state.counters.desperateHits || 0) + 1;
    if (state.counters.desperateHits < CONFIG.builds.desperate.hits) return;
    state.counters.desperateHits = 0;

    const hit = batch.events.find((event) => this.resolveBuildTarget(event.targetType, event.entityId));
    if (!hit) return;
    const target = this.resolveBuildTarget(hit.targetType, hit.entityId);
    if (!target) return;
    const cfg = CONFIG.builds.desperate;
    const execute = this.hasBuild('desperate_execute') && target.health <= cfg.executeHealthRatio * target.maxHealth;
    const multiplier = execute ? cfg.executeMult : cfg.strikeMult;
    if (!this.triggerBonusStrike(hit, multiplier, 'desperateStrikeDamage')) return;
    addMetric(state, 'desperateStrikeCount');
    if (this.hasBuild('desperate_clear')) {
        const { x, y } = centerOf(target);
        this.emitBuildFeedback({ kind: 'desperate', x, y, radius: cfg.clearRadius });
        clearCount(this, x, y, cfg.clearRadius, 'desperateBulletClears');
    }
};

Game.desperateOnKill = function(killEvent = {}) {
    if (killEvent.source !== 'direct' || killEvent.targetType === 'boss' || !this.hasBuild('desperate_capstone')) return;
    if (!this.isDesperateActive() || this.buildState.locks.desperateCycleHeal) return;
    const state = this.buildState;
    const cfg = CONFIG.builds.desperate;
    state.counters.desperateKills = Math.min(
        cfg.killsForHeal,
        (state.counters.desperateKills || 0) + 1,
    );
    if (state.counters.desperateKills < cfg.killsForHeal) return;
    if (typeof this.canHeal === 'function' && !this.canHeal()) return;
    const before = this.lives;
    const gained = typeof this.applyLifeGain === 'function' ? this.applyLifeGain(1) : 0;
    if (gained > 0 || this.lives > before) {
        state.counters.desperateKills = 0;
        state.locks.desperateCycleHeal = true;
        addMetric(state, 'effectiveHealing', this.lives - before);
    }
};

// --- Per-tick route timers --------------------------------------------------

Game.updateBuildEffects = function(deltaTime = 0) {
    if (!this.buildState) return;
    const state = this.buildState;
    const cfg = CONFIG.builds;
    const dt = Math.max(0, Number(deltaTime) || 0);
    const runtime = runtimeFor(state);
    syncBossCycle(this);

    if ((state.timers.rapidWarmup || 0) > 0) {
        state.timers.rapidWarmup = Math.max(0, state.timers.rapidWarmup - dt);
        if (state.timers.rapidWarmup === 0) {
            state.counters.rapidHeatupShots = 0;
            state.counters.rapidBossHits = 0;
            state.counters.rapidExtendedMs = 0;
            state.counters.rapidHits = this.hasBuild('rapid_reignite') ? cfg.rapid.retainedHits : 0;
        }
    } else if (this.hasBuild('rapid_entry') && (state.counters.rapidHits || 0) > 0) {
        runtime.rapidIdleMs += dt;
        if (runtime.rapidIdleMs >= cfg.rapid.decayMs) state.counters.rapidHits = 0;
    }

    if ((state.timers.hunterWindow || 0) > 0) state.timers.hunterWindow = Math.max(0, state.timers.hunterWindow - dt);
    if ((state.timers.hunterClearCooldown || 0) > 0) state.timers.hunterClearCooldown = Math.max(0, state.timers.hunterClearCooldown - dt);
    if ((state.timers.fortressClearCooldown || 0) > 0) state.timers.fortressClearCooldown = Math.max(0, state.timers.fortressClearCooldown - dt);
    state.timers.desperateClearCooldown = 0;
    state.timers.chainShockCooldown = 0;

    if (this.hasBuild('hunter_entry')) {
        for (const [id, target] of runtime.hunterTargets) {
            target.idleMs += dt;
            const timeout = this.hasBuild('hunter_lock') ? cfg.hunter.lockMemoryMs : cfg.hunter.resetMs;
            if (target.idleMs >= timeout) runtime.hunterTargets.delete(id);
        }
        const currentHunterTarget = [...runtime.hunterTargets.values()]
            .some((target) => target.entityId === state.locks.hunterTargetId);
        if (!currentHunterTarget) {
            state.locks.hunterTargetId = null;
            state.locks.hunterHits = 0;
        }
    }

    if (this.hasBuild('fortress_entry')) {
        if (!state.locks.fortressBarrier) {
            const chargeMs = this.hasBuild('fortress_regroup') ? cfg.fortress.regroupChargeMs : cfg.fortress.chargeMs;
            state.timers.fortressBarrier += dt;
            if (state.timers.fortressBarrier >= chargeMs) {
                state.timers.fortressBarrier = 0;
                state.locks.fortressBarrier = true;
            }
        }
    } else {
        state.timers.fortressBarrier = 0;
        state.locks.fortressBarrier = false;
    }

    if (this.hasBuild('supply_entry') && (state.timers.supplyPulse || 0) > 0) {
        const activePulseMs = Math.min(dt, state.timers.supplyPulse);
        state.timers.supplyPulse = Math.max(0, state.timers.supplyPulse - dt);
        addMetric(state, 'supplyPulseMs', activePulseMs);
    } else if (!this.hasBuild('supply_entry')) {
        state.timers.supplyPulse = 0;
        state.counters.supplyPickups = 0;
    }
};

// Candidate HUD rows are read-only projections. Active countdowns use tenths
// of seconds, counters use x/n, and cooldown rows expose disabled=true.
Game.getBuildHudStates = function() {
    if (!this.buildState) return [];
    const state = this.buildState;
    const cfg = CONFIG.builds;
    const associated = new Set(associatedLines[this.activeCard] || []);
    const candidates = [];
    const addRow = (row, active = false, near = false, cooldown = false) => candidates.push({ row: { ...row, active, cooldown, disabled: cooldown }, active, near, associated: associated.has(row.line) });
    if (this.hasBuild('rapid_entry')) {
        const warmup = state.timers.rapidWarmup || 0;
        addRow({ key: 'rapid', line: 'rapid', label: '热机', value: warmup > 0 ? `${(warmup / 1000).toFixed(1)}s/6.0s` : `${state.counters.rapidHits || 0}/${cfg.rapid.hits}` }, warmup > 0, warmup > 0 || (state.counters.rapidHits || 0) > 0);
    }
    if (this.hasBuild('fortress_entry')) {
        const chargeMs = this.hasBuild('fortress_regroup') ? cfg.fortress.regroupChargeMs : cfg.fortress.chargeMs;
        const barrier = Boolean(state.locks.fortressBarrier);
        const cooldown = this.hasBuild('fortress_capstone') && (state.timers.fortressClearCooldown || 0) > 0;
        addRow({ key: 'fortress', line: 'fortress', label: '屏障', value: barrier ? '就绪' : `${((state.timers.fortressBarrier || 0) / 1000).toFixed(1)}s/${(chargeMs / 1000).toFixed(1)}s` }, barrier, !barrier && (state.timers.fortressBarrier || 0) > 0, cooldown);
    }
    if (this.hasBuild('desperate_entry')) {
        const active = this.isDesperateActive();
        const reserve = this.hasBuild('desperate_capstone') ? ` · ${state.counters.desperateKills || 0}/${cfg.desperate.killsForHeal}` : '';
        addRow({ key: 'desperate', line: 'desperate', label: '背水', value: `${state.counters.desperateHits || 0}/${cfg.desperate.hits}${reserve}` }, active, active || (state.counters.desperateHits || 0) > 0);
    }
    if (this.hasBuild('chain_entry')) {
        const cooldown = state.timers.chainShockCooldown || 0;
        addRow({ key: 'chain', line: 'chain', label: '连锁', value: `${runtimeFor(state).lastChainKills || 0}/${cfg.chain.capstoneKills}` }, false, Boolean(runtimeFor(state).lastChainKills), cooldown > 0);
    }
    if (this.hasBuild('hunter_entry')) {
        const window = state.timers.hunterWindow || 0;
        const cooldown = this.hasBuild('hunter_capstone') && (state.timers.hunterClearCooldown || 0) > 0;
        addRow({ key: window > 0 ? 'hunterWindow' : 'hunter', line: 'hunter', label: window > 0 ? '猎王窗口' : '猎王', value: window > 0 ? `${(window / 1000).toFixed(1)}s/2.0s` : `${state.locks.hunterHits || 0}/${cfg.hunter.hits}` }, window > 0, window > 0 || (state.locks.hunterHits || 0) > 0, cooldown);
    }
    if (this.hasBuild('supply_entry')) {
        const pulse = state.timers.supplyPulse || 0;
        addRow({ key: 'supply', line: 'supply', label: pulse > 0 ? '补给脉冲' : '物资', value: pulse > 0 ? `${(pulse / 1000).toFixed(1)}s/8.0s` : `${state.counters.supplyPickups || 0}/${cfg.supply.pickups}` }, pulse > 0, pulse > 0 || (state.counters.supplyPickups || 0) > 0);
    }
    return candidates.sort((a, b) => {
        const statusA = a.active ? 2 : a.near ? 1 : 0;
        const statusB = b.active ? 2 : b.near ? 1 : 0;
        if (statusA !== statusB) return statusB - statusA;
        if (a.associated !== b.associated) return a.associated ? -1 : 1;
        return routeOrder.indexOf(a.row.line) - routeOrder.indexOf(b.row.line);
    }).slice(0, 2).map(({ row }) => row);
};

Game.renderRunSummary = function() {
    const state = this.buildState || { owned: [], metrics: {} };
    const rawMetrics = state.metrics || {};
    const elapsedMs = Math.max(0, Number(this.gameTime) || 0);
    const supplyPulseMs = numericMetric(rawMetrics, 'supplyPulseMs');
    const supplyPulseCoverage = elapsedMs > 0 ? Math.min(1, supplyPulseMs / elapsedMs) : 0;
    const metrics = {
        ...rawMetrics,
        fortressBlocks: numericMetric(rawMetrics, 'fortressBlocks'),
        chainKills: numericMetric(rawMetrics, 'chainKills'),
        hunterPrecisionDamage: numericMetric(rawMetrics, 'hunterPrecisionDamage'),
        hunterWindowDamage: numericMetric(rawMetrics, 'hunterWindowDamage'),
        desperateStrikeDamage: numericMetric(rawMetrics, 'desperateStrikeDamage'),
        bonusDamage: numericMetric(rawMetrics, 'bonusDamage'),
        bulletClears: ['fortressBulletClears', 'desperateBulletClears', 'chainBulletClears', 'hunterBulletClears'].reduce((sum, key) => sum + numericMetric(rawMetrics, key), 0),
        effectiveHealing: numericMetric(rawMetrics, 'effectiveHealing'),
        supplyNaturalPickups: numericMetric(rawMetrics, 'supplyNaturalPickups'),
        supplyMagnetPickups: numericMetric(rawMetrics, 'supplyMagnetPickups'),
        supplyPulseCount: numericMetric(rawMetrics, 'supplyPulseCount'),
        supplyPulseMs,
        supplyPulseCoverage,
    };
    const cardHistory = (Array.isArray(this.cardHistory) ? this.cardHistory : []).map((entry) => ({ ...entry, name: entry.name || this.CARDS?.[entry.cardId]?.name || entry.cardId || '未知卡片' }));
    const buildsOwned = (Array.isArray(state.owned) ? state.owned : []).map((id) => this.BUILDS[id]).filter(Boolean).map((build) => ({ id: build.id, line: build.line, stage: build.stage, name: build.name, summary: build.summary }));
    const contributions = { ...metrics };
    const summary = {
        score: Number(this.score) || 0,
        crowns: Number(this.crowns) || 0,
        elapsedMs,
        activeCard: this.activeCard ? { id: this.activeCard, name: this.CARDS?.[this.activeCard]?.name || this.activeCard } : null,
        cardHistory,
        cards: cardHistory,
        builds: buildsOwned,
        ownedBuilds: buildsOwned,
        metrics,
        contributions,
    };
    this.runSummary = summary;
    if (typeof document !== 'undefined') {
        const body = document.getElementById('runSummaryBody');
        if (body) {
            const cardRows = cardHistory.length > 0
                ? cardHistory.map((entry) => `<div class="summaryRow"><span class="summaryLabel">第${escapeSummaryText(entry.rewardIndex + 1)}轮核心卡</span><span class="summaryValue">${escapeSummaryText(entry.name)}${entry.kept ? ' · 保留' : ' · 更换'}</span></div>`).join('')
                : '<div class="summaryRow"><span class="summaryLabel">核心卡轨迹</span><span class="summaryValue">无</span></div>';
            const buildRows = buildsOwned.length > 0
                ? buildsOwned.map((build) => `<div class="summaryRow"><span class="summaryLabel">${escapeSummaryText(LINE_NAMES[build.line])}</span><span class="summaryValue">${escapeSummaryText(build.name)}</span></div>`).join('')
                : '<div class="summaryRow"><span class="summaryLabel">本局强化</span><span class="summaryValue">无</span></div>';
            body.innerHTML = cardRows + buildRows
                + `<div class="summarySectionTitle">强化贡献</div>`
                + `<div class="summaryRow"><span class="summaryLabel">屏障阻挡</span><span class="summaryValue">${metrics.fortressBlocks}</span></div>`
                + `<div class="summaryRow"><span class="summaryLabel">额外伤害</span><span class="summaryValue">${metrics.bonusDamage.toFixed(1)}</span></div>`
                + `<div class="summaryRow"><span class="summaryLabel">清弹数</span><span class="summaryValue">${metrics.bulletClears}</span></div>`
                + `<div class="summaryRow"><span class="summaryLabel">有效回血</span><span class="summaryValue">${metrics.effectiveHealing}</span></div>`
                + `<div class="summaryRow"><span class="summaryLabel">自然/牵引拾取</span><span class="summaryValue">${metrics.supplyNaturalPickups}/${metrics.supplyMagnetPickups}</span></div>`
                + `<div class="summaryRow"><span class="summaryLabel">补给覆盖率</span><span class="summaryValue">${(supplyPulseCoverage * 100).toFixed(1)}%</span></div>`;
        }
    }
    return summary;
};

// Keep the v2.1 projections authoritative if the legacy panel helpers below
// remain in this file for the existing DOM integration surface.
const renderV21BuildHudStates = Game.getBuildHudStates;
const renderV21RunSummary = Game.renderRunSummary;

// Candidate HUD rows for the owned build routes, ordered by visibility: the
// two most relevant rows win. Active states rank first, then near-trigger
// progress, then the active card's associated route, with the six-route order
// as the final stable tie-breaker.
Game.getBuildHudStates = function() {
    if (!this.buildState) return [];
    const state = this.buildState;
    const cfg = CONFIG.builds;
    const candidates = [];
    const associated = new Set(associatedLines[this.activeCard] || []);
    const addRow = (row, active, near) => {
        candidates.push({
            row,
            active,
            near,
            associated: associated.has(row.line),
        });
    };

    const rapidWarm = state.timers.rapidWarmup || 0;
    if (this.hasBuild('rapid_entry')) {
        if (rapidWarm > 0) {
            addRow({ key: 'rapid', line: 'rapid', label: '热机', value: `${(rapidWarm / 1000).toFixed(1)}s`, active: true }, true, true);
        } else {
            const hits = state.counters.rapidHits || 0;
            addRow({ key: 'rapid', line: 'rapid', label: '热机', value: `${hits}/${cfg.rapid.hits}`, active: false }, false, hits > 0);
        }
    }
    if (this.hasBuild('fortress_entry')) {
        const barrierReady = Boolean(state.locks.fortressBarrier);
        const chargeMs = this.hasBuild('fortress_regroup')
            ? cfg.fortress.regroupChargeMs : cfg.fortress.chargeMs;
        const charge = state.timers.fortressBarrier || 0;
        addRow({
            key: 'fortress',
            line: 'fortress',
            label: '屏障',
            value: barrierReady ? '就绪' : `${(charge / chargeMs * 100).toFixed(0)}%`,
            active: barrierReady,
        }, barrierReady, barrierReady || charge > 0);
    }
    if (this.hasBuild('desperate_entry')) {
        const desperateActive = typeof this.isDesperateActive === 'function' && this.isDesperateActive();
        const hits = state.counters.desperateHits || 0;
        const reserves = state.counters.desperateKills || 0;
        const value = this.hasBuild('desperate_capstone')
            ? `${hits}/${cfg.desperate.hits} · 储备${reserves}/${cfg.desperate.killsForHeal}`
            : `${hits}/${cfg.desperate.hits}`;
        addRow({
            key: 'desperate',
            line: 'desperate',
            label: '背水',
            value,
            active: desperateActive,
        }, desperateActive, desperateActive || hits > 0 || reserves > 0);
    }
    if (this.hasBuild('chain_entry')) {
        const shockCooldown = state.timers.chainShockCooldown || 0;
        const hasShock = this.hasBuild('chain_capstone');
        const shockReady = hasShock && shockCooldown <= 0;
        const blasts = state.counters.chainBlasts || 0;
        addRow({
            key: 'chain',
            line: 'chain',
            label: hasShock ? '震荡' : '连锁',
            value: hasShock
                ? shockCooldown > 0 ? `${(shockCooldown / 1000).toFixed(1)}s` : '就绪'
                : `${blasts}次`,
            active: shockReady && hasShock,
        }, shockReady && hasShock, shockCooldown > 0 || blasts > 0);
    }
    if (this.hasBuild('hunter_entry')) {
        const hunterWindow = state.timers.hunterWindow || 0;
        const hasWindow = hunterWindow > 0;
        const locked = state.locks.hunterTargetId != null;
        if (hasWindow) {
            addRow({ key: 'hunterWindow', line: 'hunter', label: '猎王窗口', value: `${(hunterWindow / 1000).toFixed(1)}s`, active: true }, true, true);
        } else {
            addRow({ key: 'hunter', line: 'hunter', label: '猎王', value: `${state.locks.hunterHits || 0}/${cfg.hunter.hits}`, active: false }, false, locked);
        }
    }
    if (this.hasBuild('supply_entry')) {
        const pulse = state.timers.supplyPulse || 0;
        const pickups = state.counters.supplyPickups || 0;
        const pulseActive = pulse > 0;
        addRow({
            key: 'supply',
            line: 'supply',
            label: pulseActive ? '补给脉冲' : '物资',
            value: pulseActive ? `${(pulse / 1000).toFixed(1)}s` : `${pickups}/${cfg.supply.pickups}`,
            active: pulseActive,
        }, pulseActive, pulseActive || pickups > 0);
        const candidate = candidates[candidates.length - 1];
        if (candidate) {
            candidate.active = pulseActive;
            candidate.near = pulseActive || pickups > 0;
        }
    }

    const sorted = candidates.sort((a, b) => {
        const statusA = a.active ? 2 : a.near ? 1 : 0;
        const statusB = b.active ? 2 : b.near ? 1 : 0;
        if (statusA !== statusB) return statusB - statusA;
        if (a.associated !== b.associated) return a.associated ? -1 : 1;
        return routeOrder.indexOf(a.row.line) - routeOrder.indexOf(b.row.line);
    });
    return sorted.slice(0, 2).map(({ row }) => row);
};

// Build a serializable end-of-run model first, then paint it only when the
// optional summary body exists. This keeps gameOver/headless tests independent
// of the DOM and lets the later UI layer choose its own surrounding panel.
Game.renderRunSummary = function() {
    const state = this.buildState || { owned: [], metrics: {} };
    const rawMetrics = state.metrics || {};
    const elapsedMs = Math.max(0, Number(this.gameTime) || 0);
    const supplyPulseMs = numericMetric(rawMetrics, 'supplyPulseMs');
    const supplyPulseCoverage = elapsedMs > 0
        ? Math.min(1, supplyPulseMs / elapsedMs)
        : 0;
    const metrics = {
        ...rawMetrics,
        fortressBlocks: numericMetric(rawMetrics, 'fortressBlocks'),
        chainKills: numericMetric(rawMetrics, 'chainKills'),
        hunterPrecisionDamage: numericMetric(rawMetrics, 'hunterPrecisionDamage'),
        hunterWindowDamage: numericMetric(rawMetrics, 'hunterWindowDamage'),
        desperateStrikeDamage: numericMetric(rawMetrics, 'desperateStrikeDamage'),
        supplyPulseMs,
        supplyPulseCount: numericMetric(rawMetrics, 'supplyPulseCount'),
        supplyPulseCoverage,
    };
    const cardHistory = (Array.isArray(this.cardHistory) ? this.cardHistory : []).map((entry) => ({
        ...entry,
        name: entry.name || this.CARDS?.[entry.cardId]?.name || entry.cardId || '未知卡片',
    }));
    const buildsOwned = (Array.isArray(state.owned) ? state.owned : [])
        .map((id) => this.BUILDS[id])
        .filter(Boolean)
        .map((build) => ({
            id: build.id,
            line: build.line,
            stage: build.stage,
            name: build.name,
            summary: build.summary,
        }));
    const contributions = {
        fortressBlocks: metrics.fortressBlocks,
        chainKills: metrics.chainKills,
        hunterPrecisionDamage: metrics.hunterPrecisionDamage,
        hunterWindowDamage: metrics.hunterWindowDamage,
        desperateStrikeDamage: metrics.desperateStrikeDamage,
        supplyPulseCoverage,
        supplyPulseMs,
        supplyPulseCount: metrics.supplyPulseCount,
    };
    const summary = {
        score: Number(this.score) || 0,
        crowns: Number(this.crowns) || 0,
        elapsedMs,
        activeCard: this.activeCard ? {
            id: this.activeCard,
            name: this.CARDS?.[this.activeCard]?.name || this.activeCard,
        } : null,
        cardHistory,
        cards: cardHistory,
        builds: buildsOwned,
        ownedBuilds: buildsOwned,
        metrics,
        contributions,
    };
    this.runSummary = summary;

    if (typeof document !== 'undefined') {
        const body = document.getElementById('runSummaryBody');
        if (body) {
            const cardRows = cardHistory.length > 0
                ? cardHistory.map((entry) => `<div class="summaryRow"><span class="summaryLabel">第${escapeSummaryText(entry.rewardIndex + 1)}轮核心卡</span><span class="summaryValue">${escapeSummaryText(entry.name)}${entry.kept ? ' · 保留' : ' · 更换'}</span></div>`).join('')
                : '<div class="summaryRow"><span class="summaryLabel">核心卡轨迹</span><span class="summaryValue">无</span></div>';
            const buildRows = buildsOwned.length > 0
                ? buildsOwned.map((build) => `<div class="summaryRow"><span class="summaryLabel">${escapeSummaryText(LINE_NAMES[build.line])}</span><span class="summaryValue">${escapeSummaryText(build.name)}</span></div>`).join('')
                : '<div class="summaryRow"><span class="summaryLabel">本局强化</span><span class="summaryValue">无</span></div>';
            body.innerHTML = cardRows
                + buildRows
                + `<div class="summarySectionTitle">强化贡献</div>`
                + `<div class="summaryRow"><span class="summaryLabel">屏障阻挡</span><span class="summaryValue">${metrics.fortressBlocks}</span></div>`
                + `<div class="summaryRow"><span class="summaryLabel">连锁击杀</span><span class="summaryValue">${metrics.chainKills}</span></div>`
                + `<div class="summaryRow"><span class="summaryLabel">精准伤害</span><span class="summaryValue">${contributions.hunterPrecisionDamage}</span></div>`
                + `<div class="summaryRow"><span class="summaryLabel">补给覆盖率</span><span class="summaryValue">${(supplyPulseCoverage * 100).toFixed(1)}%</span></div>`;
        }
    }
    return summary;
};

Game.getBuildHudStates = renderV21BuildHudStates;
Game.renderRunSummary = renderV21RunSummary;

Game.resetBuildState();
