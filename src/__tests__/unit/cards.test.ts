import { describe, it, expect } from 'vitest';
import {
    compileDeck,
    computeCardTier,
    effectiveErrorCount,
    formatCardPath,
    summarizeDeck,
    TIER_META,
    TIER_ORDER,
    type DeckSourceRow,
} from '@/lib/cards';

describe('lib/cards', () => {
    describe('computeCardTier', () => {
        it('未测过的知识点不生成卡牌', () => {
            expect(
                computeCardTier({ probability: 0, totalTested: 0, correctCount: 0, errorCount: 0 })
            ).toBeNull();
        });

        it('高概率且胜场足够时为宗师', () => {
            expect(
                computeCardTier({ probability: 0.9, totalTested: 5, correctCount: 5, errorCount: 0 })
            ).toBe('grandmaster');
        });

        it('概率达标但胜场不足时降为精通', () => {
            expect(
                computeCardTier({ probability: 1, totalTested: 1, correctCount: 1, errorCount: 0 })
            ).toBe('expert');
        });

        it('概率 0.6~0.8 为精通', () => {
            expect(
                computeCardTier({ probability: 0.67, totalTested: 6, correctCount: 4, errorCount: 0 })
            ).toBe('expert');
        });

        it('概率 0.3~0.6 为熟练', () => {
            expect(
                computeCardTier({ probability: 0.5, totalTested: 4, correctCount: 2, errorCount: 0 })
            ).toBe('skilled');
        });

        it('概率低于 0.3 为破绽', () => {
            expect(
                computeCardTier({ probability: 0.2, totalTested: 5, correctCount: 1, errorCount: 0 })
            ).toBe('flawed');
        });

        it('重复出错会把高品级卡降级', () => {
            expect(
                computeCardTier({ probability: 0.9, totalTested: 10, correctCount: 9, errorCount: 3 })
            ).toBe('expert');
            expect(
                computeCardTier({ probability: 0.67, totalTested: 10, correctCount: 7, errorCount: 3 })
            ).toBe('skilled');
        });

        it('错题归档数也会计入有效错误次数', () => {
            expect(
                computeCardTier({ probability: 0.9, totalTested: 5, correctCount: 5, errorCount: 4 })
            ).toBe('expert');
        });
    });

    describe('effectiveErrorCount', () => {
        it('取错答次数与错题归档数的较大值', () => {
            expect(
                effectiveErrorCount({ probability: 0.5, totalTested: 6, correctCount: 3, errorCount: 1 })
            ).toBe(3);
            expect(
                effectiveErrorCount({ probability: 0.5, totalTested: 3, correctCount: 3, errorCount: 5 })
            ).toBe(5);
        });
    });

    describe('compileDeck', () => {
        const row = (overrides: Partial<DeckSourceRow> = {}): DeckSourceRow => ({
            subject: 'physics',
            tagName: '摩擦力',
            probability: 0.75,
            totalTested: 8,
            correctCount: 6,
            errorCount: 0,
            path: ['高一上', '相互作用——力', '摩擦力'],
            lastPracticedAt: new Date('2026-10-01T00:00:00.000Z'),
            recentErrorIds: ['err-1'],
            ...overrides,
        });

        it('跳过未测过的知识点', () => {
            const cards = compileDeck([row({ totalTested: 0, correctCount: 0 })]);
            expect(cards).toHaveLength(0);
        });

        it('生成卡牌并填充展示字段', () => {
            const [card] = compileDeck([row()]);
            expect(card.id).toBe('physics:摩擦力');
            expect(card.name).toBe('摩擦力');
            expect(card.subjectLabel).toBe('物理');
            expect(card.tier).toBe('expert');
            expect(card.tierLabel).toBe('精通');
            expect(card.errorCount).toBe(2);
            expect(card.recentErrorIds).toEqual(['err-1']);
            expect(card.lastPracticedAt).toBe('2026-10-01T00:00:00.000Z');
        });

        it('按品级从强到弱排序', () => {
            const cards = compileDeck([
                row({ tagName: '弱卡', probability: 0.1, totalTested: 5, correctCount: 0 }),
                row({ tagName: '强卡', probability: 0.9, totalTested: 5, correctCount: 5 }),
                row({ tagName: '中卡', probability: 0.5, totalTested: 5, correctCount: 3 }),
            ]);
            expect(cards.map((c) => c.name)).toEqual(['强卡', '中卡', '弱卡']);
        });
    });

    describe('summarizeDeck', () => {
        it('统计各品级与学科数量并计算平均掌握度', () => {
            const cards = compileDeck([
                {
                    subject: 'physics',
                    tagName: '摩擦力',
                    probability: 1,
                    totalTested: 3,
                    correctCount: 3,
                    errorCount: 0,
                    path: ['摩擦力'],
                    lastPracticedAt: null,
                    recentErrorIds: [],
                },
                {
                    subject: 'math',
                    tagName: '条件概率',
                    probability: 0,
                    totalTested: 4,
                    correctCount: 0,
                    errorCount: 2,
                    path: ['条件概率'],
                    lastPracticedAt: null,
                    recentErrorIds: [],
                },
            ]);
            const summary = summarizeDeck(cards);
            expect(summary.total).toBe(2);
            expect(summary.byTier.grandmaster).toBe(1);
            expect(summary.byTier.flawed).toBe(1);
            expect(summary.bySubject.physics).toBe(1);
            expect(summary.bySubject.math).toBe(1);
            expect(summary.masteryRate).toBeCloseTo(0.5);
        });

        it('空卡组不会除零', () => {
            const summary = summarizeDeck([]);
            expect(summary.total).toBe(0);
            expect(summary.masteryRate).toBe(0);
        });
    });

    describe('formatCardPath', () => {
        it('去掉最后一级卡名', () => {
            expect(formatCardPath(['高一上', '相互作用——力', '摩擦力'])).toBe('高一上 › 相互作用——力');
        });

        it('只有一级时返回空串', () => {
            expect(formatCardPath(['摩擦力'])).toBe('');
        });
    });

    describe('TIER_META', () => {
        it('四个品级都有中文名与配色', () => {
            expect(TIER_ORDER).toEqual(['grandmaster', 'expert', 'skilled', 'flawed']);
            for (const tier of TIER_ORDER) {
                expect(TIER_META[tier].label.length).toBeGreaterThan(0);
                expect(TIER_META[tier].color).toMatch(/^#[0-9a-fA-F]{6}$/);
            }
        });

        it('品级顺序由强到弱', () => {
            const orders = TIER_ORDER.map((tier) => TIER_META[tier].order);
            expect([...orders].sort((a, b) => a - b)).toEqual(orders);
        });
    });
});
