"use client";

import type { CSSProperties } from "react";
import { Swords } from "lucide-react";
import type { DeckCard } from "@/types/api";
import { TIER_META, formatCardPath } from "@/lib/cards";

interface KnowledgeCardProps {
    card: DeckCard;
    onSelect?: (card: DeckCard) => void;
    className?: string;
}

export function KnowledgeCard({ card, onSelect, className = "" }: KnowledgeCardProps) {
    const meta = TIER_META[card.tier];
    const path = formatCardPath(card.path);
    const isFlawed = card.tier === "flawed";
    const isGrandmaster = card.tier === "grandmaster";
    const isExpert = card.tier === "expert";

    // 长术语自动缩字号，避免溢出卡面
    const nameLength = card.name.length;
    const nameSize = nameLength <= 4 ? "text-[23px]" : nameLength <= 6 ? "text-[19px]" : nameLength <= 9 ? "text-[16px]" : "text-[14px]";

    const style: CSSProperties = {
        borderColor: `${meta.color}${isGrandmaster ? "80" : "4d"}`,
        background: `radial-gradient(135% 65% at 50% -8%, ${meta.color}${isGrandmaster ? "40" : "2b"} 0%, transparent 62%), linear-gradient(180deg, #151d33 0%, #090e1c 100%)`,
        boxShadow: `0 16px 36px -26px ${meta.color}d9, inset 0 1px 0 ${meta.color}1f`,
    };

    return (
        <button
            type="button"
            onClick={() => onSelect?.(card)}
            style={style}
            className={`group relative flex aspect-[3/4] w-full flex-col overflow-hidden rounded-2xl border text-left transition-all duration-300 hover:-translate-y-1.5 hover:brightness-[1.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${className}`}
        >
            {/* 宗师/精通 的流光 */}
            {(isGrandmaster || isExpert) && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40">
                    <div className="absolute -left-12 top-0 h-full w-14 rotate-12 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                </div>
            )}

            {/* 破绽卡的裂纹 */}
            {isFlawed && (
                <svg
                    className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
                    viewBox="0 0 200 260"
                    fill="none"
                    aria-hidden="true"
                >
                    <path d="M18 12 L44 58 L32 96 L70 132" stroke={meta.color} strokeWidth="1.2" />
                    <path d="M44 58 L78 44" stroke={meta.color} strokeWidth="1" />
                    <path d="M70 132 L112 150 L140 132 L186 168" stroke={meta.color} strokeWidth="1.2" />
                    <path d="M140 132 L148 196 L182 236" stroke={meta.color} strokeWidth="1" />
                </svg>
            )}

            {/* 顶部：学科 + 品级 */}
            <div className="relative flex items-start justify-between px-3 pt-3">
                <span className="font-mono text-[10px] tracking-[0.2em] text-slate-500">
                    {card.subjectLabel}
                </span>
                <span
                    className="rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider"
                    style={{ borderColor: `${meta.color}66`, color: meta.color }}
                >
                    {meta.label}
                </span>
            </div>

            {/* 中部：术语 */}
            <div className="relative flex flex-1 flex-col items-center justify-center gap-2 px-3 text-center">
                <span className="flex items-center gap-1.5">
                    <span
                        className="inline-block h-1.5 w-1.5 rotate-45"
                        style={{ backgroundColor: meta.color }}
                        aria-hidden="true"
                    />
                    <span
                        className="font-mono text-[9px] tracking-[0.35em]"
                        style={{ color: `${meta.color}b3` }}
                    >
                        {meta.rarity}
                    </span>
                    <span
                        className="inline-block h-1.5 w-1.5 rotate-45"
                        style={{ backgroundColor: meta.color }}
                        aria-hidden="true"
                    />
                </span>
                <h3
                    className={`font-serif font-bold leading-tight tracking-wide text-slate-50 ${nameSize}`}
                    style={{ textShadow: `0 0 22px ${meta.color}4d` }}
                >
                    {card.name}
                </h3>
                {path && (
                    <p className="line-clamp-2 text-[10px] leading-relaxed text-slate-500">{path}</p>
                )}
                <p
                    className="line-clamp-1 font-mono text-[9px] leading-tight"
                    style={{ color: `${meta.color}cc` }}
                >
                    {card.effect.archetypeLabel} {card.effect.cost}费 · {card.effect.description}
                </p>
            </div>

            {/* 底部：战绩 */}
            <div className="relative px-3 pb-3">
                <div
                    className="mb-1.5 h-[3px] w-full overflow-hidden rounded-full bg-white/5"
                    aria-hidden="true"
                >
                    <div
                        className="h-full rounded-full transition-all"
                        style={{
                            width: `${Math.round(card.probability * 100)}%`,
                            background: `linear-gradient(90deg, ${meta.color}44, ${meta.color})`,
                        }}
                    />
                </div>
                <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="flex items-center gap-1 text-slate-400">
                        <Swords className="h-3 w-3" />
                        {card.totalTested} 战
                    </span>
                    <span style={{ color: meta.color }}>
                        {card.correctCount} 胜 · {card.errorCount} 败
                    </span>
                </div>
                <p className="mt-1 truncate text-[10px] italic text-slate-500">{card.flavor}</p>
            </div>
        </button>
    );
}
