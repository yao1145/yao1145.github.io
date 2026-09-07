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

// --- Combat-event hooks -----------------------------------------------------
// flushDirectShotBatches() delivers one batch per shot id after the collision
// pass; killEnemy() broadcasts one event per settled death. Each owned route
// subscribes through its own handler so unowned routes cost nothing.

Game.onDirectShotBatch = function(batch) {
    const first = batch.events[0];
    // D for this shot: bonus strikes read the same single damage computation.
    this.buildState.counters.directBaseDamage = first ? first.baseDamage : 0;
    this.hunterWindowOnBatch(batch);
    this.rapidOnBatch(batch);
    this.hunterOnBatch(batch);
};

Game.onEnemyKilled = function(killEvent) {
    this.rapidOnKill(killEvent);
    this.chainSeedFromKill(killEvent);
};

// --- 连锁清场 chain: merged kill-explosions --------------------------------
// The chain card's 200px cascade and the 爆破种子 seed are ONE event per kill:
// they share a radius/damage (the larger of both) and one chain id, so the
// core card and the build never detonate two independent explosions.

Game.chainSeedFromKill = function(killEvent) {
    if (killEvent.source !== 'direct') return;
    if (this.activeCard !== 'chain' && !this.hasBuild('chain_entry')) return;
    this.createDamageExplosion({
        x: killEvent.x,
        y: killEvent.y,
        damage: killEvent.damage,
    });
};

// Seeds and runs one kill-explosion chain. spec = { x, y, damage } where
// damage is the direct hit that caused the kill (D for the seed's 0.5D).
// Geometry limits: a merged (core) chain keeps the core card's 200px radius,
// its unbounded propagation and its 80-blast safety cap; a seed-only chain is
// capped at 12 blasts and propagates only with 二次引燃 (at most 2 extra
// blast layers). Each entity is hit once per chain; the boss takes only the
// seed part at half and never propagates; VFX failure never cancels damage.
Game.createDamageExplosion = function(spec) {
    const hasCore = this.activeCard === 'chain';
    const hasSeed = this.hasBuild('chain_entry');
    if (!hasCore && !hasSeed) return false;

    const cfg = CONFIG.builds.chain;
    const state = this.buildState;
    const seedRadius = cfg.seedRadius + (this.hasBuild('chain_wide') ? cfg.wideBonusRadius : 0);
    const seedDamage = this.roundCombatDamage(cfg.seedDamageMult * (spec.damage || 0));
    // Normal-enemy damage: the larger of the core blast and the seed's 0.5D.
    const damage = hasCore && hasSeed
        ? Math.max(CONFIG.cards.chainDamage, seedDamage)
        : hasSeed ? seedDamage : CONFIG.cards.chainDamage;
    const radius = hasCore ? CONFIG.cards.chainRadius : seedRadius;
    // The boss only ever takes the seed part, at half (新增爆炸部分半伤).
    const bossDamage = hasSeed
        ? this.roundCombatDamage(seedDamage * cfg.bossDamageMult)
        : 0;
    const seedOnly = !hasCore;
    const maxBlasts = seedOnly ? cfg.buildMaxExplosions : 80;
    const ignite = seedOnly && this.hasBuild('chain_ignite');
    // A merged (core) chain keeps the card's unbounded cascade; a seed-only
    // chain only cascades with 二次引燃, capped at 2 extra blast layers.
    const propagate = hasCore || ignite;
    const chainId = ++this.nextChainId;

    const queue = [{ x: spec.x, y: spec.y, depth: 0 }];
    const hitIds = new Set(); // every entity is hit at most once per chain
    let blasts = 0;
    let chainKills = 0;
    let shocked = false;

    while (queue.length > 0 && blasts < maxBlasts) {
        const point = queue.pop();
        blasts++;
        state.counters.chainBlasts = (state.counters.chainBlasts || 0) + 1;
        // Light blast VFX; a drained particle pool never cancels the damage.
        this.createExplosion(point.x, point.y, '#ff0', 2);
        this.createShockwave(point.x, point.y);

        const candidates = this.spatialGrid.getWithinRadius(point.x, point.y, radius);
        for (const entry of candidates) {
            if (entry.poolType !== 'enemies') continue;
            const enemy = entry.obj;
            if (!enemy || enemy._dead || enemy.health <= 0) continue;
            if (hitIds.has(enemy.entityId)) continue;
            const dx = enemy.x + enemy.width / 2 - point.x;
            const dy = enemy.y + enemy.height / 2 - point.y;
            if (dx * dx + dy * dy > radius * radius) continue;
            hitIds.add(enemy.entityId);

            enemy.health -= damage;
            if (enemy.health <= 0) {
                chainKills++;
                const killX = enemy.x + enemy.width / 2;
                const killY = enemy.y + enemy.height / 2;
                this.killEnemy(enemy, { source: 'explosion', chainId });
                if (propagate && (hasCore || point.depth + 1 <= cfg.buildMaxDepth)) {
                    queue.push({ x: killX, y: killY, depth: point.depth + 1 });
                }
                // 连锁震荡: the 3rd chain kill clears nearby enemy bullets —
                // once per chain, and the clear respects the global 5s cooldown.
                if (this.hasBuild('chain_capstone')
                    && !shocked && chainKills >= cfg.shockKills
                    && (state.timers.chainShockCooldown || 0) <= 0) {
                    shocked = true;
                    state.timers.chainShockCooldown = cfg.shockCooldownMs;
                    this.clearEnemyBulletsInRadius(killX, killY, cfg.shockRadius);
                }
            }
        }

        // The boss is not grid-inserted: check it per blast, once per chain.
        if (this.boss && !hitIds.has(this.boss.entityId)) {
            const bdx = this.boss.x + this.boss.width / 2 - point.x;
            const bdy = this.boss.y + this.boss.height / 2 - point.y;
            if (bdx * bdx + bdy * bdy <= radius * radius) {
                hitIds.add(this.boss.entityId);
                this.applyCombatDamage(this.boss, 'boss', bossDamage, 'explosion');
            }
        }
    }
    return true;
};

