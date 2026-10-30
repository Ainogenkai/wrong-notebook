"use client";

import type { MapNode } from "@/types/api";
import { cn } from "@/lib/utils";

interface CardMapViewProps {
    nodes: MapNode[];
    path: number[];
    available: MapNode[];
    onChoose: (node: MapNode) => void;
    active: boolean;
}

const NODE_CHAR: Record<MapNode["type"], string> = {
    battle: "战",
    elite: "精",
    event: "事",
    rest: "息",
    boss: "终",
};

const COL_W = 64;
const ROW_H = 56;
const PAD_X = 30;
const PAD_Y = 28;
const VIEW_W = 13 * COL_W + 60;
const VIEW_H = 4 * ROW_H + 56;

function nodeXY(col: number, row: number) {
    return { x: PAD_X + col * COL_W, y: PAD_Y + row * ROW_H };
}

export function CardMapView({ nodes, path, available, onChoose, active }: CardMapViewProps) {
    const visited = new Set(path);
    const availableIds = new Set(available.map((n) => n.id));

    // 边线：每个节点 → 下一列 ±1 行内的节点
    const edges: { a: MapNode; b: MapNode }[] = [];
    for (const a of nodes) {
        if (a.col >= 12) continue;
        for (const b of nodes) {
            if (b.col === a.col + 1 && Math.abs(b.row - a.row) <= 1) edges.push({ a, b });
        }
    }

    // 路径相邻节点之间的高亮线
    const pathEdges: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i + 1 < path.length; i++) {
        const a = nodes.find((n) => n.id === path[i]);
        const b = nodes.find((n) => n.id === path[i + 1]);
        if (!a || !b) continue;
        const pa = nodeXY(a.col, a.row);
        const pb = nodeXY(b.col, b.row);
        pathEdges.push({ x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y });
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40 p-2">
            <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full min-w-[860px]" role="img" aria-label="节点地图">
                {edges.map(({ a, b }) => {
                    const pa = nodeXY(a.col, a.row);
                    const pb = nodeXY(b.col, b.row);
                    return (
                        <line
                            key={`edge-${a.id}-${b.id}`}
                            x1={pa.x}
                            y1={pa.y}
                            x2={pb.x}
                            y2={pb.y}
                            className="stroke-slate-700/50"
                            strokeWidth={1}
                        />
                    );
                })}
                {pathEdges.map((p, i) => (
                    <line
                        key={`path-${i}`}
                        x1={p.x1}
                        y1={p.y1}
                        x2={p.x2}
                        y2={p.y2}
                        className="stroke-cyan-400/70"
                        strokeWidth={2}
                        strokeLinecap="round"
                    />
                ))}
                {nodes.map((n) => {
                    const { x, y } = nodeXY(n.col, n.row);
                    const isVisited = visited.has(n.id);
                    const isAvailable = active && availableIds.has(n.id);
                    const r = n.type === "boss" ? 16 : 13;
                    const textFill =
                        n.type === "elite"
                            ? "fill-amber-300"
                            : n.type === "boss"
                              ? "fill-rose-300"
                              : isVisited
                                ? "fill-slate-200"
                                : "fill-slate-500";
                    return (
                        <g
                            key={n.id}
                            className={isAvailable ? "wb-glow cursor-pointer" : undefined}
                            onClick={isAvailable ? () => onChoose(n) : undefined}
                        >
                            <circle
                                cx={x}
                                cy={y}
                                r={r}
                                strokeWidth={isAvailable ? 2.5 : 1.5}
                                className={cn(
                                    isAvailable
                                        ? "fill-slate-900 stroke-amber-400"
                                        : isVisited
                                          ? "fill-slate-600 stroke-slate-400"
                                          : "fill-slate-900 stroke-slate-700/50"
                                )}
                            />
                            <text
                                x={x}
                                y={y}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize={n.type === "boss" ? 11 : 10}
                                className={cn("font-mono select-none", textFill)}
                            >
                                {NODE_CHAR[n.type]}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
