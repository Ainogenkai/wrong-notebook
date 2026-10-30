import type {
    BattleAction,
    BattleCard,
    BattleEnemy,
    BattleReward,
    BattleStage,
    BattleState,
    CardTier,
    EnemyDef,
    EnemyExploit,
    EnemyIntent,
    EventChoice,
} from "@/types/api";
import {
    BASE_CRIT_CHANCE,
    buildCardEffect,
    isWeaknessHit,
    WEAKNESS_MULTIPLIER,
} from "@/lib/card-effects";
import { TIER_META } from "@/lib/cards";
import { availableNodes, buildMap, buildNodeStages, MAP_TOTAL_NODES, NODE_TYPE_LABEL } from "@/lib/card-map";
import { getEventById, pickEventId } from "@/lib/card-events";

// ===== 常量 =====

export const PLAYER_MAX_HP = 100;
export const PLAYER_MAX_ENERGY = 3;
export const DRAW_PER_TURN = 5;
export const HAND_MAX = 9;
export const BATTLE_DECK_SIZE = 12;

export const REWARD_HEAL = 15;
export const REWARD_DRAW = 3;
/** 抗性原型的伤害倍率 */
export const RESIST_MULTIPLIER = 0.5;

// ===== 品级升级链 =====

const TIER_UPGRADE: Record<CardTier, CardTier | null> = {
    flawed: "skilled",
    skilled: "expert",
    expert: "grandmaster",
    grandmaster: null,
};

// ===== 确定性随机（mulberry32，状态挂在 state.rngState） =====

