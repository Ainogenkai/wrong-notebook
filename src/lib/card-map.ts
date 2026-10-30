import type { BattleStage, EnemyDef, GameMap, MapNode, BattleNodeType } from "@/types/api";
import { BOSS_ENEMY_ID, ENEMIES, createSeededRandom, getEnemyById } from "@/lib/card-enemies";

/**
 * 杀戮尖塔第一幕式节点地图（纯函数、种子确定）
 * - 12 个中间列（0..11）× 4 行，每列 3 个节点（第 0 列 2 个），第 12 列为 BOSS
 * - 特殊列：3/7/10 出事件点，5/8 出休整点，6 出精英点（列内随机行）
 * - 从某节点出发，下一列 ±1 行内的节点可选（同杀戮尖塔）
 * - 一条完整路线 = 13 个节点（12 中间列 + BOSS）
 */

export const MAP_TOTAL_NODES = 13;

export const NODE_TYPE_LABEL: Record<BattleNodeType, string> = {
    battle: "战斗",
    elite: "精英",
    event: "事件",
    rest: "休整",
    boss: "期末试卷",
};

const SPECIAL_COL: Record<number, BattleNodeType> = {
    3: "event",
    5: "rest",
    6: "elite",
    7: "event",
    8: "rest",
    10: "event",
};

function shuffleSeeded<T>(arr: T[], rand: () => number): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function buildMap(seed: number): GameMap {
    const rand = createSeededRandom(seed * 2654435761 + 17);
    const nodes: MapNode[] = [];

    const addNode = (col: number, row: number, type: BattleNodeType) =>
        nodes.push({ id: nodes.length, col, row, type });

    // 第 0 列：2 个战斗节点（行 1、2）
    addNode(0, 1, "battle");
    addNode(0, 2, "battle");

    let prevRows = [1, 2];
    for (let col = 1; col <= 11; col++) {
        // 候选行 = 上一列各行 ±1 的并集（保证永远有路可走）
        const candidates = new Set<number>();
        for (const p of prevRows) {
            for (let r = Math.max(0, p - 1); r <= Math.min(3, p + 1); r++) candidates.add(r);
        }
        const rows = shuffleSeeded([...candidates], rand).slice(0, 3).sort((a, b) => a - b);
        const special = SPECIAL_COL[col];
        const specialRow = special ? rows[Math.floor(rand() * rows.length)] : -1;
        for (const row of rows) addNode(col, row, special && row === specialRow ? special : "battle");
        prevRows = rows;
    }

    // BOSS：第 12 列，单节点（行 1 或 2，上一列 ±1 必可达）
    const bossRow = prevRows.includes(1) ? 1 : 2;
    addNode(12, bossRow, "boss");

    return { seed, nodes };
}

/** 当前路线可选的下一列节点（±1 行） */
export function availableNodes(map: GameMap, path: number[]): MapNode[] {
    if (path.length === 0) return map.nodes.filter((n) => n.col === 0);
    const last = map.nodes[path[path.length - 1]];
    if (!last || last.col >= 12) return [];
    return map.nodes.filter((n) => n.col === last.col + 1 && Math.abs(n.row - last.row) <= 1);
}

/** 路线是否走完（含 BOSS） */
export function isMapComplete(map: GameMap, path: number[]): boolean {
    if (path.length === 0) return false;
    const last = map.nodes[path[path.length - 1]];
    return last?.type === "boss";
}

/**
 * 为每个战斗类节点预生成敌群（确定性）：
 * - 战斗：1~2 只普通怪（种子决定）
 * - 精英：1 只普通怪 ×1.5 HP +2 护甲
 * - BOSS：期末试卷
 */
export function buildNodeStages(seed: number): Record<number, BattleStage[]> {
    const { nodes } = buildMap(seed);
    const pool = ENEMIES.filter((e) => e.id !== BOSS_ENEMY_ID);
    const boss = getEnemyById(BOSS_ENEMY_ID);
    const out: Record<number, BattleStage[]> = {};

    for (const n of nodes) {
        if (n.type === "event" || n.type === "rest") continue;
        const r = createSeededRandom(seed * 31 + n.id * 7 + 3);

        if (n.type === "boss") {
            if (boss) out[n.id] = [[boss]];
            continue;
        }
        if (n.type === "elite") {
            const base = pool[Math.floor(r() * pool.length)];
            const elite: EnemyDef = {
                ...base,
                name: `${base.name}·精英`,
                hp: Math.round(base.hp * 1.5),
                armor: base.armor + 2,
            };
            out[n.id] = [[elite]];
            continue;
        }

        // 普通战斗：55% 单怪 / 45% 双怪
        const count = r() < 0.55 ? 1 : 2;
        const a = pool[Math.floor(r() * pool.length)];
        const stage: EnemyDef[] = [a];
        if (count === 2) {
            let b = pool[Math.floor(r() * pool.length)];
            if (b.id === a.id) b = pool[(pool.indexOf(b) + 1) % pool.length];
            stage.push(b);
        }
        out[n.id] = [stage];
    }
    return out;
}
