import type { CardArchetype, CardEffect, CardTier } from "@/types/api";
import { buildThemedEffect, isThemedCard, THEMED_EFFECTS } from "@/lib/card-flavor";

/**
 * 卡牌效果引擎
 *
 * 设计原则：不逐个知识点手写效果，而是「关键词 → 8 个效果原型」+「品级缩放」。
 * 新增一个知识点若没命中关键词，兜底为猛攻；新增关键词只需改一张表。
 */

// ===== 8 个效果原型 =====

export interface ArchetypeMeta {
    archetype: CardArchetype;
    label: string;
    /** 基础数值（品级倍率作用前） */
    baseValue: number;
    /** 描述模板，{v} 会被替换为最终数值 */
    describe: (v: number, extra: Partial<CardEffect>) => string;
    icon: string;
}

export const ARCHETYPES: Record<CardArchetype, ArchetypeMeta> = {
    strike: {
        archetype: "strike",
        label: "猛攻",
        baseValue: 6,
        icon: "swords",
        describe: (v, extra) =>
            extra.pierceArmor ? `造成 ${v} 点伤害，无视护甲` : `造成 ${v} 点伤害`,
    },
    multi: {
        archetype: "multi",
        label: "连击",
        baseValue: 2,
        icon: "zap",
        describe: (v, extra) => `连续 ${extra.hits || 3} 次造成 ${v} 点伤害`,
    },
    dot: {
        archetype: "dot",
        label: "灼烧",
        baseValue: 2,
        icon: "flame",
        describe: (v, extra) => `每回合造成 ${v} 点伤害，持续 ${extra.duration || 3} 回合`,
    },
    guard: {
        archetype: "guard",
        label: "护盾",
        baseValue: 5,
        icon: "shield",
        describe: (v) => `获得 ${v} 点护盾`,
    },
    buff: {
        archetype: "buff",
        label: "增益",
        baseValue: 3,
        icon: "arrow-up",
        describe: (v) => `下一张卡伤害 +${v}`,
    },
    draw: {
        archetype: "draw",
        label: "调度",
        baseValue: 2,
        icon: "cards",
        describe: (v, extra) => `抽 ${extra.drawCount || v} 张牌，能量 +${extra.energyGain || 1}`,
    },
    debuff: {
        archetype: "debuff",
        label: "削弱",
        baseValue: 3,
        icon: "arrow-down",
        describe: (v, extra) => `敌人攻击 -${v}，持续 ${extra.enemyAttackDownTurns || 2} 回合`,
    },
    crit: {
        archetype: "crit",
        label: "精准",
        baseValue: 6,
        icon: "crosshair",
        describe: (v, extra) => `造成 ${v} 点伤害，暴击时 ×${extra.critMultiplier || 2.5}`,
    },
};

export const ARCHETYPE_ORDER: CardArchetype[] = [
    "strike",
    "multi",
    "dot",
    "guard",
    "buff",
    "draw",
    "debuff",
    "crit",
];

// ===== 关键词 → 原型映射 =====

/**
 * 规则表：按数组顺序匹配，先命中先算。
 * 关键词会同时匹配「卡名」与「教材路径」，所以放在章节里的概念也能命中。
 */
export const EFFECT_KEYWORD_RULES: Array<{ archetype: CardArchetype; keywords: string[] }> = [
    {
        archetype: "dot",
        keywords: [
            "电功率", "焦耳", "电阻", "电流", "欧姆", "电路", "电热", "电能",
            "热机", "内能", "比热", "热量", "热传递", "电源", "电动势",
        ],
    },
    {
        archetype: "multi",
        keywords: [
            "波动", "振动", "简谐", "干涉", "衍射", "多普勒", "共振",
            "周期", "波", "声现象", "回声",
        ],
    },
    {
        archetype: "crit",
        keywords: [
            "导数", "切线", "斜率", "极值", "最值", "轨迹", "相切",
            "判别", "判定", "向心", "圆周运动",
        ],
    },
    {
        archetype: "guard",
        keywords: [
            "浮力", "平衡", "静止", "守恒", "压强", "大气压", "稳定", "支持力",
        ],
    },
    {
        archetype: "buff",
        keywords: [
            "杠杆", "滑轮", "机械效率", "放大", "并联", "函数", "方程",
            "不等式", "单调", "奇偶", "指数", "对数", "幂", "递推",
        ],
    },
    {
        archetype: "draw",
        keywords: [
            "概率", "分布", "期望", "方差", "排列", "组合", "二项式",
            "数列", "统计", "抽样", "回归", "计数", "古典概型", "频率",
        ],
    },
    {
        archetype: "debuff",
        keywords: ["摩擦", "阻力", "阻尼", "衰减", "粘滞", "耗散"],
    },
    {
        archetype: "strike",
        keywords: [
            "动量", "冲量", "动能", "势能", "功", "速度", "加速度",
            "牛顿", "碰撞", "反冲", "平抛", "自由落体", "万有引力",
            "引力", "重力", "弹力", "胡克", "机械能", "能量", "力",
            "运动", "位移", "速率", "连接",
        ],
    },
];