function nextRandom(state: BattleState): number {
    let t = (state.rngState + 0x6d2b79f5) | 0;
    state.rngState = t;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
    let s = seed >>> 0;
    const random = (): number => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ===== 基础牌（卡池不足时补齐，通用道具） =====

export const BASIC_CARDS: BattleCard[] = [
    {
        uid: "basic-scratch",
        name: "草稿纸",
        subject: "colorless",
        subjectLabel: "通用",
        path: [],
        tier: "skilled",
        tierLabel: "通用",
        flavor: "没有哪张卷子不需要草稿纸",
        effect: {
            archetype: "draw",
            archetypeLabel: "调度",
            description: "抽 2 张牌，能量 +1",
            cost: 0,
            value: 2,
            drawCount: 2,
            energyGain: 1,
        },
    },
    {
        uid: "basic-eraser",
        name: "橡皮擦",
        subject: "colorless",
        subjectLabel: "通用",
        path: [],
        tier: "skilled",
        tierLabel: "通用",
        flavor: "改错也是学习的一部分",
        effect: {
            archetype: "debuff",
            archetypeLabel: "削弱",
            description: "敌人攻击 -3，持续 2 回合",
            cost: 0,
            value: 3,
            enemyAttackDown: 3,
            enemyAttackDownTurns: 2,
        },
    },
    {
        uid: "basic-formula",
        name: "基础公式",
        subject: "colorless",
        subjectLabel: "通用",
        path: [],
        tier: "skilled",
        tierLabel: "通用",
        flavor: "最朴素的一记直击",
        effect: {
            archetype: "strike",
            archetypeLabel: "猛攻",
            description: "造成 4 点伤害",
            cost: 1,
            value: 4,
        },
    },
];

// ===== 组卡 =====

export function buildDeckCards(selected: BattleCard[], deckSize: number = BATTLE_DECK_SIZE): BattleCard[] {
    const deck: BattleCard[] = selected.slice(0, deckSize).map((c) => ({ ...c }));
    let i = 0;
    while (deck.length < deckSize) {
        const basic = BASIC_CARDS[i % BASIC_CARDS.length];
        deck.push({ ...basic, uid: `${basic.uid}-${deck.length}` });
        i++;
    }
    return deck;
}

// ===== 敌人实例化 =====

function instantiateEnemy(def: EnemyDef, uid: string): BattleEnemy {
    return {
        uid,
        def,
        hp: def.hp,
        maxHp: def.hp,
        block: 0,
        intentIndex: 0,
        intentOrder: def.intents.map((_, i) => i),
        lockedIntents: 0,
        noChargeOnce: false,
        gainNullified: false,
        attackDown: 0,
        attackDownTurns: 0,
        poisoned: 0,
        poisonedTurns: 0,
        dotAuraDamage: def.trait === "dot_aura" ? def.intents.find((i) => i.kind === "special")?.value || 3 : 0,
        attackUp: 0,
        charged: false,
        phase: 1,
    };
}

function spawnStage(state: BattleState): void {
    state.enemies = state.stages[state.currentStage].map((def, i) =>
        instantiateEnemy(def, `s${state.currentStage}e${i}`)
    );
    state.targetIndex = 0;
}

// 地图模式：进入战斗节点（生成敌群 + 应用「下次战斗护盾」事件加成）
function enterCombatNode(state: BattleState): void {
    spawnStage(state);
    if ((state.player.nextBlock ?? 0) > 0) {
        state.player.block += state.player.nextBlock!;
        state.log.push(`布置防线：护盾 +${state.player.nextBlock}`);
        state.player.nextBlock = 0;
    }
}

// ===== 开局 =====

export function startBattle(
    selectedCards: BattleCard[],
    stages: BattleStage[],
    seed: number = (Date.now() % 9973) + 7
): BattleState {
    const deck = buildDeckCards(selectedCards);
    const state: BattleState = {
        phase: "player",
        turn: 1,
        player: {
            hp: PLAYER_MAX_HP,
            maxHp: PLAYER_MAX_HP,
            block: 0,
            energy: PLAYER_MAX_ENERGY,
            maxEnergy: PLAYER_MAX_ENERGY,
            nextCardDamageBonus: 0,
            energyDrainNextTurn: 0,
        },
        hand: [],
        drawPile: seededShuffle(deck, seed),
        discardPile: [],
        exhausted: [],
        stages,
        currentStage: 0,
        enemies: [],
        targetIndex: 0,
        cardsPlayedThisTurn: 0,
        archetypesThisTurn: [],
        lastDamage: 0,
        persistent: { enemyDamagePerTurn: 0, turnStartEnergy: 0, onIncomingPct: 0, reflectBlockPct: 0 },
        stacks: {},
        deck,
        log: [
            `爬塔开始：第 1 层「${stages[0].map((e) => e.name).join("、")}」（共 ${stages.length} 层）`,
        ],
        rewardTaken: false,
        cardsPlayed: 0,
        damageDealt: 0,
        rngState: seed + 1,
        nodesCleared: 0,
    };

    spawnStage(state);
    drawCards(state, DRAW_PER_TURN);
    return state;
}

// ===== 节点地图开局 =====

export function startMapBattle(
    selectedCards: BattleCard[],
    seed: number = (Date.now() % 9973) + 7
): BattleState {
    const map = buildMap(seed);
    const mapStages = buildNodeStages(seed);
    const deck = buildDeckCards(selectedCards);

    // 首个节点：第 0 列两个战斗节点里种子选一个
    const firstNodes = map.nodes.filter((n) => n.col === 0);
    const firstNode = firstNodes[seed % firstNodes.length] ?? map.nodes[0];

    const state: BattleState = {
        phase: "player",
        turn: 1,
        player: {
            hp: PLAYER_MAX_HP,
            maxHp: PLAYER_MAX_HP,
            block: 0,
            energy: PLAYER_MAX_ENERGY,
            maxEnergy: PLAYER_MAX_ENERGY,
            nextCardDamageBonus: 0,
            energyDrainNextTurn: 0,
        },
        hand: [],
        drawPile: seededShuffle(deck, seed),
        discardPile: [],
        exhausted: [],
        stages: mapStages[firstNode.id] ?? [[{ id: "stub", name: "占位", subject: "math", chapterKeywords: [], hp: 1, armor: 0, intents: [], traitDesc: "", desc: "" }]],
        currentStage: 0,
        enemies: [],
        targetIndex: 0,
        cardsPlayedThisTurn: 0,
        archetypesThisTurn: [],
        lastDamage: 0,
        persistent: { enemyDamagePerTurn: 0, turnStartEnergy: 0, onIncomingPct: 0, reflectBlockPct: 0 },
        stacks: {},
        deck,
        log: ["路线远征开始：第 1 个节点"],
        rewardTaken: false,
        cardsPlayed: 0,
        damageDealt: 0,
        rngState: seed + 1,
        map: map.nodes,
        mapSeed: seed,
        mapStages,
        path: [firstNode.id],
        currentNodeId: firstNode.id,
        pendingPanel: null,
        pendingEventId: undefined,
        nodesCleared: 0,
    };

    enterCombatNode(state);
    drawCards(state, DRAW_PER_TURN);
    state.log.push(`节点 1/${MAP_TOTAL_NODES}（${NODE_TYPE_LABEL[firstNode.type]}）：${state.enemies.map((e) => e.def.name).join("、")}`);
    return state;
}

// 解析节点：战斗类生成敌群，事件/休整挂起面板
function resolveMapNode(state: BattleState, nodeId: number, stage?: BattleStage): void {
    state.currentNodeId = nodeId;
    state.pendingPanel = null;
    state.rewardTaken = false;

    const node = state.map?.find((n) => n.id === nodeId);
    const type = node?.type ?? "battle";

    if (type === "battle" || type === "elite" || type === "boss") {
        state.stages = [stage ?? (state.mapStages?.[nodeId]?.[0]) ?? state.stages[0]];
        state.currentStage = 0;
        state.enemies = [];
        enterCombatNode(state);
        state.phase = "player";
        state.log.push(
            `节点 ${state.path?.length ?? 1}/${MAP_TOTAL_NODES}（${NODE_TYPE_LABEL[type]}）：${state.enemies
                .map((e) => e.def.name)
                .join("、")}`
        );
    } else if (type === "event") {
        state.enemies = [];
        state.phase = "reward";
        state.pendingPanel = "event";
        state.pendingEventId = pickEventId(state.mapSeed ?? 0, nodeId);
        state.log.push(`节点 ${state.path?.length ?? 1}/${MAP_TOTAL_NODES}（事件）：遇到一段际遇`);
    } else {
        // rest
        state.enemies = [];
        state.phase = "reward";
        state.pendingPanel = "rest";
        state.log.push(`节点 ${state.path?.length ?? 1}/${MAP_TOTAL_NODES}（休整）：稍作喘息`);
    }
}

function drawCards(state: BattleState, count: number): void {
    for (let i = 0; i < count; i++) {
        if (state.hand.length >= HAND_MAX) break;
        if (state.drawPile.length === 0) {
            if (state.discardPile.length === 0) break;
            state.drawPile = seededShuffle(state.discardPile, state.rngState + 0x9e3779b9);
            state.discardPile = [];
            state.log.push("弃牌堆洗回抽牌堆");
        }
        state.hand.push(state.drawPile.pop()!);
    }
}

// ===== 目标与生存判定 =====

function aliveEnemies(state: BattleState): BattleEnemy[] {
    return state.enemies.filter((e) => e.hp > 0);
}

/** 主题加成统一结算：出牌数/上次伤害/每敌/手牌/类型多样/永久堆叠 → 对所有原型生效（不只伤害） */
function themedBonus(state: BattleState, card: BattleCard): number {
    const e = card.effect;
    let bonus = 0;
    if (e.bonusPerCardPlayed) bonus += e.bonusPerCardPlayed * state.cardsPlayedThisTurn;
    if (e.lastDamageRatio) bonus += Math.floor(state.lastDamage * e.lastDamageRatio);
    if (e.perEnemyAlive) bonus += e.perEnemyAlive * aliveEnemies(state).length;
    if (e.handSizePer) bonus += Math.floor(state.hand.length / e.handSizePer);
    if (e.perArchetypeVariety) bonus += e.perArchetypeVariety * new Set(state.archetypesThisTurn).size;
    bonus += state.stacks[card.uid] ?? 0;
    return bonus;
}

function resolveTarget(state: BattleState, targetUid?: string): BattleEnemy | undefined {
    const alive = aliveEnemies(state);
    if (alive.length === 0) return undefined;
    if (targetUid) {
        const found = alive.find((e) => e.uid === targetUid);
        if (found) return found;
    }
    return alive[0];
}

// ===== 弱点技 =====

function applyExploit(state: BattleState, enemy: BattleEnemy, exploit: EnemyExploit): void {
    switch (exploit.kind) {
        case "energy":
            state.player.energy += exploit.value;
            break;
        case "block":
            state.player.block += exploit.value;
            break;
        case "enemyPoison":
            enemy.poisoned = Math.max(enemy.poisoned, exploit.value);
            enemy.poisonedTurns = 3;
            break;
        case "breakArmor":
            enemy.block = Math.max(0, enemy.block - exploit.value);
            break;
        case "recoverCard":
            drawCards(state, 1);
            break;
        case "lockIntent":
            enemy.lockedIntents = exploit.value;
            break;
        case "noCharge":
            enemy.noChargeOnce = true;
            break;
    }
    state.log.push(`弱点技：${exploit.text}`);
}

// ===== 护甲结算 =====

function applyArmorHits(hits: number, perHit: number, enemy: BattleEnemy, pierce: boolean): number {
    if (pierce) return perHit * hits;
    let blockLeft = enemy.block;
    let total = 0;
    for (let i = 0; i < hits; i++) {
        const absorbed = Math.min(blockLeft, perHit);
        blockLeft -= absorbed;
        total += perHit - absorbed;
    }
    enemy.block = blockLeft;
    return total;
}

// ===== 卡牌伤害结算 =====

function dealDamageToTargets(state: BattleState, card: BattleCard, targets: BattleEnemy[]): void {
    const effect = card.effect;

    // 条件型效果（条件概率）：前一张没打出伤害则整卡失效
    if (effect.ifLastDamage && state.lastDamage === 0) {
        state.log.push(`「${card.name}」条件不满足，效果落空`);
        return;
    }

    let dmg = effect.value + state.player.nextCardDamageBonus + (state.player.dmgBonus ?? 0) + themedBonus(state, card);
    state.player.nextCardDamageBonus = 0;
    dmg = Math.max(1, Math.round(dmg));

    let crit = false;
    if (effect.archetype === "crit" && nextRandom(state) < BASE_CRIT_CHANCE) {
        dmg = Math.round(dmg * (effect.critMultiplier || 2.5));
        crit = true;
    }
    if (effect.probBoost) {
        const r = nextRandom(state);
        if (r < effect.probBoost.p) {
            dmg = Math.max(1, Math.round(dmg * effect.probBoost.multiplier));
            state.log.push(`「${card.name}」概率爆发！效果 ×${effect.probBoost.multiplier}`);
        } else if (effect.probBoost.downMultiplier) {
            dmg = Math.max(1, Math.round(dmg * effect.probBoost.downMultiplier));
            state.log.push(`「${card.name}」概率落空，效果削弱`);
        }
    }

    const aoe = !!effect.allEnemies && targets.length > 1;
    const hits = aoe ? 1 : effect.archetype === "multi" ? effect.hits || 3 : 1;

    let lastDealt = 0;
    for (const enemy of targets) {
        if (enemy.hp <= 0) continue;

        let d = dmg;
        let resisted = false;
        if (enemy.def.resist?.includes(effect.archetype)) {
            d = Math.max(1, Math.floor(d * RESIST_MULTIPLIER));
            resisted = true;
        }

        const weakHit = isWeaknessHit(card.path, card.name, enemy.def.chapterKeywords);
        if (weakHit) {
            d = Math.round(d * WEAKNESS_MULTIPLIER);
            if (enemy.def.exploit) applyExploit(state, enemy, enemy.def.exploit);
        }

        // 连击语义：每次命中都造成完整伤害（armor 逐段吃），不是把总伤拆段
        const perHit = d;
        const dealt = applyArmorHits(hits, perHit, enemy, !!effect.pierceArmor);
        lastDealt = dealt;
        enemy.hp = Math.max(0, enemy.hp - dealt);
        state.damageDealt += dealt;

        const notes: string[] = [];
        if (resisted) notes.push("被抵抗");
        if (weakHit) notes.push(`弱点命中 ×${WEAKNESS_MULTIPLIER}`);
        if (crit) notes.push("暴击");
        if (hits > 1) notes.push(`${hits} 连击 ×${perHit}`);
        state.log.push(
            `「${card.name}」对「${enemy.def.name}」造成 ${dealt} 点伤害${notes.length ? `（${notes.join("、")}）` : ""}`
        );

        if (enemy.hp <= 0) {
            state.log.push(`「${enemy.def.name}」被击败了！`);
        }
    }
    state.lastDamage = lastDealt;
}

// ===== 主题扩展效果（打出时触发） =====

function applyThemedOnPlay(state: BattleState, card: BattleCard, target: BattleEnemy | undefined): void {
    const effect = card.effect;
    const label = `「${card.name}」`;

    if (effect.turnStartEnemyDamage) {
        state.persistent.enemyDamagePerTurn += effect.turnStartEnemyDamage;
        state.log.push(`${label}：生效期间，每个敌人回合开始敌人额外受 ${effect.turnStartEnemyDamage} 伤`);
    }
    if (effect.turnStartEnergy) {
        state.persistent.turnStartEnergy += effect.turnStartEnergy;
        state.log.push(`${label}：你的每个回合开始时能量 +${effect.turnStartEnergy}`);
    }
    if (effect.onIncomingPct) {
        state.persistent.onIncomingPct = Math.max(state.persistent.onIncomingPct, effect.onIncomingPct);
        state.log.push(`${label}：你受伤害时，攻击者将同步损失 ${effect.onIncomingPct}%`);
    }
    if (effect.reflectBlockPct) {
        state.persistent.reflectBlockPct = Math.max(state.persistent.reflectBlockPct, effect.reflectBlockPct);
        state.log.push(`${label}：护盾挡掉的伤害 ${effect.reflectBlockPct}% 将反弹给攻击者`);
    }
    if (effect.shuffleEnemyIntents) {
        for (const enemy of aliveEnemies(state)) {
            const order = [...enemy.intentOrder];
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(nextRandom(state) * (i + 1));
                [order[i], order[j]] = [order[j], order[i]];
            }
            enemy.intentOrder = order;
            state.log.push(`${label}：「${enemy.def.name}」的意图被打乱了`);
        }
    }
    if (effect.nullifyEnemyGain && target) {
        target.gainNullified = true;
        state.log.push(`${label}：${target.def.name} 本回合的增益被抵消`);
    }
    if (effect.stackPerPlay) {
        state.stacks[card.uid] = (state.stacks[card.uid] ?? 0) + effect.stackPerPlay;
        state.log.push(`${label}：本卡伤害永久 +${effect.stackPerPlay}`);
    }
}

