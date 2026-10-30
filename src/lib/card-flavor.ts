import type { CardArchetype, CardEffect, CardTier } from "@/types/api";
import { TIER_EFFECT_CONFIG } from "@/lib/card-effects";

/**
 * 主题效果字典
 *
 * 每个知识点一条专属效果：效果名 + 机制基于 8 原型 + 主题扩展原语，
 * 让「集合」抽牌、「单调性」随出牌递增、「楞次定律」抵消增益——名副其实。
 * 纯数据文件，改数值不用动引擎。
 *
 * buildCardEffect 查表优先级：本字典（精确匹配卡名）→ 关键词原型 → 兜底猛攻。
 */

export interface ThemedCardDef {
    /** 机制底座（抗性/弱点技匹配用） */
    a: CardArchetype;
    /** 效果名（卡面展示，替代原型标签） */
    n: string;
    /** 卡面文案，{v} 会被替换为品级缩放后的最终数值 */
    d: string;
    /** 熟练品级基础数值 */
    v: number;
    /** 熟练品级费用 */
    cost: number;
    /** 机制扩展（可组合） */
    extra?: Partial<CardEffect>;
}

const T: Array<[string, ThemedCardDef]> = [
    // ===== 物理 · 力学 =====
    ["质点", { a: "strike", n: "质点", d: "造成 {v} 点伤害", v: 4, cost: 0 }],
    ["参考系", { a: "guard", n: "参考系", d: "获得 {v} 点护盾，场上每个敌人额外 +1", v: 3, cost: 0, extra: { perEnemyAlive: 1 } }],
    ["速度", { a: "strike", n: "速率", d: "造成 {v} 点伤害，本回合每已出 1 张牌 +1", v: 5, cost: 1, extra: { bonusPerCardPlayed: 1 } }],
    ["加速度", { a: "strike", n: "瞬时变化率", d: "造成 {v} 点伤害，本回合每已出 1 张牌 +2", v: 4, cost: 1, extra: { bonusPerCardPlayed: 2 } }],
    ["位移", { a: "strike", n: "直线", d: "造成 {v} 点伤害，无视护甲", v: 6, cost: 1, extra: { pierceArmor: true } }],
    ["匀变速直线运动规律", { a: "multi", n: "加速序列", d: "连续 3 次，每次造成 {v} 点伤害", v: 6, cost: 1, extra: { hits: 3 } }],
    ["自由落体运动", { a: "strike", n: "自由落体", d: "造成 {v} 点伤害", v: 7, cost: 1 }],
    ["x-t图", { a: "buff", n: "斜率", d: "下一张卡伤害 +{v}", v: 3, cost: 0 }],
    ["v-t图", { a: "guard", n: "面积", d: "获得 {v} 点护盾，每 3 张手牌 +1", v: 4, cost: 1, extra: { handSizePer: 3 } }],
    ["重力", { a: "strike", n: "坠落", d: "造成 {v} 点伤害；生效期间每个敌人回合开始它额外受 1 伤", v: 6, cost: 1, extra: { turnStartEnemyDamage: 1 } }],
    ["弹力", { a: "strike", n: "回弹", d: "造成 {v} 点伤害；你的护盾挡掉的伤害 30% 反弹给攻击者", v: 5, cost: 1, extra: { reflectBlockPct: 30 } }],
    ["胡克定律", { a: "strike", n: "形变", d: "造成 {v} 点伤害，每 3 张手牌 +1（拉得越长力越大）", v: 4, cost: 1, extra: { handSizePer: 3 } }],
    ["摩擦力", { a: "debuff", n: "摩擦", d: "敌人攻击 -3，持续 2 回合", v: 3, cost: 0, extra: { enemyAttackDown: 3, enemyAttackDownTurns: 2 } }],
    ["力的合成与分解", { a: "buff", n: "合力", d: "下一张卡伤害 +{v}", v: 4, cost: 1 }],
    ["共点力的平衡", { a: "guard", n: "平衡", d: "获得 {v} 点护盾", v: 6, cost: 1 }],
    ["牛顿第二定律", { a: "strike", n: "F=ma", d: "造成 {v} 点伤害", v: 7, cost: 2 }],
    ["牛顿第三定律", { a: "strike", n: "反作用", d: "造成 {v} 点伤害；你受伤害时攻击者同步损失 20%", v: 5, cost: 1, extra: { onIncomingPct: 20 } }],
    ["平抛运动", { a: "strike", n: "抛物线", d: "造成 {v} 点伤害，无视护甲", v: 6, cost: 1, extra: { pierceArmor: true } }],
    ["向心力", { a: "dot", n: "圆周", d: "敌人每回合受 {v} 点伤害，持续 3 回合", v: 2, cost: 1, extra: { duration: 3 } }],
    ["功", { a: "strike", n: "做功", d: "造成 {v} 点伤害，场上每个敌人额外 +1", v: 5, cost: 1, extra: { perEnemyAlive: 1 } }],
    ["功率", { a: "multi", n: "持续输出", d: "连续 3 次，每次造成 {v} 点伤害", v: 2, cost: 1, extra: { hits: 3 } }],
    ["动能定理", { a: "strike", n: "定理", d: "造成 {v} 点伤害", v: 8, cost: 2 }],
    ["机械能守恒定律", { a: "strike", n: "守恒", d: "造成 {v} 点伤害；你受伤害时攻击者同步损失 30%", v: 6, cost: 1, extra: { onIncomingPct: 30 } }],
    // ===== 物理 · 电学/电磁 =====
    ["欧姆定律", { a: "strike", n: "I=U/R", d: "造成 {v} 点伤害，每 2 张手牌 +1", v: 3, cost: 1, extra: { handSizePer: 2 } }],
    ["焦耳定律", { a: "dot", n: "热效应", d: "敌人每回合受 {v} 点灼烧伤害，持续 3 回合", v: 3, cost: 1, extra: { duration: 3 } }],
    ["动量守恒定律", { a: "strike", n: "守恒", d: "造成 {v} 点伤害；你受伤害时攻击者同步损失 30%", v: 6, cost: 1, extra: { onIncomingPct: 30 } }],
    ["楞次定律", { a: "debuff", n: "阻碍", d: "敌人攻击 -2，且它本回合的增益意图失效", v: 2, cost: 1, extra: { enemyAttackDown: 2, enemyAttackDownTurns: 1, nullifyEnemyGain: true } }],
    ["法拉第电磁感应定律", { a: "draw", n: "感应", d: "抽 2 张牌，能量 +2", v: 2, cost: 1, extra: { drawCount: 2, energyGain: 2 } }],
    // ===== 物理 · 光学/热学/近代 =====
    ["光的折射", { a: "strike", n: "偏折", d: "造成 {v} 点伤害，无视护甲；30% 概率 ×2", v: 5, cost: 1, extra: { pierceArmor: true, probBoost: { p: 0.3, multiplier: 2 } } }],
    ["热力学第一定律", { a: "guard", n: "能量转换", d: "获得 {v} 点护盾，并回复 3 点自信值", v: 4, cost: 1, extra: { heal: 3 } }],
    ["动量", { a: "strike", n: "冲量", d: "造成 {v} 点伤害", v: 8, cost: 2 }],
    ["冲量", { a: "debuff", n: "冲量", d: "敌人攻击 -4，持续 2 回合", v: 4, cost: 1, extra: { enemyAttackDown: 4, enemyAttackDownTurns: 2 } }],
    ["动能", { a: "strike", n: "动能", d: "造成 {v} 点伤害", v: 7, cost: 2 }],
    ["势能", { a: "guard", n: "势能", d: "获得 {v} 点护盾", v: 6, cost: 2 }],
    ["弹性碰撞", { a: "strike", n: "弹射", d: "造成 {v} 点伤害；你的护盾挡掉的伤害 50% 反弹给攻击者", v: 5, cost: 1, extra: { reflectBlockPct: 50 } }],
    ["圆周运动", { a: "dot", n: "轨道", d: "敌人每回合受 {v} 点伤害，持续 3 回合", v: 2, cost: 1, extra: { duration: 3 } }],
    ["万有引力", { a: "strike", n: "引力", d: "造成 {v} 点伤害；生效期间每个敌人回合开始它额外受 1 伤", v: 6, cost: 1, extra: { turnStartEnemyDamage: 1 } }],
    ["电荷", { a: "draw", n: "带电", d: "抽 2 张牌", v: 2, cost: 0, extra: { drawCount: 2 } }],
    ["电场", { a: "strike", n: "电场", d: "造成 {v} 点伤害，场上每个敌人额外 +2", v: 5, cost: 1, extra: { perEnemyAlive: 2 } }],
    ["电势差", { a: "buff", n: "电势差", d: "下一张卡伤害 +{v}", v: 4, cost: 1 }],
    ["电流", { a: "strike", n: "电流", d: "造成 {v} 点伤害（0 费）", v: 4, cost: 0 }],
    ["电阻", { a: "guard", n: "电阻", d: "获得 {v} 点护盾；你受伤害时攻击者同步损失 20%", v: 5, cost: 1, extra: { onIncomingPct: 20 } }],
    ["电容", { a: "strike", n: "放电", d: "造成 {v} 点伤害；本卡每次打出后伤害永久 +2", v: 8, cost: 2, extra: { stackPerPlay: 2 } }],
    ["磁场", { a: "debuff", n: "磁力", d: "敌人攻击 -3，持续 2 回合", v: 3, cost: 1, extra: { enemyAttackDown: 3, enemyAttackDownTurns: 2 } }],
    ["洛伦兹力", { a: "strike", n: "洛伦兹", d: "造成 {v} 点伤害，场上每个敌人额外 +1", v: 6, cost: 1, extra: { perEnemyAlive: 1 } }],
    ["交变电流", { a: "multi", n: "交替", d: "连续 3 次，每次造成 {v} 点伤害", v: 2, cost: 1, extra: { hits: 3 } }],
    ["全反射", { a: "guard", n: "镜面", d: "获得 {v} 点护盾；你的护盾挡掉的伤害 50% 反弹给攻击者", v: 4, cost: 1, extra: { reflectBlockPct: 50 } }],
    ["光的干涉与衍射", { a: "strike", n: "干涉", d: "对全部敌人造成 {v} 点伤害，本回合每已出 1 张牌 +2", v: 3, cost: 1, extra: { allEnemies: true, bonusPerCardPlayed: 2 } }],
    ["光电效应", { a: "strike", n: "光子", d: "造成 {v} 点伤害（0 费）", v: 5, cost: 0 }],
    ["放射性衰变", { a: "dot", n: "衰变", d: "敌人每回合受 {v} 点伤害，持续 2 回合", v: 4, cost: 1, extra: { duration: 2 } }],
    ["比热容", { a: "guard", n: "热容量", d: "获得 {v} 点护盾，并回复 2 点自信值", v: 4, cost: 1, extra: { heal: 2 } }],
    ["机械波", { a: "multi", n: "波", d: "全部敌人受 2 次打击，每次 {v} 点伤害", v: 2, cost: 1, extra: { hits: 2, allEnemies: true } }],
    ["简谐运动", { a: "multi", n: "振动", d: "连续 2 次，每次造成 {v} 点伤害", v: 3, cost: 1, extra: { hits: 2 } }],
    ["共振", { a: "strike", n: "共振", d: "造成 {v} 点伤害；50% 概率发生共振 ×2", v: 4, cost: 1, extra: { probBoost: { p: 0.5, multiplier: 2 } } }],
    ["传感器", { a: "draw", n: "传感", d: "抽 1 张牌，能量 +1", v: 1, cost: 0, extra: { drawCount: 1, energyGain: 1 } }],
    // ===== 数学 · 集合与逻辑 =====
    ["集合", { a: "draw", n: "并集", d: "抽 2 张牌，能量 +1", v: 2, cost: 0, extra: { drawCount: 2, energyGain: 1 } }],
    ["交集", { a: "strike", n: "交集", d: "造成 {v} 点伤害，加上上一张卡伤害的 50%", v: 4, cost: 1, extra: { lastDamageRatio: 0.5 } }],
    ["充分条件", { a: "buff", n: "充分", d: "下一张卡伤害 +{v}，每 4 张手牌额外 +1", v: 4, cost: 1, extra: { nextCardDamageBonus: 4, handSizePer: 4 } }],
    // ===== 数学 · 不等式 =====
    ["不等式性质", { a: "debuff", n: "调参", d: "敌人攻击 -3（2 回合），且抵消它本回合的增益", v: 3, cost: 1, extra: { enemyAttackDown: 3, enemyAttackDownTurns: 2, nullifyEnemyGain: true } }],
    ["一元二次不等式", { a: "crit", n: "判别式", d: "造成 {v} 点伤害，暴击时 ×3", v: 5, cost: 1, extra: { critMultiplier: 3 } }],
    ["单调性", { a: "strike", n: "递增", d: "造成 {v} 点伤害，本回合每已出 1 张牌 +2", v: 3, cost: 1, extra: { bonusPerCardPlayed: 2 } }],
    ["奇偶性", { a: "strike", n: "奇偶", d: "造成 {v} 点伤害；50% 概率翻倍，50% 概率减半", v: 4, cost: 1, extra: { probBoost: { p: 0.5, multiplier: 2, downMultiplier: 0.5 } } }],
    // ===== 数学 · 函数 =====
    ["指数运算", { a: "buff", n: "指数", d: "下一张卡伤害 +2；本卡每次打出后伤害永久 +2", v: 2, cost: 1, extra: { nextCardDamageBonus: 2, stackPerPlay: 2 } }],
    ["对数函数", { a: "draw", n: "对数", d: "抽 2 张牌", v: 2, cost: 0, extra: { drawCount: 2 } }],
    ["三角函数", { a: "multi", n: "波", d: "连续 2 次，每次造成 {v} 点伤害", v: 3, cost: 1, extra: { hits: 2 } }],
    ["正弦函数", { a: "multi", n: "正弦波", d: "连续 3 次，每次造成 {v} 点伤害", v: 2, cost: 1, extra: { hits: 3 } }],
    ["导数与单调性", { a: "strike", n: "导数", d: "造成 {v} 点伤害，加上上一张卡的全部伤害（变化率）", v: 3, cost: 1, extra: { lastDamageRatio: 1 } }],
    ["极值", { a: "crit", n: "极值", d: "造成 {v} 点伤害，暴击时 ×3，并获 3 点护盾", v: 5, cost: 2, extra: { critMultiplier: 3, block: 3 } }],
    ["最优化问题", { a: "buff", n: "最优解", d: "下一张卡伤害 +{v}", v: 3, cost: 0 }],
    ["二次函数的性质", { a: "crit", n: "顶点", d: "造成 {v} 点伤害，暴击时 ×2.5", v: 5, cost: 1, extra: { critMultiplier: 2.5 } }],
    ["函数的零点", { a: "crit", n: "零点", d: "造成 {v} 点伤害，暴击时 ×2.5，无视护甲", v: 6, cost: 2, extra: { critMultiplier: 2.5, pierceArmor: true } }],
    ["导数的切线", { a: "crit", n: "切线", d: "造成 {v} 点伤害，暴击时 ×2.5", v: 5, cost: 1, extra: { critMultiplier: 2.5 } }],
    // ===== 数学 · 向量/几何 =====
    ["数量积", { a: "strike", n: "投影", d: "造成 {v} 点伤害，场上每个敌人额外 +2", v: 5, cost: 1, extra: { perEnemyAlive: 2 } }],
    ["向量运算", { a: "strike", n: "向量", d: "造成 {v} 点伤害，场上每个敌人额外 +2", v: 5, cost: 1, extra: { perEnemyAlive: 2 } }],
    ["表面积", { a: "guard", n: "包覆", d: "获得 {v} 点护盾，每 4 张手牌 +1", v: 5, cost: 1, extra: { handSizePer: 4 } }],
    ["体积", { a: "guard", n: "实体", d: "获得 {v} 点护盾", v: 6, cost: 2 }],
    ["弧长与扇形面积", { a: "multi", n: "扇形", d: "连续 3 次，每次造成 {v} 点伤害", v: 2, cost: 1, extra: { hits: 3 } }],
    // ===== 数学 · 概率统计 =====
    ["条件概率", { a: "buff", n: "条件", d: "下一张卡伤害 +3（仅当上一张卡打出过伤害）", v: 3, cost: 1, extra: { nextCardDamageBonus: 3, ifLastDamage: true } }],
    ["古典概型", { a: "draw", n: "等可能", d: "抽 3 张牌", v: 2, cost: 1, extra: { drawCount: 3 } }],
    ["排列数", { a: "strike", n: "排列", d: "造成 {v} 点伤害，本回合每已出 1 张牌 +1（顺序不同结果不同）", v: 5, cost: 1, extra: { bonusPerCardPlayed: 1 } }],
    ["组合数", { a: "strike", n: "组合", d: "造成 {v} 点伤害，本回合每打出 1 种不同卡型 +2", v: 4, cost: 1, extra: { perArchetypeVariety: 2 } }],
    ["二项式定理", { a: "buff", n: "展开", d: "能量 +1，下一张卡伤害 +2", v: 2, cost: 0, extra: { energyGain: 1, nextCardDamageBonus: 2 } }],
    ["互斥事件", { a: "strike", n: "互斥", d: "造成 {v} 点伤害；40% 概率 ×2", v: 5, cost: 1, extra: { probBoost: { p: 0.4, multiplier: 2 } } }],
    ["数字统计", { a: "draw", n: "统计", d: "抽 2 张牌", v: 2, cost: 0, extra: { drawCount: 2 } }],
    ["计数原理", { a: "draw", n: "计数", d: "抽 2 张牌，能量 +1", v: 2, cost: 0, extra: { drawCount: 2, energyGain: 1 } }],
    // ===== 数学 · 数列/导数 =====
    ["等差数列通项", { a: "strike", n: "通项", d: "造成 {v} 点伤害；本卡每次打出后伤害永久 +1", v: 4, cost: 1, extra: { stackPerPlay: 1 } }],
    ["等比数列通项", { a: "strike", n: "公比", d: "造成 {v} 点伤害；本卡每次打出后伤害永久 +2", v: 4, cost: 1, extra: { stackPerPlay: 2 } }],
    ["等差数列求和", { a: "strike", n: "求和", d: "造成 {v} 点伤害", v: 7, cost: 2 }],
    ["等比数列求和", { a: "multi", n: "等比和", d: "连续 3 次，每次造成 {v} 点伤害", v: 2, cost: 1, extra: { hits: 3 } }],
    ["定积分", { a: "strike", n: "积分", d: "造成 {v} 点伤害", v: 6, cost: 2 }],
    ["复数", { a: "draw", n: "虚实", d: "抽 2 张牌，能量 +1", v: 2, cost: 0, extra: { drawCount: 2, energyGain: 1 } }],
    // ===== 数学 · 三角/几何补充 =====
    ["三角函数恒等变换", { a: "buff", n: "恒等式", d: "下一张卡伤害 +3，本回合每已出 1 张牌额外 +1", v: 3, cost: 1, extra: { nextCardDamageBonus: 3, bonusPerCardPlayed: 1 } }],
    ["三角函数一般公式", { a: "multi", n: "一般式", d: "连续 3 次，每次造成 {v} 点伤害", v: 2, cost: 1, extra: { hits: 3 } }],
    ["解斜三角形", { a: "strike", n: "解三角形", d: "造成 {v} 点伤害", v: 6, cost: 1 }],
    ["正弦定理", { a: "strike", n: "正弦比", d: "造成 {v} 点伤害，场上每个敌人额外 +1", v: 5, cost: 1, extra: { perEnemyAlive: 1 } }],
    ["余弦定理", { a: "strike", n: "余弦", d: "造成 {v} 点伤害", v: 7, cost: 2 }],
    ["圆锥曲线", { a: "strike", n: "圆锥", d: "造成 {v} 点伤害，无视护甲", v: 6, cost: 1, extra: { pierceArmor: true } }],
    ["焦点性质", { a: "crit", n: "焦点", d: "造成 {v} 点伤害，暴击时 ×3", v: 5, cost: 1, extra: { critMultiplier: 3 } }],
    // ===== 数学补充 =====
    ["均值不等式", { a: "buff", n: "均值", d: "下一张卡伤害 +{v}", v: 4, cost: 1 }],
];