// ===== 品级缩放 =====

export interface TierConfig {
    cost: number;
    multiplier: number;
    pierceArmor: boolean;
    selfDamage: number;
}

export const TIER_EFFECT_CONFIG: Record<CardTier, TierConfig> = {
    grandmaster: { cost: 2, multiplier: 2.0, pierceArmor: true, selfDamage: 0 },
    expert: { cost: 1, multiplier: 1.4, pierceArmor: false, selfDamage: 0 },
    skilled: { cost: 1, multiplier: 1.0, pierceArmor: false, selfDamage: 0 },
    flawed: { cost: 0, multiplier: 0.6, pierceArmor: false, selfDamage: 3 },
};

/** 暴击基础概率 */
export const BASE_CRIT_CHANCE = 0.25;
/** 命中敌人弱点时的伤害倍率 */
export const WEAKNESS_MULTIPLIER = 1.5;

// ===== 核心函数 =====

export interface ResolveEffectInput {
    /** 卡名（知识点） */
    name: string;
    /** 教材路径，用于命中章节级关键词 */
    path?: string[];
    tier: CardTier;
}

/** 根据关键词匹配出效果原型；未命中兜底为猛攻 */
export function resolveArchetype(name: string, path: string[] = []): CardArchetype {
    const haystack = `${name} ${path.join(" ")}`;
    for (const rule of EFFECT_KEYWORD_RULES) {
        for (const keyword of rule.keywords) {
            if (haystack.includes(keyword)) {
                return rule.archetype;
            }
        }
    }
    return "strike";
}

/** 构造一张卡的完整效果 */
export function buildCardEffect(input: ResolveEffectInput): CardEffect {
    // 主题效果字典优先：精确匹配卡名 → 该知识点的专属效果
    if (isThemedCard(input.name)) {
        return buildThemedEffect(THEMED_EFFECTS[input.name], input.tier);
    }

    const archetype = resolveArchetype(input.name, input.path);
    const meta = ARCHETYPES[archetype];
    const config = TIER_EFFECT_CONFIG[input.tier];

    const value = Math.max(1, Math.round(meta.baseValue * config.multiplier));

    const effect: CardEffect = {
        archetype,
        archetypeLabel: meta.label,
        description: "",
        cost: config.cost,
        value,
    };

    switch (archetype) {
        case "multi":
            effect.hits = 3;
            effect.duration = 3;
            break;
        case "dot":
            effect.duration = 3;
            break;
        case "draw":
            effect.drawCount = value;
            effect.energyGain = 1;
            break;
        case "debuff":
            effect.enemyAttackDown = value;
            effect.enemyAttackDownTurns = 2;
            break;
        case "crit":
            effect.critMultiplier = 2.5;
            break;
        case "buff":
            effect.nextCardDamageBonus = value;
            break;
        case "guard":
            effect.block = value;
            break;
    }

    if (config.pierceArmor && (archetype === "strike" || archetype === "crit" || archetype === "multi")) {
        effect.pierceArmor = true;
    }
    if (config.selfDamage > 0) {
        effect.selfDamage = config.selfDamage;
    }

    effect.description = meta.describe(value, effect);
    return effect;
}

/** 卡牌是否属于某敌人的弱点（命中章节关键词） */
export function isWeaknessHit(cardPath: string[], cardName: string, chapterKeywords: string[]): boolean {
    if (!chapterKeywords || chapterKeywords.length === 0) return false;
    const haystack = `${cardName} ${cardPath.join(" ")}`;
    return chapterKeywords.some((kw) => haystack.includes(kw));
}

/** 效果的一句话摘要（用于列表/提示） */
export function effectSummary(effect: CardEffect): string {
    return `${effect.archetypeLabel} · ${effect.description}`;
}