// ===== 出牌 =====

export function canPlayCard(state: BattleState, card: BattleCard): boolean {
    return (
        state.phase === "player" &&
        state.hand.some((c) => c.uid === card.uid) &&
        card.effect.cost <= state.player.energy
    );
}

function playCard(state: BattleState, cardUid: string, targetUid?: string): void {
    const card = state.hand.find((c) => c.uid === cardUid);
    if (!card || state.phase !== "player") return;
    if (card.effect.cost > state.player.energy) {
        state.log.push(`能量不足，无法打出「${card.name}」（需要 ${card.effect.cost}）`);
        return;
    }

    state.player.energy -= card.effect.cost;
    state.hand = state.hand.filter((c) => c.uid !== cardUid);
    state.cardsPlayed += 1;
    state.log.push(`打出「${card.name}」（${card.effect.cost} 费）`);

    const target = resolveTarget(state, targetUid);
    const effect = card.effect;

    // 特性：出牌加护甲
    for (const enemy of aliveEnemies(state)) {
        if (enemy.def.trait === "armor_per_card") {
            enemy.block += 3;
            state.log.push(`「${enemy.def.name}」借你的出牌加固了护甲（+3）`);
        }
    }

    switch (effect.archetype) {
        case "strike":
        case "crit":
        case "multi": {
            const targets = effect.allEnemies ? aliveEnemies(state) : [target].filter(Boolean);
            dealDamageToTargets(state, card, targets as BattleEnemy[]);
            if (effect.block) {
                state.player.block += effect.block;
                state.log.push(`获得 ${effect.block} 点护盾`);
            }
            break;
        }
        case "guard": {
            const block = (effect.block || effect.value) + themedBonus(state, card);
            state.player.block += block;
            if (effect.heal) {
                state.player.hp = Math.min(state.player.maxHp, state.player.hp + effect.heal);
                state.log.push(`回复 ${effect.heal} 点自信值`);
            }
            const bonusNote = themedBonus(state, card) > 0 ? `（含主题加成 +${themedBonus(state, card)}）` : "";
            state.log.push(`获得 ${block} 点护盾${bonusNote}`);
            break;
        }
        case "buff": {
            if (effect.ifLastDamage && state.lastDamage === 0) {
                state.log.push(`「${card.name}」条件不满足（上一张没打出伤害），效果落空`);
                break;
            }
            const bonus = (effect.nextCardDamageBonus || effect.value) + themedBonus(state, card);
            state.player.nextCardDamageBonus += bonus;
            state.log.push(`下一张卡伤害 +${bonus}`);
            break;
        }
        case "draw": {
            const drawCount = (effect.drawCount || effect.value) + themedBonus(state, card);
            drawCards(state, drawCount);
            const gain = effect.energyGain ?? 1;
            if (gain > 0) state.player.energy += gain;
            state.log.push(`抽 ${drawCount} 张牌${gain > 0 ? `，能量 +${gain}` : ""}`);
            break;
        }
        case "debuff": {
            const targets = effect.allEnemies ? aliveEnemies(state) : [target].filter(Boolean);
            const enemies = (targets as BattleEnemy[]).filter((e) => e);
            const down = (effect.enemyAttackDown || effect.value) + themedBonus(state, card);
            for (const enemy of enemies) {
                enemy.attackDown = Math.max(enemy.attackDown, down);
                enemy.attackDownTurns = Math.max(enemy.attackDownTurns, effect.enemyAttackDownTurns || 2);
            }
            state.log.push(`${enemies.map((e) => `「${e.def.name}」`).join("")}攻击被削弱 ${down}（${effect.enemyAttackDownTurns || 2} 回合）`);
            break;
        }
        case "dot": {
            const targets = effect.allEnemies ? aliveEnemies(state) : [target].filter(Boolean);
            const enemies = (targets as BattleEnemy[]).filter((e) => e);
            const dotVal = effect.value + themedBonus(state, card);
            for (const enemy of enemies) {
                enemy.poisoned = Math.max(enemy.poisoned, dotVal);
                enemy.poisonedTurns = effect.duration || 3;
            }
            state.log.push(
                `${enemies.map((e) => `「${e.def.name}」`).join("")}被灼烧（每回合 ${dotVal}，持续 ${effect.duration || 3} 回合）`
            );
            break;
        }
    }

    // 本回合出牌计数（在效果结算后累加，"递增/组合"类效果只看之前的牌）
    state.cardsPlayedThisTurn += 1;
    state.archetypesThisTurn.push(effect.archetype);

    applyThemedOnPlay(state, card, target);

    // 破绽卡自伤
    if (effect.selfDamage && effect.selfDamage > 0) {
        state.player.hp = Math.max(0, state.player.hp - effect.selfDamage);
        state.log.push(`破绽卡反噬：你受到 ${effect.selfDamage} 点伤害`);
    }

    state.discardPile.push(card);

    for (const enemy of aliveEnemies(state)) checkBossPhase(state, enemy);

    if (aliveEnemies(state).length === 0) handleStageCleared(state);
}