// --- 疾速压制 rapid: heat-up -> pierced primary shots -----------------------

// Reserves pierce for the primary bullet of every third shot fired while the
// heat-up is running; the ordinal only advances during the heat-up. Called
// once per shot by spawnBullet.
Game.getPrimaryPierceForShot = function(shotId) {
    if (!this.hasBuild('rapid_entry') || (this.buildState.timers.rapidWarmup || 0) <= 0) return 0;
    this.buildState.counters.rapidHeatupShots = (this.buildState.counters.rapidHeatupShots || 0) + 1;
    if (this.buildState.counters.rapidHeatupShots % 3 !== 0) return 0;
    const cfg = CONFIG.builds.rapid;
    return this.hasBuild('rapid_wide') ? cfg.widePierce : cfg.basePierce;
};

Game.rapidOnBatch = function(batch) {
    if (!this.hasBuild('rapid_entry')) return;
    const cfg = CONFIG.builds.rapid;
    const state = this.buildState;

    // One heat-up tick per shot, no matter how many bullets of the batch
    // landed; heated shots never accumulate the next round.
    if ((state.timers.rapidWarmup || 0) > 0) return;
    state.counters.rapidHits = (state.counters.rapidHits || 0) + 1;
    state.counters.rapidLastHit = this.gameTime;
    if (state.counters.rapidHits >= cfg.hits) {
        state.counters.rapidHits = 0;
        state.timers.rapidWarmup = cfg.activeMs;
        state.counters.rapidHeatupShots = 0;
        state.counters.rapidExtendedMs = 0;
    }
};

// 持续火力: a direct kill while heated extends the heat-up by 300ms per kill,
// up to 1.5s of total extension per round.
Game.rapidOnKill = function(killEvent) {
    if (killEvent.source !== 'direct' || !this.hasBuild('rapid_capstone')) return;
    const state = this.buildState;
    if ((state.timers.rapidWarmup || 0) <= 0) return;
    const cfg = CONFIG.builds.rapid;
    const used = state.counters.rapidExtendedMs || 0;
    if (used >= cfg.maxExtensionMs) return;
    const gain = Math.min(cfg.killExtensionMs, cfg.maxExtensionMs - used);
    state.timers.rapidWarmup += gain;
    state.counters.rapidExtendedMs = used + gain;
};

