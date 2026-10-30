import { describe, it, expect } from 'vitest';
import type { BattleAction, BattleCard, BattleState, CardTier, EnemyDef, BattleStage } from '@/types/api';
import { buildCardEffect } from '@/lib/card-effects';
import { TIER_META } from '@/lib/cards';
import {
    startBattle,
    applyAction,
    battleScore,
    getCurrentEnemy,
    getNextIntent,
    upgradableCards,
    canPlayCard,
    buildDeckCards,
    BASIC_CARDS,
    BATTLE_DECK_SIZE,
    DRAW_PER_TURN,
    HAND_MAX,
    PLAYER_MAX_HP,
    PLAYER_MAX_ENERGY,
    REWARD_HEAL,
} from '@/lib/card-battle';
import { getEnemyById, buildEnemyStages } from '@/lib/card-enemies';

// ===== 测试用假卡（effect 由 buildCardEffect 生成，uid 唯一） =====

function makeCard(uid: string, name: string, tier: CardTier, path: string[] = []): BattleCard {
    return {
        uid,
        name,
        subject: 'physics',
        subjectLabel: '物理',
        path,
        tier,
        tierLabel: TIER_META[tier].label,
        flavor: '',
        effect: buildCardEffect({ name, path, tier }),
    };
}

const fakeCards = (): BattleCard[] => [
    makeCard('g1', '牛顿', 'grandmaster'), // 关键词 strike 宗师：12 伤，2 费，无视护甲
    makeCard('e1', '浮力', 'expert'), // 关键词 guard 精通：7 护盾，1 费
    makeCard('s1', '碰撞', 'skilled'), // 关键词 strike 熟练：6 伤，1 费
    makeCard('f1', '摩擦', 'flawed'), // 关键词 debuff 破绽：2 削弱，0 费，自伤 3
];

const tesla = (): EnemyDef => getEnemyById('tesla-leech')!;
const rusty = (): EnemyDef => getEnemyById('rusty-construct')!;

// 打当前层敌人直到进入 reward 阶段（每回合尽量打伤害牌）
function grindUntilReward(cards: BattleCard[], stages: BattleStage[], seed: number, maxRounds = 15): BattleState {
    let s = startBattle(cards, stages, seed);
    for (let r = 0; r < maxRounds && s.phase === 'player'; r++) {
        const affordable = s.hand.filter((c) => c.effect.cost <= s.player.energy);
        const card =
            affordable.find((c) => c.effect.archetype === 'strike' && !c.effect.allEnemies) ?? affordable[0];
        if (!card) break;
        s = applyAction(s, { type: 'PLAY_CARD', cardUid: card.uid });
        if (s.phase === 'player') s = applyAction(s, { type: 'END_TURN' });
    }
    return s;
}

// 固定手牌的确定性测试：绕过种子洗牌，手牌就是传入的 cards
function withHand(cards: BattleCard[], stage: EnemyDef[], seed = 3): BattleState {
    const s = startBattle(cards, [stage], seed);
    s.hand = cards.map((c) => ({ ...c }));
    return s;
}