function checkBossPhase(state: BattleState, enemy: BattleEnemy): void {
    if (enemy.def.trait !== "boss_phases") return;
    const ratio = enemy.hp / enemy.maxHp;
    const targetPhase = ratio > 2 / 3 ? 1 : ratio > 1 / 3 ? 2 : 3;
    if (targetPhase > enemy.phase) {
        enemy.phase = targetPhase;
        enemy.attackUp += 3;
        state.log.push(`「${enemy.def.name}」进入第 ${enemy.phase} 阶段，攻势更猛了！`);
    }
}

// ===== 层推进 =====

function handleStageCleared(state: BattleState): void {
    if (state.player.hp <= 0) {
        state.phase = "defeat";
        state.log.push("你被击倒了……");
        return;
    }
    if (state.map) {
        handleMapNodeCleared(state);
        return;
    }
    if (state.currentStage + 1 >= state.stages.length) {
        state.phase = "victory";
        state.log.push("全部层数被击穿，爬塔成功！");
        return;
    }
    state.currentStage += 1;
    state.phase = "reward";
    state.rewardTaken = false;
    state.pendingReward = getRewardOptions();
    spawnStage(state);
    state.log.push(`突破至第 ${state.currentStage + 1} 层：「${state.enemies.map((e) => e.def.name).join("、")}」`);
}