// --- 破甲猎王 hunter: single-target marks -> precision strike -> window -----

Game.hunterOnBatch = function(batch) {
    if (!this.hasBuild('hunter_entry')) return;
    const state = this.buildState;
    const lock = state.locks;
    const lockedId = lock.hunterTargetId;

    // Batch target: the still-active locked target when it was hit in this
    // batch, otherwise this batch's first hit that is still alive.
    let target = null;
    if (lockedId != null) {
        const hit = batch.events.find((e) => e.entityId === lockedId);
        if (hit) target = { targetType: hit.targetType, entityId: hit.entityId };
    }
    if (!target) {
        const hit = batch.events.find((e) => {
            return e.targetType === 'boss'
                ? this.boss && this.boss.entityId === e.entityId
                : this.isActiveEntity('enemies', e.entityId);
        });
        if (hit) target = { targetType: hit.targetType, entityId: hit.entityId };
    }
    if (!target) return;

    // Switching targets clears the accumulated marks.
    if (lockedId !== target.entityId) {
        lock.hunterTargetId = target.entityId;
        lock.hunterHits = 0;
    }
    lock.hunterHits += 1;
    state.counters.hunterLastHit = this.gameTime;

    if (lock.hunterHits >= CONFIG.builds.hunter.hits) {
        lock.hunterHits = 0;
        const live = this.resolveLiveTarget(target.targetType, target.entityId);
        // Target died or was recycled mid-batch: clear the lock, no strike.
        if (!live) {
            lock.hunterTargetId = null;
            return;
        }
        const cfg = CONFIG.builds.hunter;
        // 处决校准: 3D against targets at 30% health or below, else 2D.
        const execute = live.health <= cfg.executeHealthRatio * live.maxHealth;
        const mult = execute ? cfg.executeMult : cfg.strikeMult;
        if (this.triggerBonusStrike(target, mult, 'hunterPrecisionDamage')
            && target.targetType === 'boss' && this.hasBuild('hunter_capstone')) {
            // 猎王窗口: a boss precision strike opens the 2s window.
            state.timers.hunterWindow = cfg.windowMs;
        }
    }
};

// A precision strike is bonus damage: 2D/3D of the triggering batch's D dealt
// to the target with one feedback ring. Never counted back as a direct hit.
Game.triggerBonusStrike = function(targetRef, multiplier, metric) {
    const d = this.buildState.counters.directBaseDamage || 0;
    const amount = this.roundCombatDamage(d * multiplier);
    const target = this.resolveLiveTarget(targetRef.targetType, targetRef.entityId);
    if (!target) return false;
    if (!this.applyCombatDamage(target, targetRef.targetType, amount, 'bonus')) return false;

    this.buildState.metrics = this.buildState.metrics || {};
    this.buildState.metrics[metric] = (this.buildState.metrics[metric] || 0) + amount;
    // 追加打击单环: one expanding ring marks the strike point.
    this.createShockwave(target.x + target.width / 2, target.y + target.height / 2, '#8ef');
    return true;
};

// 猎王窗口: the first direct hit inside the 2s window after a boss strike
// deals +2D to its target and closes the window (windows never stack).
Game.hunterWindowOnBatch = function(batch) {
    const state = this.buildState;
    if ((state.timers.hunterWindow || 0) <= 0 || !this.hasBuild('hunter_capstone')) return;
    const first = batch.events[0];
    if (!first) return;

    const cfg = CONFIG.builds.hunter;
    const amount = this.roundCombatDamage(first.baseDamage * cfg.windowMult);
    const target = this.resolveLiveTarget(first.targetType, first.entityId);
    if (target && this.applyCombatDamage(target, first.targetType, amount, 'bonus')) {
        state.metrics = state.metrics || {};
        state.metrics.hunterWindowDamage = (state.metrics.hunterWindowDamage || 0) + amount;
        this.createShockwave(target.x + target.width / 2, target.y + target.height / 2, '#8ef');
    }
    state.timers.hunterWindow = 0;
};

