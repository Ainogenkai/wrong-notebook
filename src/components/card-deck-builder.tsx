"use client";

import { BATTLE_DECK_SIZE } from "@/lib/card-battle";
import { Swords, Trash2, Wand2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TIER_META, formatCardPath } from "@/lib/cards";
import type { BattleCard, DeckCard } from "@/types/api";
import { Button } from "@/components/ui/button";

interface CardDeckBuilderProps {
    cards: DeckCard[];
    onBattleStart: (deck: BattleCard[]) => void;
}

export function CardDeckBuilder({ cards, onBattleStart }: CardDeckBuilderProps) {
    const [selected, setSelected] = useState<string[]>([]);

    const toggle = (id: string) => {
        setSelected((prev) => {
            if (prev.includes(id)) return prev.filter((x) => x !== id);
            if (prev.length >= BATTLE_DECK_SIZE) return prev;
            return [...prev, id];
        });
    };

    const autoPick = () => {
        setSelected(cards.slice(0, BATTLE_DECK_SIZE).map((c) => c.id));
    };

    const clearAll = () => setSelected([]);

    const selectedCards = cards.filter((c) => selected.includes(c.id));

    if (cards.length === 0) {
        return (
            <section className="rounded-2xl border border-amber-500/30 bg-amber-950/20 px-5 py-12 text-center">
                <p className="text-sm text-amber-200/90">卡池为空，先攒几张再出征</p>
                <p className="mt-2 text-xs text-slate-400">先去录入错题或做章节诊断获取卡牌</p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    <Link href="/diagnostic">
                        <Button className="h-8 gap-1.5 bg-amber-600/90 text-xs text-white hover:bg-amber-500">
                            <Swords className="h-3.5 w-3.5" />
                            做章节诊断
                        </Button>
                    </Link>
                    <Link href="/">
                        <Button variant="outline" className="h-8 gap-1.5 border-slate-600 text-xs text-slate-200 hover:bg-slate-800">
                            录入错题
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                    </Link>
                </div>
            </section>
        );
    }

    return (
        <div className="space-y-4">
            {/* 工具条 */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-900/50 px-4 py-3">
                <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-slate-500">已选</span>
                    <span className={`text-sm font-bold ${selected.length > 0 ? "text-cyan-300" : "text-slate-400"}`}>
                        {selected.length}/{BATTLE_DECK_SIZE}
                    </span>
                    <span className="hidden text-[11px] text-slate-500 sm:inline">
                        （不足 12 张时自动补基础牌）
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                        onClick={autoPick}
                        disabled={cards.length === 0}
                    >
                        <Wand2 className="h-3.5 w-3.5 text-cyan-400" />
                        自动组卡
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                        onClick={clearAll}
                        disabled={selected.length === 0}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        清空
                    </Button>
                    <Button
                        size="sm"
                        className="gap-1.5 bg-cyan-600/90 text-xs text-white hover:bg-cyan-500"
                        onClick={() => onBattleStart(selectedCards.map((c) => ({ ...c, uid: c.id })))}
                        disabled={selected.length === 0}
                    >
                        <Swords className="h-3.5 w-3.5" />
                        开战
                    </Button>
                </div>
            </div>

            {/* 卡列表 */}
            <div className="space-y-2">
                {cards.map((card) => {
                    const isSelected = selected.includes(card.id);
                    const meta = TIER_META[card.tier];
                    const path = formatCardPath(card.path);
                    const full = !isSelected && selected.length >= BATTLE_DECK_SIZE;
                    return (
                        <button
                            key={card.id}
                            type="button"
                            onClick={() => toggle(card.id)}
                            disabled={full}
                            title={full ? `已满 ${BATTLE_DECK_SIZE} 张，先取消其他再选` : undefined}
                            className={`group relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left transition-all duration-150 disabled:cursor-not-allowed ${
                                isSelected
                                    ? "border-cyan-500/60 bg-cyan-950/30 shadow-[0_0_14px_rgba(6,182,212,0.15)]"
                                    : "border-slate-800/80 bg-slate-900/40 hover:border-slate-700"
                            } ${full ? "opacity-40" : ""}`}
                        >
                            <span
                                className="absolute inset-y-0 left-0 w-1"
                                style={{ backgroundColor: isSelected ? meta.color : `${meta.color}55` }}
                                aria-hidden="true"
                            />
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-2">
                                <span className="text-sm font-semibold text-slate-100">{card.name}</span>
                                <span
                                    className="rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider"
                                    style={{ borderColor: `${meta.color}66`, color: meta.color }}
                                >
                                    {meta.label}
                                </span>
                                <span className="font-mono text-[11px] text-slate-400">
                                    {card.effect.archetypeLabel} · {card.effect.cost} 能量
                                </span>
                                <span className="font-mono text-[11px] text-cyan-300/80">{card.effect.description}</span>
                                {path && (
                                    <span className="ml-auto truncate font-mono text-[10px] text-slate-500">{path}</span>
                                )}
                                <span
                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                        isSelected
                                            ? "border-cyan-400 bg-cyan-500/80 text-[#070913]"
                                            : "border-slate-600 text-transparent"
                                    } ${full ? "hidden" : ""}`}
                                    aria-hidden="true"
                                >
                                    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                                        <path d="M2.5 6.5L5 9L9.5 3" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