// 地图模式：当前节点敌群全灭
function handleMapNodeCleared(state: BattleState): void {
    const node = state.map?.find((n) => n.id === state.currentNodeId);
    state.nodesCleared += 1;
    state.enemies = [];

    if (node?.type === "boss") {
        state.phase = "victory";
        state.log.push("期末试卷被击败，路线远征成功！");
        return;
    }
    if (node?.type === "elite") {
        state.pendingReward = [{ kind: "upgrade", label: "精英奖励", desc: "击败精英：强化一张卡" }];
        state.pendingPanel = null;
        state.phase = "reward";
        state.rewardTaken = false;
        state.log.push("精英被击败！强化一张卡吧");
        return;
    }
    // 普通战斗节点清完：小口回复（StS 节奏：打完喘口气），再选节点
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 8);
    state.pendingReward = undefined;
    state.pendingPanel = "node";
    state.phase = "reward";
    state.log.push("节点清空：喘息一下（自信值 +8），选择下一个节点");
}

// ===== 敌人回合 =====

function currentIntent(enemy: BattleEnemy): EnemyIntent {
    const n = enemy.def.intents.length;
    const orderIdx = enemy.intentOrder[enemy.intentIndex % enemy.intentOrder.length] ?? 0;
    return enemy.def.intents[orderIdx % n];
}

function strongestAttackIntent(enemy: BattleEnemy): EnemyIntent {
    const attacks = enemy.def.intents.filter((i) => i.kind === "attack" || i.kind === "special");
    if (attacks.length === 0) return enemy.def.intents[0];
    return attacks.reduce((a, b) => ((b.value || 0) > (a.value || 0) ? b : a));
}