// --- Per-tick build timers (called from Game.update) ------------------------

Game.updateBuildEffects = function(deltaTime) {
    if (!this.buildState) return;
    const state = this.buildState;
    const cfg = CONFIG.builds;

    // Rapid heat-up runs down; a natural end keeps 4 progress with 快速复燃.
    if ((state.timers.rapidWarmup || 0) > 0) {
        state.timers.rapidWarmup -= deltaTime;
        if (state.timers.rapidWarmup <= 0) {
            state.timers.rapidWarmup = 0;
            state.counters.rapidHeatupShots = 0;
            state.counters.rapidExtendedMs = 0;
            state.counters.rapidHits = this.hasBuild('rapid_reignite')
                ? cfg.rapid.retainedHits : 0;
        }
    } else if (this.hasBuild('rapid_entry')) {
        // 1.5s without a landed shot decays the accumulated progress.
        const lastHit = state.counters.rapidLastHit || 0;
        if ((state.counters.rapidHits || 0) > 0
            && lastHit > 0 && this.gameTime - lastHit >= cfg.rapid.decayMs) {
            state.counters.rapidHits = 0;
        }
    }

    // Hunter lock and window time out in simulation time.
    if (this.hasBuild('hunter_entry') && state.locks.hunterTargetId != null) {
        const lastHit = state.counters.hunterLastHit || 0;
        const timeout = this.hasBuild('hunter_stable')
            ? cfg.hunter.stableResetMs : cfg.hunter.resetMs;
        if (this.gameTime - lastHit >= timeout) {
            state.locks.hunterTargetId = null;
            state.locks.hunterHits = 0;
        }
    }
    if ((state.timers.hunterWindow || 0) > 0) {
        state.timers.hunterWindow -= deltaTime;
        if (state.timers.hunterWindow < 0) state.timers.hunterWindow = 0;
    }
    if ((state.timers.chainShockCooldown || 0) > 0) {
        state.timers.chainShockCooldown -= deltaTime;
        if (state.timers.chainShockCooldown < 0) state.timers.chainShockCooldown = 0;
    }
};

// Candidate HUD rows for the owned build routes, ordered by visibility: the
// two most relevant rows win. Active states (a running heat-up, an open
// window, a primed charge) rank first, then partial progress, and ties break
// by the stable six-route order. Later tasks add the remaining routes' rows.
Game.getBuildHudStates = function() {
    if (!this.buildState) return [];
    const state = this.buildState;
    const cfg = CONFIG.builds;
    const rows = [];

    const rapidWarm = state.timers.rapidWarmup || 0;
    if (this.hasBuild('rapid_entry')) {
        if (rapidWarm > 0) {
            rows.push({ key: 'rapid', line: 'rapid', label: '热机', value: `${(rapidWarm / 1000).toFixed(1)}s`, active: true });
        } else if ((state.counters.rapidHits || 0) > 0) {
            rows.push({ key: 'rapid', line: 'rapid', label: '热机', value: `${state.counters.rapidHits}/${cfg.rapid.hits}`, active: false });
        }
    }
    if (this.hasBuild('hunter_entry')) {
        if ((state.timers.hunterWindow || 0) > 0) {
            rows.push({ key: 'hunterWindow', line: 'hunter', label: '猎王窗口', value: `${((state.timers.hunterWindow) / 1000).toFixed(1)}s`, active: true });
        }
        if (state.locks.hunterTargetId != null) {
            rows.push({ key: 'hunter', line: 'hunter', label: '猎王', value: `${state.locks.hunterHits}/${cfg.hunter.hits}`, active: false });
        }
    }

    const routeRank = { rapid: 0, fortress: 1, desperate: 2, chain: 3, hunter: 4, supply: 5 };
    const sorted = rows.sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return routeRank[a.line] - routeRank[b.line];
    });
    return sorted.slice(0, 2);
};

Game.resetBuildState();