describe('lib/card-battle', () => {
    describe('buildDeckCards', () => {
        it('卡组不足 12 张时用基础牌补足且 uid 唯一', () => {
            const deck = buildDeckCards(fakeCards());
            expect(deck).toHaveLength(BATTLE_DECK_SIZE);
            expect(new Set(deck.map((c) => c.uid)).size).toBe(BATTLE_DECK_SIZE);
            const padded = deck.slice(4);
            expect(padded).toHaveLength(8);
            for (const card of padded) {
                expect(BASIC_CARDS.some((b) => card.uid.startsWith(`${b.uid}-`))).toBe(true);
            }
        });

        it('超过 12 张时截取前 12 张', () => {
            const many = Array.from({ length: 14 }, (_, i) => makeCard(`m${i}`, '牛顿', 'skilled'));
            expect(buildDeckCards(many)).toHaveLength(BATTLE_DECK_SIZE);
        });
    });

    describe('startBattle', () => {
        it('开局状态：deck 12 张、手牌 5、player 阶段、能量 3', () => {
            const state = startBattle(fakeCards(), [[tesla()]], 42);
            expect(state.deck).toHaveLength(BATTLE_DECK_SIZE);
            expect(state.hand).toHaveLength(DRAW_PER_TURN);
            expect(state.drawPile.length).toBe(BATTLE_DECK_SIZE - DRAW_PER_TURN);
            expect(state.discardPile).toHaveLength(0);
            expect(state.phase).toBe('player');
            expect(state.turn).toBe(1);
            expect(state.player.energy).toBe(PLAYER_MAX_ENERGY);
            expect(state.player.hp).toBe(PLAYER_MAX_HP);
            expect(state.enemies).toHaveLength(1);
            expect(state.enemies[0].hp).toBe(28);
            expect(state.currentStage).toBe(0);
            expect(state.damageDealt).toBe(0);
        });

        it('相同 seed 两次 startBattle 手牌顺序相同（rngState 确定性）', () => {
            const a = startBattle(fakeCards(), [[tesla()]], 999);
            const b = startBattle(fakeCards(), [[tesla()]], 999);
            expect(a.hand.map((c) => c.uid)).toEqual(b.hand.map((c) => c.uid));
            expect(a.rngState).toBe(b.rngState);
        });
    });

    describe('PLAY_CARD', () => {
        it('打出 strike 宗师卡：敌人掉血、能量扣减、进弃牌堆、damageDealt 累加', () => {
            let state = startBattle(fakeCards(), [[tesla()]], 1);
            expect(state.hand.some((c) => c.uid === 'g1')).toBe(true);
            const enemyBefore = getCurrentEnemy(state)!;
            expect(enemyBefore.hp).toBe(28);

            state = applyAction(state, { type: 'PLAY_CARD', cardUid: 'g1' });

            expect(getCurrentEnemy(state)!.hp).toBe(16);
            expect(state.player.energy).toBe(PLAYER_MAX_ENERGY - 2);
            expect(state.discardPile.some((c) => c.uid === 'g1')).toBe(true);
            expect(state.hand.some((c) => c.uid === 'g1')).toBe(false);
            expect(state.damageDealt).toBe(12);
            expect(state.cardsPlayed).toBe(1);
        });

        it('打出破绽 strike 卡：玩家受到 3 点自伤', () => {
            const state0 = withHand([makeCard('f2', '碰撞', 'flawed')], [tesla()], 2);
            const hpBefore = state0.player.hp;

            const state = applyAction(state0, { type: 'PLAY_CARD', cardUid: 'f2' });

            expect(state.player.hp).toBe(hpBefore - 3);
            expect(getCurrentEnemy(state)!.hp).toBe(24); // 碰撞 破绽：0.6×6≈4 伤
            expect(state.discardPile.some((c) => c.uid === 'f2')).toBe(true);
            expect(state.log.some((l) => l.includes('破绽卡反噬'))).toBe(true);
        });

        it('组群战：targetUid 指定目标只伤害目标', () => {
            const s0 = withHand([makeCard('g1', '自由落体运动', 'skilled')], [tesla(), rusty()], 7);
            const targets = s0.enemies;
            expect(targets).toHaveLength(2);
            const teslaUid = targets.find((e) => e.def.id === 'tesla-leech')!.uid;
            const rustyUid = targets.find((e) => e.def.id === 'rusty-construct')!.uid;

            // 打 tesla（resist=dot、非弱点）→ 全额 7；rusty 不受影响
            const s = applyAction(s0, {
                type: 'PLAY_CARD',
                cardUid: 'g1',
                targetUid: teslaUid,
            });

            expect(s.enemies.find((e) => e.uid === teslaUid)!.hp).toBe(28 - 7);
            expect(s.enemies.find((e) => e.uid === rustyUid)!.hp).toBe(32);
        });

        it('抗性原型伤害减半（锈铁傀儡 resist strike）', () => {
            const s0 = withHand([makeCard('v1', '速度', 'skilled')], [rusty()], 3);
            const s = applyAction(s0, { type: 'PLAY_CARD', cardUid: 'v1' });
            // 速度主题 strike v5 × 抗性 0.5 = 2.5 → 2
            expect(s.enemies[0].hp).toBe(30);
            expect(s.log.some((l) => l.includes('被抵抗'))).toBe(true);
        });

        it('弱点命中触发弱点技（tesla exploit：能量 +1）', () => {
            const s0 = withHand([makeCard('c1', '电容', 'skilled')], [tesla()], 3);
            const energyBefore = s0.player.energy;
            const s = applyAction(s0, { type: 'PLAY_CARD', cardUid: 'c1' });
            // 电容 v8 命中「电」弱点 ×1.5 = 12
            expect(s.enemies[0].hp).toBe(28 - 12);
            expect(s.player.energy).toBe(energyBefore - 2 + 1); // 电容 2 费 + exploit 回 1
            expect(s.log.some((l) => l.includes('弱点技'))).toBe(true);
        });

        it('主题卡「集合」是并集抽牌而非猛攻', () => {
            const s0 = withHand([makeCard('j1', '集合', 'skilled')], [tesla()], 3);
            const handBefore = s0.hand.length;
            const s = applyAction(s0, { type: 'PLAY_CARD', cardUid: 'j1' });
            expect(s.enemies[0].hp).toBe(28); // 无伤害
            expect(s.hand.length).toBe(handBefore + 1); // 抽 2 扣 1
            expect(s.player.energy).toBe(4); // 3 - 0费 + 1回能
            const card = s0.hand.find((c) => c.uid === 'j1')!;
            expect(card.effect.description).toContain('抽 2');
        });

        it('主题卡「单调性」随本回合出牌递增', () => {
            const s0 = withHand(
                [makeCard('m1', '单调性', 'skilled'), makeCard('m2', '单调性', 'skilled')],
                [tesla()],
                3
            );
            let s = applyAction(s0, { type: 'PLAY_CARD', cardUid: 'm1' });
            // 第一张：3 伤
            expect(s.enemies[0].hp).toBe(28 - 3);
            s = applyAction(s, { type: 'PLAY_CARD', cardUid: 'm2' });
            // 第二张：3 + 2×1（已出 1 张）= 5
            expect(s.enemies[0].hp).toBe(28 - 3 - 5);
        });

        it('主题卡「光的干涉与衍射」群体命中', () => {
            const s0 = withHand(
                [makeCard('g1', '光的干涉与衍射', 'skilled')],
                [tesla(), getEnemyById('entropy-flame')!],
                3
            );
            const s = applyAction(s0, { type: 'PLAY_CARD', cardUid: 'g1' });
            expect(s.enemies.find((e) => e.def.id === 'tesla-leech')!.hp).toBe(28 - 3);
            expect(s.enemies.find((e) => e.def.id === 'entropy-flame')!.hp).toBe(24 - 3);
        });

        it('主题卡「电容」stackPerPlay：打出后登记堆叠，堆叠计入后续伤害', () => {
            const cards = [makeCard('c1', '电容', 'skilled'), makeCard('c2', '电容', 'skilled')];
            // 登记：打出 c1 后 stacks['c1'] = 2
            let s1 = withHand(cards, [tesla()], 3);
            s1 = applyAction(s1, { type: 'PLAY_CARD', cardUid: 'c1' });
            expect(s1.stacks['c1']).toBe(2);

            // 结算：预置 c2 的堆叠（模拟此前打出过），伤害 (8+2)×1.5=15
            let s2 = withHand(cards, [tesla()], 3);
            s2.stacks['c2'] = 2;
            s2 = applyAction(s2, { type: 'PLAY_CARD', cardUid: 'c2' });
            expect(s2.enemies[0].hp).toBe(28 - 15);
        });

        it('主题卡「参考系」（guard + perEnemyAlive）：存活敌人数加护盾', () => {
            const card = makeCard('r1', '参考系', 'skilled');
            const s0 = withHand([card], [tesla(), getEnemyById('entropy-flame')!], 3);
            const s = applyAction(s0, { type: 'PLAY_CARD', cardUid: 'r1' });
            // 双敌：护盾 = 3 + 2×1 = 5
            expect(s.player.block).toBe(5);
            expect(s.log.some((l) => l.includes('主题加成 +2'))).toBe(true);
        });

        it('主题卡「三角函数」（multi）：每次命中全额伤害，护甲逐段吃', () => {
            const card = makeCard('t1', '三角函数', 'skilled');
            // 无护甲：2 × 3 = 6
            const s0 = withHand([card], [tesla()], 3);
            const s = applyAction(s0, { type: 'PLAY_CARD', cardUid: 't1' });
            expect(s.enemies[0].hp).toBe(28 - 6);
            expect(s.log.some((l) => l.includes('2 连击 ×3'))).toBe(true);
            // 护甲 3：首段被全吃，第二段 3 全中 → 总 3
            const s1 = withHand([card], [tesla()], 3);
            s1.enemies[0].block = 3;
            const s2 = applyAction(s1, { type: 'PLAY_CARD', cardUid: 't1' });
            expect(s2.enemies[0].hp).toBe(28 - 3);
            expect(s2.enemies[0].block).toBe(0);
        });

        it('主题卡「三角函数恒等变换」（buff + bonusPerCardPlayed）：本回合出牌数加 buff', () => {
            const cards = [makeCard('a1', '基础公式', 'skilled'), makeCard('a2', '三角函数恒等变换', 'skilled')];
            let s = withHand(cards, [tesla()], 3);
            s = applyAction(s, { type: 'PLAY_CARD', cardUid: 'a1' });
            s = applyAction(s, { type: 'PLAY_CARD', cardUid: 'a2' });
            // 3 + 1×1（前一张已出）= 4
            expect(s.player.nextCardDamageBonus).toBe(4);
        });

        it('主题卡「动量守恒定律」onIncomingPct：受击时攻击者反伤', () => {
            const s0 = withHand([makeCard('d1', '动量守恒定律', 'skilled')], [tesla()], 3);
            let s = applyAction(s0, { type: 'PLAY_CARD', cardUid: 'd1' });
            // 动量守恒 v6（非弱点、tesla 不抗 strike）
            expect(s.enemies[0].hp).toBe(28 - 6);
            s = applyAction(s, { type: 'END_TURN' });
            // tesla 首意图 attack 5 → 玩家受伤 5，攻击者反伤 floor(5×0.3)=1
            expect(s.player.hp).toBe(100 - 5);
            expect(s.enemies[0].hp).toBe(28 - 6 - 1);
            expect(s.log.some((l) => l.includes('动量守恒'))).toBe(true);
        });

        it('能量不足时出牌失败，状态基本不变', () => {
            let state = startBattle(fakeCards(), [[rusty()]], 4);
            state = applyAction(state, { type: 'PLAY_CARD', cardUid: 'e1' }); // 1 费护盾
            state = applyAction(state, { type: 'PLAY_CARD', cardUid: 's1' }); // 1 费猛攻
            expect(state.player.energy).toBe(1);

            const enemyHp = getCurrentEnemy(state)!.hp;
            const discardSize = state.discardPile.length;
            const blockBefore = state.player.block;

            state = applyAction(state, { type: 'PLAY_CARD', cardUid: 'g1' }); // 2 费 > 1 能量

            expect(state.player.energy).toBe(1);
            expect(getCurrentEnemy(state)!.hp).toBe(enemyHp);
            expect(state.discardPile.length).toBe(discardSize);
            expect(state.hand.some((c) => c.uid === 'g1')).toBe(true);
            expect(state.player.block).toBe(blockBefore);
            expect(state.log.some((l) => l.includes('能量不足'))).toBe(true);
        });

        it('canPlayCard 校验阶段、手牌与费用', () => {
            const state = startBattle(fakeCards(), [[rusty()]], 4);
            expect(canPlayCard(state, state.hand.find((c) => c.uid === 'e1')!)).toBe(true);
            const g1 = state.hand.find((c) => c.uid === 'g1')!;
            expect(canPlayCard(state, g1)).toBe(true);

            const drained = applyAction(applyAction(state, { type: 'PLAY_CARD', cardUid: 'e1' }), {
                type: 'PLAY_CARD',
                cardUid: 's1',
            });
            expect(canPlayCard(drained, drained.hand.find((c) => c.uid === 'g1')!)).toBe(false);
            expect(canPlayCard(state, makeCard('zzz', '牛顿', 'skilled'))).toBe(false);
            expect(canPlayCard({ ...state, phase: 'defeat' }, g1)).toBe(false);
        });
    });

    describe('END_TURN', () => {
        it('敌人按意图行动：rusty-construct 首意图 attack 6', () => {
            const state = startBattle(fakeCards(), [[rusty()]], 2);
            expect(getNextIntent(getCurrentEnemy(state)!)).toEqual({ kind: 'attack', value: 6, text: '挥臂重击' });

            const after = applyAction(state, { type: 'END_TURN' });

            expect(after.player.hp).toBe(PLAYER_MAX_HP - 6);
            expect(after.enemies[0].intentIndex).toBe(1);
            expect(after.turn).toBe(2);
        });

        it('组群战：同层多敌依次行动，伤害累加', () => {
            const state = startBattle(fakeCards(), [[tesla(), rusty()]], 2);
            const after = applyAction(state, { type: 'END_TURN' });
            // tesla 首意图 attack 5 + rusty 首意图 attack 6 = 11
            expect(after.player.hp).toBe(100 - 11);
        });

        it('player block 可抵挡伤害：有/无护盾的 hp 差等于攻击值', () => {
            const noGuard = applyAction(startBattle(fakeCards(), [[rusty()]], 4), { type: 'END_TURN' });
            expect(noGuard.player.hp).toBe(94);

            let withGuard = startBattle(fakeCards(), [[rusty()]], 4);
            withGuard = applyAction(withGuard, { type: 'PLAY_CARD', cardUid: 'e1' });
            expect(withGuard.player.block).toBe(7);
            withGuard = applyAction(withGuard, { type: 'END_TURN' });

            expect(withGuard.player.hp).toBe(100);
            expect(withGuard.player.hp - noGuard.player.hp).toBe(6);
            expect(withGuard.log.some((l) => l.includes('护盾抵挡'))).toBe(true);
        });
    });

    describe('弱点伤害', () => {
        it('主题卡命中 tesla 弱点时 ×1.5（电容 8 → 12）', () => {
            const weak0 = withHand(
                [makeCard('w1', '电容', 'skilled'), makeCard('n1', '牛顿', 'skilled')],
                [tesla()],
                1
            );
            let weak = applyAction(weak0, { type: 'PLAY_CARD', cardUid: 'w1' });
            expect(weak.enemies[0].hp).toBe(28 - 12);
            expect(weak.damageDealt).toBe(12);
            expect(weak.log.some((l) => l.includes('弱点命中'))).toBe(true);

            // 「牛顿」不命中弱点 → 6 伤
            const plain0 = withHand(
                [makeCard('w1', '电容', 'skilled'), makeCard('n1', '牛顿', 'skilled')],
                [tesla()],
                4
            );
            weak = applyAction(plain0, { type: 'PLAY_CARD', cardUid: 'n1' });
            expect(weak.enemies[0].hp).toBe(28 - 6);
            expect(weak.damageDealt).toBe(6);
        });
    });

    describe('层间奖励流', () => {
        const rewardDeck = (): BattleCard[] => [
            makeCard('g1', '牛顿', 'grandmaster'),
            makeCard('g2', '牛顿', 'grandmaster'),
            makeCard('g3', '牛顿', 'grandmaster'),
            makeCard('g4', '牛顿', 'grandmaster'),
            makeCard('f1', '摩擦', 'flawed'),
        ];
        const twoStages = (): BattleStage[] => [[getEnemyById('entropy-flame')!], [getEnemyById('dice-priest')!]];

        it('击杀当前层进入 reward 阶段并给出 3 个奖励选项', () => {
            const s = grindUntilReward(rewardDeck(), twoStages(), 42);
            expect(s.phase).toBe('reward');
            expect(s.currentStage).toBe(1);
            expect(s.enemies[0].def.id).toBe('dice-priest');
            expect(s.enemies[0].hp).toBe(30);
            expect(s.pendingReward!.map((r) => r.kind)).toEqual(['upgrade', 'heal', 'draw']);
        });

        it('TAKE_REWARD heal：回 15 血并开始下一层', () => {
            const s = grindUntilReward(rewardDeck(), twoStages(), 42);
            expect(s.phase).toBe('reward');
            const before = s.player.hp;

            const s2 = applyAction(s, { type: 'TAKE_REWARD', reward: 'heal' });

            expect(s2.player.hp).toBe(Math.min(s2.player.maxHp, before + REWARD_HEAL));
            expect(s2.currentStage).toBe(1);
            expect(s2.phase).toBe('player');
            expect(s2.enemies[0].def.id).toBe('dice-priest');
        });

        it('TAKE_REWARD upgrade + UPGRADE_CARD：卡品级提升且数值变大', () => {
            const s = grindUntilReward(rewardDeck(), twoStages(), 42);
            expect(s.phase).toBe('reward');

            const upgradable = upgradableCards(s);
            expect(upgradable.some((c) => c.uid === 'f1')).toBe(true);
            expect(upgradable.some((c) => c.uid === 'g1')).toBe(false);

            const s2 = applyAction(s, { type: 'TAKE_REWARD', reward: 'upgrade' });
            expect(s2.phase).toBe('reward');

            const before = s2.deck.find((c) => c.uid === 'f1')!;
            expect(before.tier).toBe('flawed');
            expect(before.effect.value).toBe(2);

            const s3 = applyAction(s2, { type: 'UPGRADE_CARD', cardUid: 'f1' });
            const after = s3.deck.find((c) => c.uid === 'f1')!;
            expect(after.tier).toBe('skilled');
            expect(after.effect.value).toBe(3);
            expect(after.effect.value).toBeGreaterThan(before.effect.value);
            expect(s3.currentStage).toBe(1);
            expect(s3.phase).toBe('player');
        });

        it('TAKE_REWARD draw：灵感闪现抽 3 张并开始下一层', () => {
            const s = grindUntilReward(rewardDeck(), twoStages(), 13);
            const handSize = s.hand.length;

            const s2 = applyAction(s, { type: 'TAKE_REWARD', reward: 'draw' });

            expect(s2.log.some((l) => l.includes('灵感闪现'))).toBe(true);
            expect(s2.hand.length).toBeGreaterThanOrEqual(handSize);
            expect(s2.hand.length).toBeLessThanOrEqual(HAND_MAX);
            expect(s2.currentStage).toBe(1);
            expect(s2.phase).toBe('player');
        });
    });

    describe('getCurrentEnemy / getNextIntent', () => {
        it('返回当前目标敌人及其下一个意图', () => {
            const state = startBattle(fakeCards(), [[rusty(), tesla()]], 11);
            expect(getCurrentEnemy(state)!.def.id).toBe('rusty-construct');
            expect(getNextIntent(state.enemies[0])).toEqual({ kind: 'attack', value: 6, text: '挥臂重击' });
            expect(getNextIntent(state.enemies[1])).toEqual({ kind: 'attack', value: 5, text: '电击吮吸' });
        });
    });

    describe('battleScore', () => {
        it('只 END_TURN 到阵亡后得分为 0（0 层 × 100 + 0 伤害）', () => {
            let s = startBattle(fakeCards(), [[getEnemyById('entropy-flame')!]], 5);
            for (let i = 0; i < 60 && s.phase === 'player'; i++) {
                s = applyAction(s, { type: 'END_TURN' });
            }
            expect(s.phase).toBe('defeat');
            expect(s.currentStage).toBe(0);
            expect(s.damageDealt).toBe(0);
            expect(battleScore(s)).toBe(s.currentStage * 100 + s.damageDealt);
        });

        it('victory 阶段得分为 层数×100 + 剩余 hp + 总伤害', () => {
            let s = startBattle(fakeCards(), [[getEnemyById('entropy-flame')!]], 5);
            for (let i = 0; i < 60 && s.phase === 'player'; i++) {
                s = applyAction(s, { type: 'END_TURN' });
            }
            const fakeVictory: BattleState = { ...s, phase: 'victory' };
            expect(battleScore(fakeVictory)).toBe(
                fakeVictory.stages.length * 100 + fakeVictory.player.hp + fakeVictory.damageDealt
            );
        });
    });

    describe('全流程', () => {
        it('buildEnemyStages 8 层组群波（最后 BOSS），宗师卡组可走到终局', () => {
            const stages = buildEnemyStages(123);
            expect(stages).toHaveLength(8);
            expect(stages[stages.length - 1][0].isBoss).toBe(true);
            expect(stages[4]).toHaveLength(3);
            const sizePattern = stages.map((s) => s.length);
            expect(sizePattern).toEqual([1, 2, 1, 2, 3, 2, 1, 1]);

            const cards = Array.from({ length: 8 }, (_, i) => makeCard(`gm-${i + 1}`, '牛顿', 'grandmaster'));
            let state = startBattle(cards, stages, 2024);

            let guard = 0;
            while ((state.phase === 'player' || state.phase === 'reward') && guard < 400) {
                guard += 1;
                if (state.phase === 'reward') {
                    state = applyAction(state, { type: 'TAKE_REWARD', reward: 'heal' });
                    continue;
                }
                const affordable = state.hand.filter((c) => c.effect.cost <= state.player.energy);
                const card = affordable[0];
                if (card) state = applyAction(state, { type: 'PLAY_CARD', cardUid: card.uid });
                if (state.phase === 'player') state = applyAction(state, { type: 'END_TURN' });
            }

            expect(['victory', 'defeat']).toContain(state.phase);
            expect(Number.isFinite(battleScore(state))).toBe(true);
        });

        it('同一 seed 同一卡组走相同 action 序列 → 相同日志（确定性）', () => {
            const mkCards = () => fakeCards();
            const a0 = startBattle(mkCards(), [[rusty(), tesla()]], 555);
            const b0 = startBattle(mkCards(), [[rusty(), tesla()]], 555);

            const actions: BattleAction[] = [
                { type: 'PLAY_CARD', cardUid: a0.hand[0].uid },
                { type: 'END_TURN' },
                { type: 'END_TURN' },
                { type: 'END_TURN' },
            ];
            let a = a0;
            let b = b0;
            for (const act of actions) {
                a = applyAction(a, act);
                b = applyAction(b, act);
            }

            expect(a.log).toEqual(b.log);
            expect(a.rngState).toBe(b.rngState);
            expect(a.hand.map((c) => c.uid)).toEqual(b.hand.map((c) => c.uid));
        });
    });
});