function enemyTurn(state: BattleState): void {
    for (const enemy of [...state.enemies]) {
        if (enemy.hp <= 0) continue;

        // 每回合开始获得护甲（EnemyDef.armor）
        if (enemy.def.armor > 0) enemy.block += enemy.def.armor;

        // 灼烧结算
        if (enemy.poisonedTurns > 0) {
            enemy.hp = Math.max(0, enemy.hp - enemy.poisoned);
            enemy.poisonedTurns -= 1;
            state.log.push(`「${enemy.def.name}」被灼烧 ${enemy.poisoned} 点`);
            if (enemy.hp <= 0) {
                state.log.push(`「${enemy.def.name}」被灼烧至灰烬！`);
                if (aliveEnemies(state).length === 0) {
                    handleStageCleared(state);
                    return;
                }
            }
        }
        if (enemy.poisonedTurns === 0) enemy.poisoned = 0;

        // 常驻效果：敌人回合开始受伤（万有引力类）
        if (state.persistent.enemyDamagePerTurn > 0 && enemy.hp > 0) {
            enemy.hp = Math.max(0, enemy.hp - state.persistent.enemyDamagePerTurn);
            state.log.push(`「${enemy.def.name}」被持续效应侵蚀 ${state.persistent.enemyDamagePerTurn} 点`);
            if (enemy.hp <= 0) {
                state.log.push(`「${enemy.def.name}」溃散了！`);
                if (aliveEnemies(state).length === 0) {
                    handleStageCleared(state);
                    return;
                }
            }
        }

        checkBossPhase(state, enemy);

        // 意图选择（弱点技锁定 / 乱序 / 随机特性）
        let intent = currentIntent(enemy);
        if (enemy.lockedIntents > 0) {
            intent = strongestAttackIntent(enemy);
            enemy.lockedIntents -= 1;
            state.log.push(`「${enemy.def.name}」的意图被锁定为攻击`);
        }
        if (enemy.def.trait === "random_intent" && enemy.lockedIntents === 0) {
            intent = enemy.def.intents[Math.floor(nextRandom(state) * enemy.def.intents.length)];
        }

        // 楞次抵消：本回合增益/蓄力/防御意图失效
        if (enemy.gainNullified && (intent.kind === "buff" || intent.kind === "charge" || intent.kind === "defend")) {
            enemy.gainNullified = false;
            state.log.push(`「${enemy.def.name}」的意图被抵消，什么也没发生`);
            if (enemy.attackDownTurns > 0) enemy.attackDownTurns -= 1;
            enemy.intentIndex += 1;
            continue;
        }
        // 锈链崩断：蓄力失效
        if (enemy.noChargeOnce && intent.kind === "charge") {
            enemy.noChargeOnce = false;
            state.log.push(`「${enemy.def.name}」的蓄力被打断了`);
            if (enemy.attackDownTurns > 0) enemy.attackDownTurns -= 1;
            enemy.intentIndex += 1;
            continue;
        }

        switch (intent.kind) {
            case "attack":
            case "special": {
                let total = (intent.value || 0) + enemy.attackUp;
                if (enemy.charged) {
                    total *= 2;
                    enemy.charged = false;
                    state.log.push(`「${enemy.def.name}」释放蓄力！`);
                }
                if (enemy.attackDownTurns > 0 && enemy.attackDown > 0) {
                    total = Math.max(0, total - enemy.attackDown);
                }
                const absorbed = Math.min(state.player.block, total);
                state.player.block -= absorbed;
                const damageToPlayer = total - absorbed;
                state.player.hp = Math.max(0, state.player.hp - damageToPlayer);

                // 全反射：护盾挡掉的伤害按比例反弹
                const reflectPct = state.persistent.reflectBlockPct ?? 0;
                let reflected = 0;
                if (reflectPct > 0 && absorbed > 0) {
                    reflected = Math.max(1, Math.floor((absorbed * reflectPct) / 100));
                    enemy.hp = Math.max(0, enemy.hp - reflected);
                    state.log.push(`「${enemy.def.name}」被反弹了 ${reflected} 点伤害`);
                }
                // 动量守恒：你受伤害时攻击者同步反伤
                const backPct = state.persistent.onIncomingPct;
                if (backPct > 0 && damageToPlayer > 0) {
                    const back = Math.max(1, Math.floor((damageToPlayer * backPct) / 100));
                    enemy.hp = Math.max(0, enemy.hp - back);
                    state.log.push(`动量守恒：「${enemy.def.name}」同步损失 ${back} 点`);
                }

                state.log.push(
                    `「${enemy.def.name}」${intent.text}：造成 ${damageToPlayer} 点伤害${absorbed > 0 ? `（护盾抵挡 ${absorbed}）` : ""}`
                );
                if (enemy.hp <= 0) {
                    state.log.push(`「${enemy.def.name}」被击败了！`);
                    if (aliveEnemies(state).length === 0) {
                        handleStageCleared(state);
                        return;
                    }
                }
                break;
            }
            case "defend":
                enemy.block += intent.value || 0;
                state.log.push(`「${enemy.def.name}」${intent.text}（护甲 +${intent.value || 0}）`);
                break;
            case "buff":
                enemy.attackUp += intent.value || 0;
                state.log.push(`「${enemy.def.name}」${intent.text}（攻击 +${intent.value || 0}）`);
                break;
            case "debuff":
                state.player.energyDrainNextTurn += intent.value || 1;
                state.log.push(`「${enemy.def.name}」${intent.text}（下回合能量 -${intent.value || 1}）`);
                break;
            case "charge":
                enemy.charged = true;
                state.log.push(`「${enemy.def.name}」正在蓄力……下一击伤害翻倍！`);
                break;
        }

        // 特性副作用
        if (enemy.def.trait === "dot_aura" && state.player.hp > 0) {
            const aura = enemy.dotAuraDamage;
            state.player.hp = Math.max(0, state.player.hp - aura);
            state.log.push(`「${enemy.def.name}」的热辐射灼伤了你 ${aura} 点`);
        }
        if (enemy.def.trait === "shield_regen") {
            enemy.block += 4;
        }
        if (enemy.def.trait === "force_discard" && state.hand.length > 0) {
            const idx = Math.floor(nextRandom(state) * state.hand.length);
            const removed = state.hand.splice(idx, 1)[0];
            state.discardPile.push(removed);
            state.log.push(`「${enemy.def.name}」的蛇尾抽走了你的「${removed.name}」`);
        }

        if (enemy.attackDownTurns > 0) enemy.attackDownTurns -= 1;
        enemy.intentIndex += 1;

        if (state.player.hp <= 0) {
            state.phase = "defeat";
            state.log.push("你被击倒了……");
            return;
        }
    }
}

// ===== 奖励 =====

function takeReward(state: BattleState, reward: "upgrade" | "heal" | "draw"): void {
    if (state.phase !== "reward" || state.rewardTaken) return;

    if (reward === "upgrade") {
        // 等待 UPGRADE_CARD 指定卡
        return;
    }

    if (reward === "heal") {
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + REWARD_HEAL);
        state.log.push(`回复 ${REWARD_HEAL} 点自信值`);
    } else {
        drawCards(state, REWARD_DRAW);
        state.log.push(`灵感闪现：抽了 ${REWARD_DRAW} 张牌`);
    }

    state.rewardTaken = true;
    if (state.map) {
        afterMapReward(state);
    } else {
        beginNextStageTurn(state);
    }
}

function upgradeCard(state: BattleState, cardUid: string): void {
    if (state.phase !== "reward" || state.rewardTaken) return;

    const nextTier = TIER_UPGRADE[(state.deck.find((c) => c.uid === cardUid)?.tier || "flawed") as CardTier];
    if (!nextTier) {
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + REWARD_HEAL);
        state.log.push("没有可强化的卡了，转为回复 15 点自信值");
        state.rewardTaken = true;
        if (state.map) afterMapReward(state);
        else beginNextStageTurn(state);
        return;
    }

    const upgradedTo = (uid: string, card: BattleCard): BattleCard =>
        uid === cardUid
            ? { ...card, tier: nextTier, tierLabel: TIER_META[nextTier].label, effect: buildCardEffect({ name: card.name, path: card.path, tier: nextTier }) }
            : card;

    state.deck = state.deck.map((c) => upgradedTo(c.uid, c));
    state.hand = state.hand.map((c) => upgradedTo(c.uid, c));
    state.drawPile = state.drawPile.map((c) => upgradedTo(c.uid, c));
    state.discardPile = state.discardPile.map((c) => upgradedTo(c.uid, c));

    const upgraded = state.deck.find((c) => c.uid === cardUid);
    state.log.push(`「${upgraded?.name}」强化为 ${TIER_META[nextTier].label}！`);

    state.rewardTaken = true;
    if (state.map) afterMapReward(state);
    else beginNextStageTurn(state);
}

