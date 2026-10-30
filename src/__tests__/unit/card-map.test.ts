import { describe, it, expect } from "vitest";
import {
    availableNodes,
    buildMap,
    buildNodeStages,
    isMapComplete,
    MAP_TOTAL_NODES,
} from "@/lib/card-map";
import { startMapBattle, applyAction, battleScore } from "@/lib/card-battle";
import type { BattleCard, BattleState, GameMap } from "@/types/api";

function deck(): BattleCard[] {
    return [
        {
            uid: "t1",
            name: "牛顿",
            subject: "physics",
            subjectLabel: "物理",
            path: [],
            tier: "skilled",
            tierLabel: "熟练",
            flavor: "",
            effect: {
                archetype: "strike",
                archetypeLabel: "猛攻",
                description: "造成 6 点伤害",
                cost: 1,
                value: 6,
            },
        },
    ];
}

describe("lib/card-map", () => {
    it("buildMap 确定性：同 seed 生成同构地图", () => {
        const a = buildMap(42);
        const b = buildMap(42);
        expect(a.nodes).toEqual(b.nodes);
        // 不同 seed 的节点布局不同（行选择不同）
        expect(buildMap(42).nodes.map((n) => `${n.col}:${n.row}:${n.type}`).join(","))
            .not.toBe(buildMap(43).nodes.map((n) => `${n.col}:${n.row}:${n.type}`).join(","));
    });

    it("地图形状：36 节点（2 + 33 + 1），终点是 BOSS", () => {
        const map = buildMap(7);
        expect(map.nodes).toHaveLength(36);
        const boss = map.nodes.filter((n) => n.type === "boss");
        expect(boss).toHaveLength(1);
        expect(boss[0].col).toBe(12);
        // 特殊列各 1 个
        const count = (t: string) => map.nodes.filter((n) => n.type === t).length;
        expect(count("elite")).toBe(1);
        expect(count("rest")).toBe(2);
        expect(count("event")).toBe(3);
    });

    it("路线永远走得通：每步都有可达节点，13 步到底", () => {
        for (const seed of [1, 42, 999]) {
            const map = buildMap(seed);
            const path: number[] = [];
            for (let step = 0; step < MAP_TOTAL_NODES; step++) {
                const avail = availableNodes(map, path);
                expect(avail.length).toBeGreaterThanOrEqual(1);
                // 贪心走第一列可达节点
                path.push(avail[0].id);
            }
            expect(isMapComplete(map, path)).toBe(true);
        }
    });

    it("buildNodeStages：战斗/精英/BOSS 有敌群，事件/休整没有", () => {
        const map = buildMap(5);
        const stages = buildNodeStages(5);
        for (const n of map.nodes) {
            if (n.type === "battle") {
                expect(stages[n.id]).toHaveLength(1);
                expect(stages[n.id][0].length).toBeLessThanOrEqual(2);
            }
            if (n.type === "elite") {
                expect(stages[n.id]).toHaveLength(1);
                expect(stages[n.id][0][0].name).toContain("精英");
            }
            if (n.type === "boss") {
                expect(stages[n.id][0][0].name).toContain("期末");
            }
            if (n.type === "event" || n.type === "rest") {
                expect(stages[n.id]).toBeUndefined();
            }
        }
    });

    it("startMapBattle：开局进入第 1 个节点，path 长度 1", () => {
        const s = startMapBattle(deck(), 88);
        expect(s.map).toHaveLength(36);
        expect(s.path).toHaveLength(1);
        expect(s.nodesCleared).toBe(0);
        expect(s.phase).toBe("player");
        expect(s.enemies.length).toBeGreaterThan(0);
    });

    it("事件节点：TAKE_EVENT 结算回血并回到选节点", () => {
        // 找一个 event 节点：走到第 3 列（必为事件列），贪心到该列
        const map = buildMap(21);
        const path: number[] = [];
        for (let step = 0; step < 3; step++) {
            path.push(availableNodes(map, path)[0].id);
        }
        const s = startMapBattle(deck(), 21);
        // 快进：直接跳到事件节点的引擎态（模拟清完前 3 个战斗）
        const s2 = applyAction(s, { type: "CHOOSE_NODE", nodeId: -1 }); // 无效节点 no-op
        expect(s2.path).toHaveLength(1); // 不可达节点不前进

        // 事件结算：手动造一个 pendingPanel=event 的状态
        const eventNode = map.nodes.find((n) => n.type === "event")!;
        const smap = startMapBattle(deck(), 21);
        smap.pendingPanel = "event";
        smap.phase = "reward";
        smap.pendingEventId = 3; // 灵感泉
        const hpBefore = smap.player.hp;
        const after = applyAction(smap, { type: "TAKE_EVENT", choice: "a" }); // 深呼吸 回 12
        expect(after.player.hp).toBe(Math.min(100, hpBefore + 12));
        expect(after.pendingPanel).toBe("node");
        expect(eventNode.type).toBe("event");
    });

    it("休整节点：TAKE_REST 三种选择", () => {
        const s = startMapBattle(deck(), 21);
        s.pendingPanel = "rest";
        s.phase = "reward";
        const hp0 = s.player.hp;
        const s1 = applyAction(s, { type: "TAKE_REST", kind: "heal" });
        expect(s1.player.hp).toBe(Math.min(100, hp0 + 15));
        expect(s1.pendingPanel).toBe("node");

        const s2 = applyAction(s, { type: "TAKE_REST", kind: "shield" });
        expect(s2.player.nextBlock).toBeGreaterThanOrEqual(6);
        expect(s2.player.block).toBe(0); // 不直接加当前护盾，进下场战斗才生效

        const s3 = applyAction(s, { type: "TAKE_REST", kind: "draw" });
        expect(s3.hand.length).toBeGreaterThanOrEqual(s.hand.length);
    });

    it("进入新战斗节点：能量/护盾/手牌重置，事件加成开局生效", () => {
        const s = startMapBattle(deck(), 55);
        // 模拟上一场战斗的残留状态
        s.phase = "reward";
        s.pendingPanel = "node";
        s.player.energy = 0;
        s.player.block = 20;
        s.player.nextBlock = 4;
        s.player.nextDrawBonus = 2;
        s.lastDamage = 99;
        s.player.energyDrainNextTurn = 3;
        s.discardPile = [...s.hand, ...s.drawPile.splice(0, 3)];
        s.hand = [];

        const avail = availableNodes({ seed: 55, nodes: s.map! }, s.path!);
        const target = avail.find((n) => n.type === "battle")!;
        const after = applyAction(s, { type: "CHOOSE_NODE", nodeId: target.id });

        expect(after.phase).toBe("player");
        expect(after.player.energy).toBe(3); // 能量重置为满，且能量淤积被清
        expect(after.player.block).toBe(4); // 旧护盾清零，nextBlock(4) 生效
        expect(after.player.nextBlock).toBe(0);
        expect(after.player.energyDrainNextTurn).toBe(0);
        expect(after.lastDamage).toBe(0);
        expect(after.hand.length).toBe(7); // 5 基础 + 2 事件多抽
        expect(after.player.nextDrawBonus).toBe(0);
        expect(after.discardPile).toHaveLength(0);
        expect(after.drawPile.length + after.hand.length).toBe(12); // 卡不丢
    });

    it("buffRandomCard：选中的卡在弃牌堆里也被强化（P2 回归）", () => {
        const s = startMapBattle(deck(), 21);
        s.phase = "reward";
        s.pendingPanel = "event";
        s.pendingEventId = 8; // 自习角：卡组中随机一张伤害卡永久 +1
        const strikeCard = s.deck.find((c) => c.effect.archetype === "strike" && c.name === "牛顿")!;
        // 保证随机必中：卡组里只留这一张伤害卡
        s.deck = s.deck.filter((c) => c.uid === strikeCard.uid || c.effect.archetype === "draw" || c.effect.archetype === "debuff");
        // 把它塞进弃牌堆
        s.drawPile = s.drawPile.filter((c) => c.uid !== strikeCard.uid);
        s.hand = s.hand.filter((c) => c.uid !== strikeCard.uid);
        s.discardPile.push(strikeCard);
        const v0 = strikeCard.effect.value;

        const after = applyAction(s, { type: "TAKE_EVENT", choice: "a" });
        // 事件 buff 记在 valueBonus（升级/洗牌不丢），effect.value 保持模板值
        const findBonus = (arr: typeof after.deck, uid: string) => arr.find((c) => c.uid === uid)?.valueBonus ?? 0;
        expect(findBonus(after.deck, strikeCard.uid)).toBe(1);
        expect(findBonus(after.discardPile, strikeCard.uid)).toBe(1); // 弃牌堆同卡同步强化
        // 实际生效数值 = 模板值 + valueBonus
        const findEff = (arr: typeof after.deck, uid: string) => {
            const c = arr.find((x) => x.uid === uid)!;
            return c.effect.value + (c.valueBonus ?? 0);
        };
        expect(findEff(after.deck, strikeCard.uid)).toBe(v0 + 1);
        expect(findEff(after.discardPile, strikeCard.uid)).toBe(v0 + 1);
    });

    it("CHOOSE_NODE 合法节点前进，战斗节点出怪", () => {
        const s = startMapBattle(deck(), 55);
        // 战斗中不可选节点 → 先切到选节点面板（模拟清完当前节点）
        s.phase = "reward";
        s.pendingPanel = "node";
        const map: GameMap = { seed: 55, nodes: s.map! };
        const avail = availableNodes(map, s.path!);
        expect(avail.length).toBeGreaterThan(0);
        const target = avail[0];
        const after = applyAction(s, { type: "CHOOSE_NODE", nodeId: target.id });
        expect(after.path).toHaveLength(2);
        expect(after.currentNodeId).toBe(target.id);
        if (target.type === "battle") {
            expect(after.phase).toBe("player");
            expect(after.enemies.length).toBeGreaterThan(0);
        }
    });

    it("battleScore 地图模式：victory = 1300 + hp + 伤害", () => {
        const s = startMapBattle(deck(), 3);
        s.phase = "victory";
        expect(battleScore(s)).toBe(MAP_TOTAL_NODES * 100 + s.player.hp + s.damageDealt);
    });

    it("全图攻略：无敌卡组走满 13 节点（含事件/休整/精英/BOSS），最终 victory", () => {
        // 12 张宗师卡：8 张穿透猛攻 + 4 张大护盾，任何节点都能稳过
        const strike: BattleCard = {
            uid: "god0",
            name: "牛顿",
            subject: "physics",
            subjectLabel: "物理",
            path: [] as string[],
            tier: "grandmaster" as const,
            tierLabel: "宗师",
            flavor: "",
            effect: {
                archetype: "strike",
                archetypeLabel: "猛攻",
                description: "造成 12 点伤害",
                cost: 1,
                value: 12,
                pierceArmor: true,
            },
        };
        const guard: BattleCard = {
            ...strike,
            uid: "godg",
            name: "浮力",
            effect: {
                archetype: "guard",
                archetypeLabel: "护盾",
                description: "获得 14 点护盾",
                cost: 1,
                value: 14,
                block: 14,
            },
        };
        const god: BattleCard[] = [
            ...Array.from({ length: 8 }, (_, i) => ({ ...strike, uid: `s${i}` })),
            ...Array.from({ length: 4 }, (_, i) => ({ ...guard, uid: `g${i}` })),
        ];

        let s = startMapBattle(god, 42);
        let steps = 0;
        while (s.phase !== "victory" && s.phase !== "defeat" && steps < 400) {
            steps++;
            if (s.phase === "player") {
                // 出光费用 ≤ 3 的卡（宗师 2 费），然后结束回合
                for (let c = 0; c < 3; c++) {
                    const card = s.hand.find((x) => x.effect.cost <= s.player.energy);
                    if (!card) break;
                    s = applyAction(s, { type: "PLAY_CARD", cardUid: card.uid });
                }
                s = applyAction(s, { type: "END_TURN" });
            } else if (s.pendingPanel === "event") {
                s = applyAction(s, { type: "TAKE_EVENT", choice: "a" });
            } else if (s.pendingPanel === "rest") {
                s = applyAction(s, { type: "TAKE_REST", kind: "heal" });
            } else if (s.pendingPanel === "node") {
                const avail = availableNodes({ seed: s.mapSeed!, nodes: s.map! }, s.path!);
                s = applyAction(s, { type: "CHOOSE_NODE", nodeId: avail[0].id });
            } else if (s.phase === "reward") {
                // 精英奖励：强化第一张可强化卡
                const up = upgradable(s);
                if (up.length > 0) s = applyAction(s, { type: "UPGRADE_CARD", cardUid: up[0].uid });
            }
        }
        expect(s.phase).toBe("victory");
        expect(s.path).toHaveLength(MAP_TOTAL_NODES);
        expect(s.nodesCleared).toBe(MAP_TOTAL_NODES);
    });
});

function upgradable(s: BattleState): BattleCard[] {
    const order: Record<string, string> = { flawed: "skilled", skilled: "expert", expert: "grandmaster", grandmaster: "true" };
    return s.deck.filter((c) => order[c.tier] !== undefined);
}
