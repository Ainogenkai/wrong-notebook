import type { CardTier, DeckCard, DeckSummary } from "@/types/api";
import { buildCardEffect } from "@/lib/card-effects";

// 卡组覆盖的学科（首批：物理 + 数学）
export const CARD_SUBJECTS = ["physics", "math"] as const;

export const SUBJECT_LABELS: Record<string, string> = {
    math: "数学",
    physics: "物理",
    chemistry: "化学",
    biology: "生物",
    english: "英语",
};

export interface TierMeta {
    label: string;
    /** 排序权重，越小越强 */
    order: number;
    /** 主色（HEX），用于卡面描边与辉光 */
    color: string;
    /** 卡面 flavor 文案模板 */
    flavor: (errors: number) => string;
    /** 稀有度文案 */
    rarity: string;
}

export const TIER_META: Record<CardTier, TierMeta> = {
    grandmaster: {
        label: "宗师",
        order: 0,
        color: "#f5c451",
        rarity: "传说",
        flavor: () => "这个概念现在是我的了",
    },
    expert: {
        label: "精通",
        order: 1,
        color: "#a78bfa",
        rarity: "史诗",
        flavor: () => "闭着眼睛也能推出来",
    },
    skilled: {
        label: "熟练",
        order: 2,
        color: "#38bdf8",
        rarity: "精良",
        flavor: (errors) => (errors > 0 ? `会做，但栽过 ${errors} 次` : "知道怎么做，偶尔要想一下"),
    },
    flawed: {
        label: "破绽",
        order: 3,
        color: "#f87171",
        rarity: "破损",
        flavor: (errors) => (errors > 0 ? `这题我栽过 ${errors} 次` : "还没真正搞懂"),
    },
};

export const TIER_ORDER: CardTier[] = ["grandmaster", "expert", "skilled", "flawed"];

export interface TierInput {
    probability: number;
    totalTested: number;
    correctCount: number;
    /** 该知识点归档在错题本中的错题数量 */
    errorCount: number;
}

/**
 * 由 BKT 掌握度 + 错误次数推导卡牌品级。
 * 未测过的知识点不生成卡牌（返回 null）。
 */
export function computeCardTier(input: TierInput): CardTier | null {
    const { probability, totalTested, correctCount } = input;
    if (totalTested <= 0) return null;

    const errors = effectiveErrorCount(input);

    if (probability >= 0.8 && correctCount >= 2) {
        return errors >= 3 ? "expert" : "grandmaster";
    }
    if (probability >= 0.6) {
        return errors >= 3 ? "skilled" : "expert";
    }
    if (probability >= 0.3) {
        return "skilled";
    }
    return "flawed";
}

/** 有效错误次数：错答次数与错题归档数取大 */
export function effectiveErrorCount(input: TierInput): number {
    return Math.max(input.totalTested - input.correctCount, input.errorCount);
}

export interface DeckSourceRow {
    subject: string;
    tagName: string;
    probability: number;
    totalTested: number;
    correctCount: number;
    errorCount: number;
    path: string[];
    lastPracticedAt: Date | null;
    recentErrorIds: string[];
}

/** 将数据库行编译为卡牌数组，并按品级 + 战斗次数排序 */
export function compileDeck(rows: DeckSourceRow[]): DeckCard[] {
    const cards: DeckCard[] = [];

    for (const row of rows) {
        const tier = computeCardTier(row);
        if (!tier) continue;

        const errors = effectiveErrorCount(row);
        const meta = TIER_META[tier];

        cards.push({
            id: `${row.subject}:${row.tagName}`,
            name: row.tagName,
            subject: row.subject,
            subjectLabel: SUBJECT_LABELS[row.subject] || row.subject,
            path: row.path,
            tier,
            tierLabel: meta.label,
            probability: row.probability,
            totalTested: row.totalTested,
            correctCount: row.correctCount,
            errorCount: errors,
            flavor: meta.flavor(errors),
            lastPracticedAt: row.lastPracticedAt ? row.lastPracticedAt.toISOString() : null,
            recentErrorIds: row.recentErrorIds,
            effect: buildCardEffect({ name: row.tagName, path: row.path, tier }),
        });
    }

    return cards.sort((a, b) => {
        const tierDiff = TIER_META[a.tier].order - TIER_META[b.tier].order;
        if (tierDiff !== 0) return tierDiff;
        return b.totalTested - a.totalTested;
    });
}

/** 卡组总览统计 */
export function summarizeDeck(cards: DeckCard[]): DeckSummary {
    const byTier: Record<CardTier, number> = { grandmaster: 0, expert: 0, skilled: 0, flawed: 0 };
    const bySubject: Record<string, number> = {};
    let probabilitySum = 0;

    for (const card of cards) {
        byTier[card.tier] += 1;
        bySubject[card.subject] = (bySubject[card.subject] || 0) + 1;
        probabilitySum += card.probability;
    }

    return {
        total: cards.length,
        byTier,
        bySubject,
        masteryRate: cards.length > 0 ? probabilitySum / cards.length : 0,
    };
}

/** 把标签父链整理为展示路径（不含卡名本身） */
export function formatCardPath(path: string[]): string {
    const chain = path.filter(Boolean);
    if (chain.length <= 1) return "";
    return chain.slice(0, -1).join(" › ");
}