// 地图模式：奖励后回到选节点（不自动进入下一层战斗）
function afterMapReward(state: BattleState): void {
    state.phase = "reward";
    state.pendingPanel = "node";
    state.log.push("选择下一个节点");
}

function beginNextStageTurn(state: BattleState): void {
    state.phase = "player";
    state.turn += 1;
    startPlayerTurn(state);
    state.log.push(`进入第 ${state.currentStage + 1} 层`);
}

// ===== 玩家回合开始 =====

function startPlayerTurn(state: BattleState): void {
    state.player.block = 0;
    state.player.energy = state.player.maxEnergy;
    state.cardsPlayedThisTurn = 0;
    state.archetypesThisTurn = [];

    if (state.persistent.turnStartEnergy > 0) {
        state.player.energy += state.persistent.turnStartEnergy;
        state.log.push(`能量持续生效：+${state.persistent.turnStartEnergy}`);
    }

    if ((state.player.nextTurnEnergy ?? 0) > 0) {
        state.player.energy += state.player.nextTurnEnergy!;
        state.log.push(`事件蓄能：能量 +${state.player.nextTurnEnergy}`);
        state.player.nextTurnEnergy = 0;
    }

    if (state.player.energyDrainNextTurn > 0) {
        const drain = state.player.energyDrainNextTurn;
        state.player.energy = Math.max(0, state.player.energy - drain);
        state.log.push(`能量被抽走 ${drain} 点`);
        state.player.energyDrainNextTurn = 0;
    }

    for (const enemy of aliveEnemies(state)) {
        if (enemy.def.trait === "drain_energy") {
            state.player.energy = Math.max(0, state.player.energy - 1);
            state.log.push(`「${enemy.def.name}」电击你的专注力（能量 -1）`);
        }
    }

    // 事件加成：本次战斗多抽牌（只在地图模式战斗节点生效一次）
    const extraDraw = state.map ? (state.player.nextDrawBonus ?? 0) : 0;
    if (extraDraw > 0) {
        state.player.nextDrawBonus = 0;
        state.log.push(`笔记加成：多抽 ${extraDraw} 张`);
    }
    drawCards(state, DRAW_PER_TURN + extraDraw);
}

// ===== 事件 / 休整 / 选节点（地图模式） =====

function applyEventChoice(state: BattleState, choice: EventChoice): void {
    const fx = choice.effects;
    if (fx.heal) {
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + fx.heal);
        state.log.push(`回复 ${fx.heal} 点自信值`);
    }
    if (fx.selfDamage) {
        state.player.hp = Math.max(0, state.player.hp - fx.selfDamage);
        state.log.push(`受到 ${fx.selfDamage} 点伤害`);
    }
    if (fx.dmgBonus) {
        state.player.dmgBonus = (state.player.dmgBonus ?? 0) + fx.dmgBonus;
        state.log.push(`所有伤害卡永久 +${fx.dmgBonus}（本局）`);
    }
    if (fx.energyBonus) {
        state.player.maxEnergy += fx.energyBonus;
        state.player.energyBonus = (state.player.energyBonus ?? 0) + fx.energyBonus;
        state.log.push(`最大能量 +${fx.energyBonus}`);
    }
    if (fx.nextTurnEnergy) {
        state.player.nextTurnEnergy = (state.player.nextTurnEnergy ?? 0) + fx.nextTurnEnergy;
        state.log.push(`下回合能量 +${fx.nextTurnEnergy}`);
    }
    if (fx.nextDrawBonus) {
        state.player.nextDrawBonus = (state.player.nextDrawBonus ?? 0) + fx.nextDrawBonus;
        state.log.push(`下次战斗多抽 ${fx.nextDrawBonus} 张`);
    }
    if (fx.nextBlock) {
        state.player.nextBlock = (state.player.nextBlock ?? 0) + fx.nextBlock;
        state.log.push(`下次战斗开始时护盾 +${fx.nextBlock}`);
    }
    if (fx.draw) {
        drawCards(state, fx.draw);
        state.log.push(`抽了 ${fx.draw} 张牌`);
    }
    if (fx.discardHand) {
        let discarded = 0;
        for (let i = 0; i < fx.discardHand && state.hand.length > 0; i++) {
            const c = state.hand.pop()!;
            state.discardPile.push(c);
            discarded++;
        }
        state.log.push(`弃掉 ${discarded} 张手牌`);
    }
    if (fx.upgradeRandom) {
        const upgradable = upgradableCards(state);
        if (upgradable.length > 0) {
            const pick = upgradable[Math.floor(nextRandom(state) * upgradable.length)];
            state.log.push(`随机强化了「${pick.name}」`);
            upgradeCard(state, pick.uid);
        } else {
            state.player.hp = Math.min(state.player.maxHp, state.player.hp + REWARD_HEAL);
            state.log.push("没有可强化的卡，转为回复 15 点自信值");
        }
    }
    if (fx.buffRandomCard) {
        const dmgCards = state.deck.filter((c) => c.effect.archetype === "strike" || c.effect.archetype === "multi" || c.effect.archetype === "crit");
        if (dmgCards.length > 0) {
            const pick = dmgCards[Math.floor(nextRandom(state) * dmgCards.length)];
            state.deck = state.deck.map((c) => (c.uid === pick.uid ? { ...c, effect: { ...c.effect, value: c.effect.value + fx.buffRandomCard! } } : c));
            state.hand = state.hand.map((c) => (c.uid === pick.uid ? { ...c, effect: { ...c.effect, value: c.effect.value + fx.buffRandomCard! } } : c));
            state.drawPile = state.drawPile.map((c) => (c.uid === pick.uid ? { ...c, effect: { ...c.effect, value: c.effect.value + fx.buffRandomCard! } } : c));
            state.log.push(`「${pick.name}」伤害永久 +${fx.buffRandomCard}`);
        }
    }
    if (fx.gamble) {
        const d = 1 + Math.floor(nextRandom(state) * 12);
        if (d % 2 === 0) {
            state.player.hp = Math.min(state.player.maxHp, state.player.hp + d);
            state.log.push(`掷出 ${d}（偶数）：回复 ${d} 点自信值`);
        } else {
            state.player.hp = Math.max(0, state.player.hp - d);
            state.log.push(`掷出 ${d}（奇数）：受到 ${d} 点伤害`);
        }
    }
}

