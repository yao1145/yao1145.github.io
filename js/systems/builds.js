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

// --- Combat-event hook defaults (extended by the build mechanics) ----------
// flushDirectShotBatches() delivers one batch per shot id after the collision
// pass; killEnemy() broadcasts one event per settled death. Both stay no-ops
// until a route owns the relevant build, so the event pipeline always runs
// at the same cost.

Game.onDirectShotBatch = function() {};
Game.onEnemyKilled = function() {};

Game.resetBuildState();
