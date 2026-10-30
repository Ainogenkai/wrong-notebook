import type { CardEventData } from "@/types/api";
import { createSeededRandom } from "@/lib/card-enemies";

/**
 * 事件节点数据（全部复用现有引擎原语，无新机制）
 * 效果语义：
 * - heal / selfDamage / draw / discardHand：立即结算
 * - dmgBonus：本次战斗所有伤害卡永久 +N
 * - energyBonus：最大能量 +N（本局）
 * - nextTurnEnergy：下回合开始能量 +N
 * - nextDrawBonus：下次战斗开始多抽 N 张
 * - nextBlock：下次战斗开始时护盾 +N
 * - upgradeRandom：随机强化一张卡（无卡可强化则回 15 血）
 * - buffRandomCard：随机一张伤害卡永久 +N
 * - gamble：掷 1~12 骰，偶数回血 / 奇数受伤
 */
export const CARD_EVENTS: CardEventData[] = [
    {
        id: 1,
        name: "草稿纸商人",
        desc: "一个神秘同学在路边摊铺开一摞草稿纸：「要吗？」",
        choices: [
            { id: "a", label: "以物易物", desc: "抽 2 张牌，弃掉手中顶上一张", effects: { draw: 2, discardHand: 1 } },
            { id: "b", label: "买份安心", desc: "下次战斗开始时护盾 +4", effects: { nextBlock: 4 } },
            { id: "c", label: "随手翻看", desc: "抽 1 张牌", effects: { draw: 1 } },
        ],
    },
    {
        id: 2,
        name: "错题深渊",
        desc: "深渊里堆着你所有做错过的题，它们正发光。",
        choices: [
            { id: "a", label: "直面它们", desc: "受到 4 点伤害，但本次战斗所有伤害卡 +1", effects: { selfDamage: 4, dmgBonus: 1 } },
            { id: "b", label: "绕道走", desc: "不触发任何效果", effects: {} },
        ],
    },
    {
        id: 3,
        name: "灵感泉",
        desc: "你靠在泉边打盹，梦里把所有定理都串了起来。",
        choices: [
            { id: "a", label: "深呼吸", desc: "回复 12 点自信值", effects: { heal: 12 } },
            { id: "b", label: "保持势头", desc: "下次战斗开始多抽 1 张牌", effects: { nextDrawBonus: 1 } },
            { id: "c", label: "刷题固本", desc: "随机强化卡组里的一张卡", effects: { upgradeRandom: true } },
        ],
    },
    {
        id: 4,
        name: "旧笔记",
        desc: "同学在草稿本上夹着一页写满关键结论的旧笔记。",
        choices: [
            { id: "a", label: "偷学一手", desc: "本次战斗所有伤害卡 +1 伤害", effects: { dmgBonus: 1 } },
            { id: "b", label: "分他一杯茶", desc: "回复 6 点自信值", effects: { heal: 6 } },
        ],
    },
    {
        id: 5,
        name: "奶茶机",
        desc: "一台自动贩卖机凭空出现，里面只卖奶茶。",
        choices: [
            { id: "a", label: "咕咚一口", desc: "最大能量 +1", effects: { energyBonus: 1 } },
            { id: "b", label: "慢慢品", desc: "回复 3 点自信值，最大能量 +1", effects: { heal: 3, energyBonus: 1 } },
        ],
    },
    {
        id: 6,
        name: "小憩",
        desc: "教室外的老槐树下，有个空位正好。",
        choices: [
            { id: "a", label: "眯一会儿", desc: "回复 8 点自信值", effects: { heal: 8 } },
            { id: "b", label: "伸个懒腰", desc: "下次战斗开始时护盾 +4", effects: { nextBlock: 4 } },
            { id: "c", label: "整理笔记", desc: "抽 1 张牌", effects: { draw: 1 } },
        ],
    },
    {
        id: 7,
        name: "模拟考场",
        desc: "你忽然觉得，任何题都能解。",
        choices: [
            { id: "a", label: "胸有成竹", desc: "抽 2 张牌", effects: { draw: 2 } },
            { id: "b", label: "沉淀一下", desc: "回复 4 点自信值", effects: { heal: 4 } },
        ],
    },
    {
        id: 8,
        name: "自习角",
        desc: "自习角里，你把一道题刷到了第 100 遍。",
        choices: [
            { id: "a", label: "融会贯通", desc: "卡组中随机一张伤害卡永久 +1 伤害", effects: { buffRandomCard: 1 } },
            { id: "b", label: "劳逸结合", desc: "回复 4 点自信值", effects: { heal: 4 } },
        ],
    },
    {
        id: 9,
        name: "题海",
        desc: "眼前的题目无穷无尽，你决定纵身一跃。",
        choices: [
            { id: "a", label: "纵身入海", desc: "掷骰 1~12：偶数回复，奇数受伤", effects: { gamble: true } },
            { id: "b", label: "缓一口气", desc: "抽 1 张牌", effects: { draw: 1 } },
        ],
    },
    {
        id: 10,
        name: "深夜台灯",
        desc: "凌晨两点的台灯还亮着，光晕里尘埃浮动。",
        choices: [
            { id: "a", label: "蓄点电", desc: "下回合开始能量 +2", effects: { nextTurnEnergy: 2 } },
            { id: "b", label: "再看一会儿", desc: "回复 3 点自信值并抽 2 张牌", effects: { heal: 3, draw: 2 } },
        ],
    },
];

/** 确定性挑选事件：同 seed + nodeId 永远同一张事件卡 */
export function pickEventId(seed: number, nodeId: number): number {
    const r = createSeededRandom(seed * 7919 + nodeId * 101 + 13);
    return CARD_EVENTS[Math.floor(r() * CARD_EVENTS.length)].id;
}

export function getEventById(id: number): CardEventData | undefined {
    return CARD_EVENTS.find((e) => e.id === id);
}