export const THEMED_EFFECTS: Record<string, ThemedCardDef> = Object.fromEntries(T);

export function isThemedCard(name: string): boolean {
    return name in THEMED_EFFECTS;
}

/** 主题卡的费用规则：破绽封顶 1、宗师 +1，其余用字典定义值 */
function costForTier(baseCost: number, tier: CardTier): number {
    if (tier === "flawed") return Math.min(baseCost, 1);
    if (tier === "grandmaster") return baseCost + 1;
    return baseCost;
}

/** 构造主题卡的完整效果（品级缩放作用在数值上） */
export function buildThemedEffect(def: ThemedCardDef, tier: CardTier): CardEffect {
    const tierCfg = TIER_EFFECT_CONFIG[tier];
    const value = Math.max(1, Math.round(def.v * tierCfg.multiplier));

    const effect: CardEffect = {
        archetype: def.a,
        archetypeLabel: def.n,
        description: def.d.replace("{v}", String(value)),
        cost: costForTier(def.cost, tier),
        value,
    };

    if (def.extra) {
        for (const [key, v] of Object.entries(def.extra)) {
            if (v !== undefined) (effect as unknown as Record<string, unknown>)[key] = v;
        }
    }

    if (tierCfg.pierceArmor && (def.a === "strike" || def.a === "crit" || def.a === "multi")) {
        effect.pierceArmor = true;
    }
    if (tierCfg.selfDamage > 0) {
        effect.selfDamage = tierCfg.selfDamage;
    }

    return effect;
}