function applyRestChoice(state: BattleState, kind: "heal" | "draw" | "shield"): void {
    if (kind === "heal") {
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + REWARD_HEAL);
        state.log.push(`休整：回复 ${REWARD_HEAL} 点自信值`);
    } else if (kind === "draw") {
        drawCards(state, REWARD_DRAW);
        state.log.push(`休整：整理笔记，抽 ${REWARD_DRAW} 张牌`);
    } else {
        state.player.block += 6;
        state.log.push("休整：休整完毕，护盾 +6");
    }
}

function chooseNode(state: BattleState, nodeId: number): void {
    if (state.phase !== "reward" || state.pendingPanel !== "node" || !state.map) return;
    const avail = availableNodes({ seed: state.mapSeed ?? 0, nodes: state.map }, state.path ?? []);
    const node = avail.find((n) => n.id === nodeId);
    if (!node) {
        state.log.push("该节点不可达，换个选择");
        return;
    }
    state.path = [...(state.path ?? []), nodeId];
    resolveMapNode(state, nodeId);
}

// ===== 主 reducer =====

export function applyAction(state: BattleState, action: BattleAction): BattleState {
    const s: BattleState = {
        ...state,
        player: { ...state.player },
        hand: [...state.hand],
        drawPile: [...state.drawPile],
        discardPile: [...state.discardPile],
        exhausted: [...state.exhausted],
        stages: state.stages,
        enemies: state.enemies.map((e) => ({ ...e })),
        deck: [...state.deck],
        log: [...state.log],
        archetypesThisTurn: [...state.archetypesThisTurn],
        persistent: { ...state.persistent },
        stacks: { ...state.stacks },
    };

    switch (action.type) {
        case "PLAY_CARD":
            playCard(s, action.cardUid, action.targetUid);
            break;
        case "END_TURN":
            if (s.phase === "player") {
                enemyTurn(s);
                if (s.phase === "player") {
                    s.turn += 1;
                    startPlayerTurn(s);
                }
            }
            break;
        case "TAKE_REWARD":
            takeReward(s, action.reward);
            break;
        case "UPGRADE_CARD":
            upgradeCard(s, action.cardUid);
            break;
        case "CHOOSE_NODE":
            if (s.phase === "reward" && s.pendingPanel === "node") {
                chooseNode(s, action.nodeId);
            }
            break;
        case "TAKE_EVENT": {
            if (s.phase === "reward" && s.pendingPanel === "event" && s.pendingEventId != null) {
                const ev = getEventById(s.pendingEventId);
                const choice = ev?.choices.find((c) => c.id === action.choice) ?? ev?.choices[0];
                if (ev && choice) {
                    s.log.push(`【${ev.name}】${choice.label}`);
                    applyEventChoice(s, choice);
                    s.pendingEventId = undefined;
                    if (s.pendingPanel === "event") s.pendingPanel = "node";
                    s.nodesCleared += 1;
                }
            }
            break;
        }
        case "TAKE_REST":
            if (s.phase === "reward" && s.pendingPanel === "rest") {
                applyRestChoice(s, action.kind);
                s.pendingPanel = "node";
                s.nodesCleared += 1;
            }
            break;
    }

    if (s.player.hp <= 0 && s.phase !== "defeat") {
        s.phase = "defeat";
        s.log.push("你被击倒了……");
    }

    return s;
}

// ===== 战报得分 =====

export function battleScore(state: BattleState): number {
    if (state.map) {
        if (state.phase === "defeat") return state.nodesCleared * 100 + state.damageDealt;
        return MAP_TOTAL_NODES * 100 + state.player.hp + state.damageDealt;
    }
    if (state.phase === "defeat") {
        return state.currentStage * 100 + state.damageDealt;
    }
    return state.stages.length * 100 + state.player.hp + state.damageDealt;
}

// ===== 辅助查询 =====

export function getAliveEnemies(state: BattleState): BattleEnemy[] {
    return aliveEnemies(state);
}

export function getCurrentEnemy(state: BattleState): BattleEnemy | undefined {
    return resolveTarget(state, undefined);
}

export function getEnemyByUid(state: BattleState, uid: string): BattleEnemy | undefined {
    return state.enemies.find((e) => e.uid === uid);
}

export function getNextIntent(enemy: BattleEnemy): EnemyIntent {
    return currentIntent(enemy);
}

export function upgradableCards(state: BattleState): BattleCard[] {
    return state.deck.filter((c) => TIER_UPGRADE[c.tier] !== null);
}

export function tierUpgrade(tier: CardTier): CardTier | null {
    return TIER_UPGRADE[tier];
}

export function getRewardOptions(): BattleReward[] {
    return [
        { kind: "upgrade", label: "强化一张卡", desc: "选择一张卡品级 +1（破绽→熟练→精通→宗师）" },
        { kind: "heal", label: `回复 ${REWARD_HEAL} 自信值`, desc: "直接回血" },
        { kind: "draw", label: "灵感闪现", desc: `立即抽 ${REWARD_DRAW} 张牌` },
    ];
}
