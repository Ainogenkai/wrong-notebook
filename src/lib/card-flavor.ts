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
    /**
     * 真·成就升级效果（战斗专属第 5 档，逐卡手搓）：
     * - 只有宗师卡在战斗内才能升到该档，升级后使用这份效果
     * - v/cost 为该档天然值，费用最终由 buildPlusEffect 钳制为「只降不升」
     * - extra 可与基础机制叠加（引擎原语自由组合）
     */
    up?: {
        d: string;
        v: number;
        cost?: number;
        extra?: Partial<CardEffect>;
    };
}

const T: Array<[string, ThemedCardDef]> = [
    // ===== 物理 · 力学 =====
    ["质点", { a: "strike", n: "质点", d: "造成 {v} 点伤害", v: 4, cost: 0, up: { d: "造成 {v} 点伤害，无视护甲", v: 8, extra: { pierceArmor: true } } }],
    ["参考系", { a: "guard", n: "参考系", d: "获得 {v} 点护盾，场上每个敌人额外 +1", v: 3, cost: 0, extra: { perEnemyAlive: 1 }, up: { d: "获得 {v} 点护盾，场上每个敌人额外 +2", v: 6, extra: { perEnemyAlive: 2 } } }],
    ["速度", { a: "strike", n: "速率", d: "造成 {v} 点伤害，本回合每已出 1 张牌 +1", v: 5, cost: 1, extra: { bonusPerCardPlayed: 1 }, up: { d: "造成 {v} 点伤害，本回合每已出 1 张牌 +2", v: 8, extra: { bonusPerCardPlayed: 2 } } }],
    ["加速度", { a: "strike", n: "瞬时变化率", d: "造成 {v} 点伤害，本回合每已出 1 张牌 +2", v: 4, cost: 1, extra: { bonusPerCardPlayed: 2 }, up: { d: "造成 {v} 点伤害，本回合每已出 1 张牌 +3，且 +1 点护盾", v: 7, extra: { bonusPerCardPlayed: 3, block: 1 } } }],
    ["位移", { a: "strike", n: "直线", d: "造成 {v} 点伤害，无视护甲", v: 6, cost: 1, extra: { pierceArmor: true }, up: { d: "造成 {v} 点伤害，无视护甲，本回合每已出 1 张牌 +1", v: 9, extra: { pierceArmor: true, bonusPerCardPlayed: 1 } } }],
    ["匀变速直线运动规律", { a: "multi", n: "加速序列", d: "连续 3 次，每次造成 {v} 点伤害", v: 6, cost: 1, extra: { hits: 3 }, up: { d: "连续 3 次，每次造成 {v} 点伤害，无视护甲", v: 7, extra: { hits: 3, pierceArmor: true } } }],
    ["自由落体运动", { a: "strike", n: "自由落体", d: "造成 {v} 点伤害", v: 7, cost: 1, up: { d: "造成 {v} 点伤害，暴击时 ×2.5", v: 8, extra: { critMultiplier: 2.5 } } }],
    ["x-t图", { a: "buff", n: "斜率", d: "下一张卡伤害 +{v}", v: 3, cost: 0, up: { d: "下一张卡伤害 +{v}，每 4 张手牌额外 +1", v: 4, extra: { handSizePer: 4 } } }],
    ["v-t图", { a: "guard", n: "面积", d: "获得 {v} 点护盾，每 3 张手牌 +1", v: 4, cost: 1, extra: { handSizePer: 3 }, up: { d: "获得 {v} 点护盾，每 3 张手牌 +1，并回复 2 点自信值", v: 6, extra: { handSizePer: 3, heal: 2 } } }],
    ["重力", { a: "strike", n: "坠落", d: "造成 {v} 点伤害；生效期间每个敌人回合开始它额外受 1 伤", v: 6, cost: 1, extra: { turnStartEnemyDamage: 1 }, up: { d: "造成 {v} 点伤害；生效期间每个敌人回合开始它额外受 2 伤", v: 9, extra: { turnStartEnemyDamage: 2 } } }],
    ["弹力", { a: "strike", n: "回弹", d: "造成 {v} 点伤害；你的护盾挡掉的伤害 30% 反弹给攻击者", v: 5, cost: 1, extra: { reflectBlockPct: 30 }, up: { d: "造成 {v} 点伤害；你的护盾挡掉的伤害 50% 反弹给攻击者", v: 7, extra: { reflectBlockPct: 50 } } }],
    ["胡克定律", { a: "strike", n: "形变", d: "造成 {v} 点伤害，每 3 张手牌 +1（拉得越长力越大）", v: 4, cost: 1, extra: { handSizePer: 3 }, up: { d: "造成 {v} 点伤害，每 3 张手牌 +1，无视护甲（拉得越长力越大）", v: 6, extra: { handSizePer: 3, pierceArmor: true } } }],
    ["摩擦力", { a: "debuff", n: "摩擦", d: "敌人攻击 -3，持续 2 回合", v: 3, cost: 0, extra: { enemyAttackDown: 3, enemyAttackDownTurns: 2 }, up: { d: "敌人攻击 -4，持续 3 回合，且它本回合增益失效", v: 4, extra: { enemyAttackDown: 4, enemyAttackDownTurns: 3, nullifyEnemyGain: true } } }],
    ["力的合成与分解", { a: "buff", n: "合力", d: "下一张卡伤害 +{v}", v: 4, cost: 1, up: { d: "下一张卡伤害 +{v}，本回合每打出 1 种不同卡型额外 +1", v: 5, extra: { perArchetypeVariety: 1 } } }],
    ["共点力的平衡", { a: "guard", n: "平衡", d: "获得 {v} 点护盾", v: 6, cost: 1, up: { d: "获得 {v} 点护盾，并回复 3 点自信值", v: 8, extra: { heal: 3 } } }],
    ["牛顿第二定律", { a: "strike", n: "F=ma", d: "造成 {v} 点伤害", v: 7, cost: 2, up: { d: "造成 {v} 点伤害，本回合每已出 1 张牌 +1", v: 10, extra: { bonusPerCardPlayed: 1 } } }],
    ["牛顿第三定律", { a: "strike", n: "反作用", d: "造成 {v} 点伤害；你受伤害时攻击者同步损失 20%", v: 5, cost: 1, extra: { onIncomingPct: 20 }, up: { d: "造成 {v} 点伤害；你受伤害时攻击者同步损失 30%", v: 7, extra: { onIncomingPct: 30 } } }],
    ["平抛运动", { a: "strike", n: "抛物线", d: "造成 {v} 点伤害，无视护甲", v: 6, cost: 1, extra: { pierceArmor: true }, up: { d: "对全部敌人造成 {v} 点伤害，无视护甲", v: 5, extra: { pierceArmor: true, allEnemies: true } } }],
    ["向心力", { a: "dot", n: "圆周", d: "敌人每回合受 {v} 点伤害，持续 3 回合", v: 2, cost: 1, extra: { duration: 3 }, up: { d: "敌人每回合受 {v} 点伤害，持续 4 回合", v: 3, extra: { duration: 4 } } }],
    ["功", { a: "strike", n: "做功", d: "造成 {v} 点伤害，场上每个敌人额外 +1", v: 5, cost: 1, extra: { perEnemyAlive: 1 }, up: { d: "造成 {v} 点伤害，场上每个敌人额外 +2", v: 7, extra: { perEnemyAlive: 2 } } }],
    ["功率", { a: "multi", n: "持续输出", d: "连续 3 次，每次造成 {v} 点伤害", v: 2, cost: 1, extra: { hits: 3 }, up: { d: "连续 4 次，每次造成 {v} 点伤害", v: 3, extra: { hits: 4 } } }],
    ["动能定理", { a: "strike", n: "定理", d: "造成 {v} 点伤害", v: 8, cost: 2, up: { d: "造成 {v} 点伤害，暴击时 ×2", v: 10, extra: { critMultiplier: 2 } } }],
    ["机械能守恒定律", { a: "strike", n: "守恒", d: "造成 {v} 点伤害；你受伤害时攻击者同步损失 30%", v: 6, cost: 1, extra: { onIncomingPct: 30 }, up: { d: "造成 {v} 点伤害；你受伤害时攻击者同步损失 40%，并获 3 点护盾", v: 8, extra: { onIncomingPct: 40, block: 3 } } }],
    // ===== 物理 · 电学/电磁 =====
    ["欧姆定律", { a: "strike", n: "I=U/R", d: "造成 {v} 点伤害，每 2 张手牌 +1", v: 3, cost: 1, extra: { handSizePer: 2 }, up: { d: "造成 {v} 点伤害，每 2 张手牌 +1，且 +1 点护盾", v: 5, extra: { handSizePer: 2, block: 1 } } }],
    ["焦耳定律", { a: "dot", n: "热效应", d: "敌人每回合受 {v} 点灼烧伤害，持续 3 回合", v: 3, cost: 1, extra: { duration: 3 }, up: { d: "敌人每回合受 {v} 点灼烧伤害，持续 4 回合", v: 4, extra: { duration: 4 } } }],
    ["动量守恒定律", { a: "strike", n: "守恒", d: "造成 {v} 点伤害；你受伤害时攻击者同步损失 30%", v: 6, cost: 1, extra: { onIncomingPct: 30 }, up: { d: "造成 {v} 点伤害；你受伤害时攻击者同步损失 40%", v: 8, extra: { onIncomingPct: 40 } } }],
    ["楞次定律", { a: "debuff", n: "阻碍", d: "敌人攻击 -2，且它本回合的增益意图失效", v: 2, cost: 1, extra: { enemyAttackDown: 2, enemyAttackDownTurns: 1, nullifyEnemyGain: true }, up: { d: "敌人攻击 -3，持续 2 回合，且它本回合的增益/蓄力意图失效", v: 3, extra: { enemyAttackDown: 3, enemyAttackDownTurns: 2, nullifyEnemyGain: true } } }],
    ["法拉第电磁感应定律", { a: "draw", n: "感应", d: "抽 2 张牌，能量 +2", v: 2, cost: 1, extra: { drawCount: 2, energyGain: 2 }, up: { d: "抽 2 张牌，能量 +3", v: 2, extra: { drawCount: 2, energyGain: 3 } } }],
    // ===== 物理 · 光学/热学/近代 =====
    ["光的折射", { a: "strike", n: "偏折", d: "造成 {v} 点伤害，无视护甲；30% 概率 ×2", v: 5, cost: 1, extra: { pierceArmor: true, probBoost: { p: 0.3, multiplier: 2 } }, up: { d: "造成 {v} 点伤害，无视护甲；40% 概率 ×2", v: 7, extra: { pierceArmor: true, probBoost: { p: 0.4, multiplier: 2 } } } }],
    ["热力学第一定律", { a: "guard", n: "能量转换", d: "获得 {v} 点护盾，并回复 3 点自信值", v: 4, cost: 1, extra: { heal: 3 }, up: { d: "获得 {v} 点护盾，并回复 5 点自信值", v: 6, extra: { heal: 5 } } }],
    ["动量", { a: "strike", n: "冲量", d: "造成 {v} 点伤害", v: 8, cost: 2, up: { d: "造成 {v} 点伤害，无视护甲", v: 11, extra: { pierceArmor: true } } }],
    ["冲量", { a: "debuff", n: "冲量", d: "敌人攻击 -4，持续 2 回合", v: 4, cost: 1, extra: { enemyAttackDown: 4, enemyAttackDownTurns: 2 }, up: { d: "敌人攻击 -5，持续 3 回合，且它本回合增益失效", v: 5, extra: { enemyAttackDown: 5, enemyAttackDownTurns: 3, nullifyEnemyGain: true } } }],
    ["动能", { a: "strike", n: "动能", d: "造成 {v} 点伤害", v: 7, cost: 2, up: { d: "造成 {v} 点伤害，本卡每次打出后伤害永久 +1", v: 9, extra: { stackPerPlay: 1 } } }],
    ["势能", { a: "guard", n: "势能", d: "获得 {v} 点护盾", v: 6, cost: 2, up: { d: "获得 {v} 点护盾，并回复 3 点自信值", v: 8, extra: { heal: 3 } } }],
    ["弹性碰撞", { a: "strike", n: "弹射", d: "造成 {v} 点伤害；你的护盾挡掉的伤害 50% 反弹给攻击者", v: 5, cost: 1, extra: { reflectBlockPct: 50 }, up: { d: "造成 {v} 点伤害；你的护盾挡掉的伤害 70% 反弹给攻击者", v: 7, extra: { reflectBlockPct: 70 } } }],
    ["圆周运动", { a: "dot", n: "轨道", d: "敌人每回合受 {v} 点伤害，持续 3 回合", v: 2, cost: 1, extra: { duration: 3 }, up: { d: "敌人每回合受 {v} 点伤害，持续 4 回合，并打乱它的意图", v: 3, extra: { duration: 4, shuffleEnemyIntents: true } } }],
    ["万有引力", { a: "strike", n: "引力", d: "造成 {v} 点伤害；生效期间每个敌人回合开始它额外受 1 伤", v: 6, cost: 1, extra: { turnStartEnemyDamage: 1 }, up: { d: "造成 {v} 点伤害；生效期间每个敌人回合开始它额外受 2 伤", v: 8, extra: { turnStartEnemyDamage: 2 } } }],
    ["电荷", { a: "draw", n: "带电", d: "抽 2 张牌", v: 2, cost: 0, extra: { drawCount: 2 }, up: { d: "抽 2 张牌，能量 +1", v: 2, extra: { drawCount: 2, energyGain: 1 } } }],
    ["电场", { a: "strike", n: "电场", d: "造成 {v} 点伤害，场上每个敌人额外 +2", v: 5, cost: 1, extra: { perEnemyAlive: 2 }, up: { d: "造成 {v} 点伤害，场上每个敌人额外 +3", v: 7, extra: { perEnemyAlive: 3 } } }],
    ["电势差", { a: "buff", n: "电势差", d: "下一张卡伤害 +{v}", v: 4, cost: 1, up: { d: "下一张卡伤害 +{v}，每 4 张手牌额外 +1", v: 5, extra: { handSizePer: 4 } } }],
    ["电流", { a: "strike", n: "电流", d: "造成 {v} 点伤害（0 费）", v: 4, cost: 0, up: { d: "造成 {v} 点伤害（0 费），场上每个敌人额外 +1", v: 6, extra: { perEnemyAlive: 1 } } }],
    ["电阻", { a: "guard", n: "电阻", d: "获得 {v} 点护盾；你受伤害时攻击者同步损失 20%", v: 5, cost: 1, extra: { onIncomingPct: 20 }, up: { d: "获得 {v} 点护盾；你受伤害时攻击者同步损失 30%", v: 7, extra: { onIncomingPct: 30 } } }],
    ["电容", { a: "strike", n: "放电", d: "造成 {v} 点伤害；本卡每次打出后伤害永久 +2", v: 8, cost: 2, extra: { stackPerPlay: 2 }, up: { d: "造成 {v} 点伤害；本卡每次打出后伤害永久 +3", v: 10, extra: { stackPerPlay: 3 } } }],
    ["磁场", { a: "debuff", n: "磁力", d: "敌人攻击 -3，持续 2 回合", v: 3, cost: 1, extra: { enemyAttackDown: 3, enemyAttackDownTurns: 2 }, up: { d: "敌人攻击 -4，持续 3 回合，且它本回合增益失效", v: 4, extra: { enemyAttackDown: 4, enemyAttackDownTurns: 3, nullifyEnemyGain: true } } }],
    ["洛伦兹力", { a: "strike", n: "洛伦兹", d: "造成 {v} 点伤害，场上每个敌人额外 +1", v: 6, cost: 1, extra: { perEnemyAlive: 1 }, up: { d: "造成 {v} 点伤害，场上每个敌人额外 +2，无视护甲", v: 8, extra: { perEnemyAlive: 2, pierceArmor: true } } }],
    ["交变电流", { a: "multi", n: "交替", d: "连续 3 次，每次造成 {v} 点伤害", v: 2, cost: 1, extra: { hits: 3 }, up: { d: "连续 4 次，每次造成 {v} 点伤害", v: 3, extra: { hits: 4 } } }],
    ["全反射", { a: "guard", n: "镜面", d: "获得 {v} 点护盾；你的护盾挡掉的伤害 50% 反弹给攻击者", v: 4, cost: 1, extra: { reflectBlockPct: 50 }, up: { d: "获得 {v} 点护盾；你的护盾挡掉的伤害 70% 反弹给攻击者", v: 6, extra: { reflectBlockPct: 70 } } }],
    ["光的干涉与衍射", { a: "strike", n: "干涉", d: "对全部敌人造成 {v} 点伤害，本回合每已出 1 张牌 +2", v: 3, cost: 1, extra: { allEnemies: true, bonusPerCardPlayed: 2 }, up: { d: "对全部敌人造成 {v} 点伤害，本回合每已出 1 张牌 +3", v: 4, extra: { allEnemies: true, bonusPerCardPlayed: 3 } } }],
    ["光电效应", { a: "strike", n: "光子", d: "造成 {v} 点伤害（0 费）", v: 5, cost: 0, up: { d: "造成 {v} 点伤害（0 费），50% 概率 ×2", v: 6, extra: { probBoost: { p: 0.5, multiplier: 2 } } } }],
    ["放射性衰变", { a: "dot", n: "衰变", d: "敌人每回合受 {v} 点伤害，持续 2 回合", v: 4, cost: 1, extra: { duration: 2 }, up: { d: "敌人每回合受 {v} 点伤害，持续 3 回合", v: 5, extra: { duration: 3 } } }],
    ["比热容", { a: "guard", n: "热容量", d: "获得 {v} 点护盾，并回复 2 点自信值", v: 4, cost: 1, extra: { heal: 2 }, up: { d: "获得 {v} 点护盾，并回复 4 点自信值", v: 6, extra: { heal: 4 } } }],
    ["机械波", { a: "multi", n: "波", d: "全部敌人受 2 次打击，每次 {v} 点伤害", v: 2, cost: 1, extra: { hits: 2, allEnemies: true }, up: { d: "全部敌人受 2 次打击，每次 {v} 点伤害，无视护甲", v: 3, extra: { hits: 2, allEnemies: true, pierceArmor: true } } }],
    ["简谐运动", { a: "multi", n: "振动", d: "连续 2 次，每次造成 {v} 点伤害", v: 3, cost: 1, extra: { hits: 2 }, up: { d: "连续 3 次，每次造成 {v} 点伤害，无视护甲", v: 4, extra: { hits: 3, pierceArmor: true } } }],
    ["共振", { a: "strike", n: "共振", d: "造成 {v} 点伤害；50% 概率发生共振 ×2", v: 4, cost: 1, extra: { probBoost: { p: 0.5, multiplier: 2 } }, up: { d: "造成 {v} 点伤害；60% 概率发生共振 ×2", v: 6, extra: { probBoost: { p: 0.6, multiplier: 2 } } } }],
    ["传感器", { a: "draw", n: "传感", d: "抽 1 张牌，能量 +1", v: 1, cost: 0, extra: { drawCount: 1, energyGain: 1 }, up: { d: "抽 2 张牌，能量 +1", v: 2, extra: { drawCount: 2, energyGain: 1 } } }],
    // ===== 数学 · 集合与逻辑 =====
    ["集合", { a: "draw", n: "并集", d: "抽 2 张牌，能量 +1", v: 2, cost: 0, extra: { drawCount: 2, energyGain: 1 }, up: { d: "抽 3 张牌，能量 +1", v: 3, extra: { drawCount: 3, energyGain: 1 } } }],
    ["交集", { a: "strike", n: "交集", d: "造成 {v} 点伤害，加上上一张卡伤害的 50%", v: 4, cost: 1, extra: { lastDamageRatio: 0.5 }, up: { d: "造成 {v} 点伤害，加上上一张卡的全部伤害", v: 6, extra: { lastDamageRatio: 1 } } }],
    ["充分条件", { a: "buff", n: "充分", d: "下一张卡伤害 +{v}，每 4 张手牌额外 +1", v: 4, cost: 1, extra: { nextCardDamageBonus: 4, handSizePer: 4 }, up: { d: "下一张卡伤害 +{v}，每 4 张手牌额外 +1", v: 6, extra: { nextCardDamageBonus: 6, handSizePer: 4 } } }],
    // ===== 数学 · 不等式 =====
    ["不等式性质", { a: "debuff", n: "调参", d: "敌人攻击 -3（2 回合），且抵消它本回合的增益", v: 3, cost: 1, extra: { enemyAttackDown: 3, enemyAttackDownTurns: 2, nullifyEnemyGain: true }, up: { d: "敌人攻击 -4（3 回合），且抵消它本回合的增益", v: 4, extra: { enemyAttackDown: 4, enemyAttackDownTurns: 3, nullifyEnemyGain: true } } }],
    ["一元二次不等式", { a: "crit", n: "判别式", d: "造成 {v} 点伤害，暴击时 ×3", v: 5, cost: 1, extra: { critMultiplier: 3 }, up: { d: "造成 {v} 点伤害，暴击时 ×3，并获 3 点护盾", v: 6, extra: { critMultiplier: 3, block: 3 } } }],
    ["单调性", { a: "strike", n: "递增", d: "造成 {v} 点伤害，本回合每已出 1 张牌 +2", v: 3, cost: 1, extra: { bonusPerCardPlayed: 2 }, up: { d: "造成 {v} 点伤害，本回合每已出 1 张牌 +3", v: 5, extra: { bonusPerCardPlayed: 3 } } }],
    ["奇偶性", { a: "strike", n: "奇偶", d: "造成 {v} 点伤害；50% 概率翻倍，50% 概率减半", v: 4, cost: 1, extra: { probBoost: { p: 0.5, multiplier: 2, downMultiplier: 0.5 } }, up: { d: "造成 {v} 点伤害；60% 概率翻倍，40% 概率不打折", v: 5, extra: { probBoost: { p: 0.6, multiplier: 2 } } } }],
    // ===== 数学 · 函数 =====
    ["指数运算", { a: "buff", n: "指数", d: "下一张卡伤害 +2；本卡每次打出后伤害永久 +2", v: 2, cost: 1, extra: { nextCardDamageBonus: 2, stackPerPlay: 2 }, up: { d: "下一张卡伤害 +{v}；本卡每次打出后伤害永久 +3", v: 4, extra: { nextCardDamageBonus: 4, stackPerPlay: 3 } } }],
    ["对数函数", { a: "draw", n: "对数", d: "抽 2 张牌", v: 2, cost: 0, extra: { drawCount: 2 }, up: { d: "抽 3 张牌，能量 +1", v: 3, extra: { drawCount: 3, energyGain: 1 } } }],
    ["三角函数", { a: "multi", n: "波", d: "连续 2 次，每次造成 {v} 点伤害", v: 3, cost: 1, extra: { hits: 2 }, up: { d: "连续 3 次，每次造成 {v} 点伤害，无视护甲", v: 4, extra: { hits: 3, pierceArmor: true } } }],
    ["正弦函数", { a: "multi", n: "正弦波", d: "连续 3 次，每次造成 {v} 点伤害", v: 2, cost: 1, extra: { hits: 3 }, up: { d: "连续 4 次，每次造成 {v} 点伤害", v: 3, extra: { hits: 4 } } }],
    ["导数与单调性", { a: "strike", n: "导数", d: "造成 {v} 点伤害，加上上一张卡的全部伤害（变化率）", v: 3, cost: 1, extra: { lastDamageRatio: 1 }, up: { d: "造成 {v} 点伤害，加上上一张卡的全部伤害，无视护甲", v: 5, extra: { lastDamageRatio: 1, pierceArmor: true } } }],
    ["极值", { a: "crit", n: "极值", d: "造成 {v} 点伤害，暴击时 ×3，并获 3 点护盾", v: 5, cost: 2, extra: { critMultiplier: 3, block: 3 }, up: { d: "造成 {v} 点伤害，暴击时 ×3，并获 5 点护盾", v: 7, extra: { critMultiplier: 3, block: 5 } } }],
    ["最优化问题", { a: "buff", n: "最优解", d: "下一张卡伤害 +{v}", v: 3, cost: 0, up: { d: "下一张卡伤害 +{v}，每 4 张手牌额外 +1", v: 5, extra: { handSizePer: 4 } } }],
    ["二次函数的性质", { a: "crit", n: "顶点", d: "造成 {v} 点伤害，暴击时 ×2.5", v: 5, cost: 1, extra: { critMultiplier: 2.5 }, up: { d: "造成 {v} 点伤害，暴击时 ×3", v: 7, extra: { critMultiplier: 3 } } }],
    ["函数的零点", { a: "crit", n: "零点", d: "造成 {v} 点伤害，暴击时 ×2.5，无视护甲", v: 6, cost: 2, extra: { critMultiplier: 2.5, pierceArmor: true }, up: { d: "造成 {v} 点伤害，暴击时 ×3，无视护甲", v: 8, extra: { critMultiplier: 3, pierceArmor: true } } }],
    ["导数的切线", { a: "crit", n: "切线", d: "造成 {v} 点伤害，暴击时 ×2.5", v: 5, cost: 1, extra: { critMultiplier: 2.5 }, up: { d: "造成 {v} 点伤害，暴击时 ×3，并获 2 点护盾", v: 6, extra: { critMultiplier: 3, block: 2 } } }],
    // ===== 数学 · 向量/几何 =====
    ["数量积", { a: "strike", n: "投影", d: "造成 {v} 点伤害，场上每个敌人额外 +2", v: 5, cost: 1, extra: { perEnemyAlive: 2 }, up: { d: "造成 {v} 点伤害，场上每个敌人额外 +3", v: 7, extra: { perEnemyAlive: 3 } } }],
    ["向量运算", { a: "strike", n: "向量", d: "造成 {v} 点伤害，场上每个敌人额外 +2", v: 5, cost: 1, extra: { perEnemyAlive: 2 }, up: { d: "造成 {v} 点伤害，场上每个敌人额外 +3，无视护甲", v: 7, extra: { perEnemyAlive: 3, pierceArmor: true } } }],
    ["表面积", { a: "guard", n: "包覆", d: "获得 {v} 点护盾，每 4 张手牌 +1", v: 5, cost: 1, extra: { handSizePer: 4 }, up: { d: "获得 {v} 点护盾，每 4 张手牌 +1，并回复 3 点自信值", v: 7, extra: { handSizePer: 4, heal: 3 } } }],
    ["体积", { a: "guard", n: "实体", d: "获得 {v} 点护盾", v: 6, cost: 2, up: { d: "获得 {v} 点护盾，并回复 4 点自信值", v: 9, extra: { heal: 4 } } }],
    ["弧长与扇形面积", { a: "multi", n: "扇形", d: "连续 3 次，每次造成 {v} 点伤害", v: 2, cost: 1, extra: { hits: 3 }, up: { d: "连续 3 次，每次造成 {v} 点伤害，无视护甲", v: 3, extra: { hits: 3, pierceArmor: true } } }],
    // ===== 数学 · 概率统计 =====
    ["条件概率", { a: "buff", n: "条件", d: "下一张卡伤害 +3（仅当上一张卡打出过伤害）", v: 3, cost: 1, extra: { nextCardDamageBonus: 3, ifLastDamage: true }, up: { d: "下一张卡伤害 +{v}（仅当上一张卡打出过伤害）", v: 5, extra: { nextCardDamageBonus: 5, ifLastDamage: true } } }],
    ["古典概型", { a: "draw", n: "等可能", d: "抽 3 张牌", v: 2, cost: 1, extra: { drawCount: 3 }, up: { d: "抽 4 张牌", v: 2, extra: { drawCount: 4 } } }],
    ["排列数", { a: "strike", n: "排列", d: "造成 {v} 点伤害，本回合每已出 1 张牌 +1（顺序不同结果不同）", v: 5, cost: 1, extra: { bonusPerCardPlayed: 1 }, up: { d: "造成 {v} 点伤害，本回合每已出 1 张牌 +2（顺序不同结果不同）", v: 6, extra: { bonusPerCardPlayed: 2 } } }],
    ["组合数", { a: "strike", n: "组合", d: "造成 {v} 点伤害，本回合每打出 1 种不同卡型 +2", v: 4, cost: 1, extra: { perArchetypeVariety: 2 }, up: { d: "造成 {v} 点伤害，本回合每打出 1 种不同卡型 +3", v: 6, extra: { perArchetypeVariety: 3 } } }],
    ["二项式定理", { a: "buff", n: "展开", d: "能量 +1，下一张卡伤害 +2", v: 2, cost: 0, extra: { energyGain: 1, nextCardDamageBonus: 2 }, up: { d: "下一张卡伤害 +{v}，每 4 张手牌额外 +1", v: 4, extra: { nextCardDamageBonus: 4, handSizePer: 4 } } }],
    ["互斥事件", { a: "strike", n: "互斥", d: "造成 {v} 点伤害；40% 概率 ×2", v: 5, cost: 1, extra: { probBoost: { p: 0.4, multiplier: 2 } }, up: { d: "造成 {v} 点伤害；50% 概率 ×2，无视护甲", v: 7, extra: { probBoost: { p: 0.5, multiplier: 2 }, pierceArmor: true } } }],
    ["数字统计", { a: "draw", n: "统计", d: "抽 2 张牌", v: 2, cost: 0, extra: { drawCount: 2 }, up: { d: "抽 3 张牌，能量 +1", v: 3, extra: { drawCount: 3, energyGain: 1 } } }],
    ["计数原理", { a: "draw", n: "计数", d: "抽 2 张牌，能量 +1", v: 2, cost: 0, extra: { drawCount: 2, energyGain: 1 }, up: { d: "抽 3 张牌，能量 +1", v: 3, extra: { drawCount: 3, energyGain: 1 } } }],
    // ===== 数学 · 数列/导数 =====
    ["等差数列通项", { a: "strike", n: "通项", d: "造成 {v} 点伤害；本卡每次打出后伤害永久 +1", v: 4, cost: 1, extra: { stackPerPlay: 1 }, up: { d: "造成 {v} 点伤害；本卡每次打出后伤害永久 +2", v: 6, extra: { stackPerPlay: 2 } } }],
    ["等比数列通项", { a: "strike", n: "公比", d: "造成 {v} 点伤害；本卡每次打出后伤害永久 +2", v: 4, cost: 1, extra: { stackPerPlay: 2 }, up: { d: "造成 {v} 点伤害；本卡每次打出后伤害永久 +3", v: 6, extra: { stackPerPlay: 3 } } }],
    ["等差数列求和", { a: "strike", n: "求和", d: "造成 {v} 点伤害", v: 7, cost: 2, up: { d: "造成 {v} 点伤害，无视护甲", v: 10, extra: { pierceArmor: true } } }],
    ["等比数列求和", { a: "multi", n: "等比和", d: "连续 3 次，每次造成 {v} 点伤害", v: 2, cost: 1, extra: { hits: 3 }, up: { d: "连续 3 次，每次造成 {v} 点伤害，无视护甲", v: 3, extra: { hits: 3, pierceArmor: true } } }],
    ["定积分", { a: "strike", n: "积分", d: "造成 {v} 点伤害", v: 6, cost: 2, up: { d: "造成 {v} 点伤害，加上上一张卡伤害的 50%", v: 9, extra: { lastDamageRatio: 0.5 } } }],
    ["复数", { a: "draw", n: "虚实", d: "抽 2 张牌，能量 +1", v: 2, cost: 0, extra: { drawCount: 2, energyGain: 1 }, up: { d: "抽 3 张牌，能量 +1", v: 3, extra: { drawCount: 3, energyGain: 1 } } }],
    // ===== 数学 · 三角/几何补充 =====
    ["三角函数恒等变换", { a: "buff", n: "恒等式", d: "下一张卡伤害 +3，本回合每已出 1 张牌额外 +1", v: 3, cost: 1, extra: { nextCardDamageBonus: 3, bonusPerCardPlayed: 1 }, up: { d: "下一张卡伤害 +{v}，本回合每已出 1 张牌额外 +2", v: 5, extra: { nextCardDamageBonus: 5, bonusPerCardPlayed: 2 } } }],
    ["三角函数一般公式", { a: "multi", n: "一般式", d: "连续 3 次，每次造成 {v} 点伤害", v: 2, cost: 1, extra: { hits: 3 }, up: { d: "连续 3 次，每次造成 {v} 点伤害，对全部敌人", v: 3, extra: { hits: 3, allEnemies: true } } }],
    ["解斜三角形", { a: "strike", n: "解三角形", d: "造成 {v} 点伤害", v: 6, cost: 1, up: { d: "造成 {v} 点伤害，无视护甲", v: 9, extra: { pierceArmor: true } } }],
    ["正弦定理", { a: "strike", n: "正弦比", d: "造成 {v} 点伤害，场上每个敌人额外 +1", v: 5, cost: 1, extra: { perEnemyAlive: 1 }, up: { d: "造成 {v} 点伤害，场上每个敌人额外 +2", v: 7, extra: { perEnemyAlive: 2 } } }],
    ["余弦定理", { a: "strike", n: "余弦", d: "造成 {v} 点伤害", v: 7, cost: 2, up: { d: "造成 {v} 点伤害，本回合每已出 1 张牌 +1", v: 10, extra: { bonusPerCardPlayed: 1 } } }],
    ["圆锥曲线", { a: "strike", n: "圆锥", d: "造成 {v} 点伤害，无视护甲", v: 6, cost: 1, extra: { pierceArmor: true }, up: { d: "对全部敌人造成 {v} 点伤害，无视护甲", v: 5, extra: { pierceArmor: true, allEnemies: true } } }],
    ["焦点性质", { a: "crit", n: "焦点", d: "造成 {v} 点伤害，暴击时 ×3", v: 5, cost: 1, extra: { critMultiplier: 3 }, up: { d: "造成 {v} 点伤害，暴击时 ×3，并获 3 点护盾", v: 6, extra: { critMultiplier: 3, block: 3 } } }],
    // ===== 数学补充 =====
    ["均值不等式", { a: "buff", n: "均值", d: "下一张卡伤害 +{v}", v: 4, cost: 1, up: { d: "下一张卡伤害 +{v}，每 4 张手牌额外 +1", v: 6, extra: { handSizePer: 4 } } }],
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

/** 构造主题卡的「真·成就」升级效果（战斗专属；无 up 条目的卡返回 null，由调用方走卡型兜底） */
export function buildThemedPlusEffect(def: ThemedCardDef): CardEffect | null {
    if (!def.up) return null;
    const up = def.up;
    const effect: CardEffect = {
        archetype: def.a,
        archetypeLabel: `${def.n}·真`,
        description: up.d.replace("{v}", String(up.v)),
        cost: up.cost ?? def.cost,
        value: up.v,
    };
    if (up.extra) {
        for (const [key, v] of Object.entries(up.extra)) {
            if (v !== undefined) (effect as unknown as Record<string, unknown>)[key] = v;
        }
    }
    return effect;
}
