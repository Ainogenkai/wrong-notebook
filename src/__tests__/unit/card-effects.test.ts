import { describe, it, expect } from 'vitest';
import type { BattleCard, CardArchetype, CardTier } from '@/types/api';
import {
    resolveArchetype,
    buildCardEffect,
    buildPlusEffect,
    isWeaknessHit,
    ARCHETYPES,
    TIER_EFFECT_CONFIG,
    WEAKNESS_MULTIPLIER,
    BASE_CRIT_CHANCE,
    EFFECT_KEYWORD_RULES,
} from '@/lib/card-effects';

function makePlusCard(name: string, tier: CardTier = 'grandmaster'): BattleCard {
    return {
        uid: `p-${name}`,
        name,
        subject: 'physics',
        subjectLabel: '物理',
        path: [],
        tier,
        tierLabel: '',
        flavor: '',
        effect: buildCardEffect({ name, tier }),
    };
}

describe('lib/card-effects', () => {
    describe('resolveArchetype', () => {
        const cases: Array<[string, string[], CardArchetype]> = [
            // dot
            ['电流', [], 'dot'],
            ['焦耳定律', [], 'dot'],
            // multi
            ['振动', [], 'multi'],
            ['共振', [], 'multi'],
            // crit
            ['导数', [], 'crit'],
            ['切线', [], 'crit'],
            // guard
            ['浮力', [], 'guard'],
            ['守恒', [], 'guard'],
            // buff
            ['函数', [], 'buff'],
            ['杠杆', [], 'buff'],
            // draw
            ['概率', [], 'draw'],
            ['方差', [], 'draw'],
            // debuff
            ['摩擦', [], 'debuff'],
            ['阻力', [], 'debuff'],
            // strike
            ['牛顿', [], 'strike'],
            ['碰撞', [], 'strike'],
        ];

        it.each(cases)('卡名 %s → %s', (name, path, expected) => {
            expect(resolveArchetype(name, path)).toBe(expected);
        });

        it('未命中任何关键词时兜底为 strike', () => {
            expect(resolveArchetype('量子')).toBe('strike');
            expect(resolveArchetype('未知概念')).toBe('strike');
        });

        it('卡名无关键词时章节路径可参与匹配', () => {
            expect(resolveArchetype('甲', ['必修二', '概率与统计'])).toBe('draw');
            expect(resolveArchetype('乙物理量', ['高二上', '机械振动'])).toBe('multi');
        });
    });

    describe('buildCardEffect', () => {
        const tiers: CardTier[] = ['grandmaster', 'expert', 'skilled', 'flawed'];
        const effects = tiers.map((t) => buildCardEffect({ name: '牛顿', tier: t }));
        const [gm, ex, sk, fl] = effects;

        it('同一原型下 4 个品级数值缩放：宗师最大、破绽最小', () => {
            for (const e of effects) {
                expect(e.archetype).toBe('strike');
            }
            expect(gm.value).toBe(12);
            expect(gm.value).toBeGreaterThan(ex.value);
            expect(ex.value).toBeGreaterThan(sk.value);
            expect(sk.value).toBeGreaterThan(fl.value);
            expect(fl.value).toBe(4);
        });

        it('品级 cost 为 宗师 2 / 精通 1 / 熟练 1 / 破绽 0', () => {
            expect(TIER_EFFECT_CONFIG.grandmaster.cost).toBe(2);
            expect(TIER_EFFECT_CONFIG.expert.cost).toBe(1);
            expect(TIER_EFFECT_CONFIG.skilled.cost).toBe(1);
            expect(TIER_EFFECT_CONFIG.flawed.cost).toBe(0);
            expect([gm.cost, ex.cost, sk.cost, fl.cost]).toEqual([2, 1, 1, 0]);
        });

        it('宗师 strike 类无视护甲，破绽卡带 3 点自伤', () => {
            expect(gm.pierceArmor).toBe(true);
            expect(ex.pierceArmor).toBeUndefined();
            expect(sk.pierceArmor).toBeUndefined();
            expect(fl.pierceArmor).toBeUndefined();
            expect(fl.selfDamage).toBe(3);
            expect(gm.selfDamage).toBeUndefined();
            expect(ex.selfDamage).toBeUndefined();
            expect(sk.selfDamage).toBeUndefined();
        });

        it('description 包含数值文本', () => {
            for (const e of effects) {
                expect(e.description).toContain(String(e.value));
            }
            expect(gm.description).toBe('造成 12 点伤害，无视护甲');
            expect(fl.description).toBe('造成 4 点伤害');
        });

        it('非伤害原型附带各自字段', () => {
            const guard = buildCardEffect({ name: '浮力', tier: 'expert' });
            expect(guard.archetype).toBe('guard');
            expect(guard.block).toBe(7);
            expect(guard.description).toBe('获得 7 点护盾');

            const multi = buildCardEffect({ name: '振动', tier: 'skilled' });
            expect(multi.hits).toBe(3);
            expect(multi.duration).toBe(3);

            const dot = buildCardEffect({ name: '电功率', tier: 'skilled' });
            expect(dot.archetype).toBe('dot');
            expect(dot.value).toBe(2);
            expect(dot.duration).toBe(3);
        });
    });

    describe('isWeaknessHit', () => {
        it('卡名或路径命中章节关键词即为弱点命中', () => {
            expect(isWeaknessHit(['高一上', '相互作用——力'], '摩擦力', ['相互作用', '力'])).toBe(true);
            expect(isWeaknessHit([], '电磁感应', ['电磁'])).toBe(true);
        });

        it('未命中关键词返回 false', () => {
            expect(isWeaknessHit(['高一', '力学'], '加速度', ['概率', '统计'])).toBe(false);
        });

        it('空关键词数组返回 false', () => {
            expect(isWeaknessHit(['概率'], '概率', [])).toBe(false);
        });
    });

    describe('常量与规则表', () => {
        it('ARCHETYPES 覆盖 8 个原型且基础数值合法', () => {
            expect(Object.keys(ARCHETYPES)).toHaveLength(8);
            for (const meta of Object.values(ARCHETYPES)) {
                expect(meta.baseValue).toBeGreaterThanOrEqual(1);
                expect(meta.label.length).toBeGreaterThan(0);
                expect(meta.describe(meta.baseValue, {})).toBeTypeOf('string');
            }
        });

        it('关键词规则表 8 组，末组为 strike（兜底）', () => {
            expect(EFFECT_KEYWORD_RULES).toHaveLength(8);
            expect(EFFECT_KEYWORD_RULES[0].archetype).toBe('dot');
            expect(EFFECT_KEYWORD_RULES[7].archetype).toBe('strike');
        });

        it('弱点倍率 1.5，基础暴击率 0.25', () => {
            expect(WEAKNESS_MULTIPLIER).toBe(1.5);
            expect(BASE_CRIT_CHANCE).toBe(0.25);
        });
    });

    describe('buildPlusEffect（真·成就，战斗专属第 5 档）', () => {
        it('主题卡走逐卡手搓 up：牛顿第二定律 → F=ma·真', () => {
            const card = makePlusCard('牛顿第二定律');
            const plus = buildPlusEffect(card);
            expect(plus.archetypeLabel).toBe('F=ma·真');
            expect(plus.value).toBe(10);
            expect(plus.bonusPerCardPlayed).toBe(1);
            expect(plus.cost).toBeLessThanOrEqual(card.effect.cost);
        });

        it('非主题卡按原型兜底：牛顿（猛攻）→ 穿透 + 数值 ×2', () => {
            const card = makePlusCard('牛顿');
            const plus = buildPlusEffect(card);
            expect(plus.archetypeLabel).toBe('猛攻·真');
            expect(plus.pierceArmor).toBe(true);
            expect(plus.value).toBe(card.effect.value * 2);
            expect(plus.cost).toBeLessThanOrEqual(card.effect.cost);
        });

        it('连击原型 +1 段、灼烧原型 +1 回合', () => {
            const multi = buildPlusEffect(makePlusCard('振动'));
            expect(multi.hits).toBe(4);
            const dot = buildPlusEffect(makePlusCard('电功率'));
            expect(dot.duration).toBe(4);
            expect(dot.value).toBeGreaterThanOrEqual(3);
        });

        it('升级后费用只降不升（多卡抽样）', () => {
            for (const name of ['牛顿第二定律', '牛顿', '浮力', '摩擦']) {
                const card = makePlusCard(name);
                const plus = buildPlusEffect(card);
                expect(plus.cost).toBeLessThanOrEqual(card.effect.cost);
            }
        });

        it('破绽的自伤在升级后被移除', () => {
            const card = makePlusCard('牛顿', 'flawed');
            expect(card.effect.selfDamage).toBe(3);
            const plus = buildPlusEffect(card);
            expect(plus.selfDamage).toBeUndefined();
        });
    });
});
