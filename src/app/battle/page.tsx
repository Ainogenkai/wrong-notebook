"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Layers, Loader2, Swords, Target } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { BATTLE_DECK_SIZE } from "@/lib/card-battle";
import type { BattleCard, DeckCard, DeckResponse } from "@/types/api";
import { CardDeckBuilder } from "@/components/card-deck-builder";
import { CardBattleView } from "@/components/card-battle-view";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";

export default function BattlePage() {
    const [data, setData] = useState<DeckResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deck, setDeck] = useState<BattleCard[] | null>(null);

    const fetchDeck = useCallback(async () => {
        try {
            setError(null);
            const res = await apiClient.get<DeckResponse>("/api/cards");
            setData(res);
        } catch (e) {
            console.error("Failed to load card deck:", e);
            setError("卡组加载失败，请稍后重试");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDeck();
    }, [fetchDeck]);

    const inBattle = deck !== null;
    const cards: DeckCard[] = data?.cards ?? [];

    return (
        <div className="min-h-screen bg-[#070913] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
            {/* 顶部 HUD */}
            <header className="sticky top-0 z-30 border-b border-cyan-900/40 bg-[#0c1022]/90 backdrop-blur-md px-4 py-3">
                <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <BackButton fallbackUrl="/cards" className="text-slate-400 hover:text-cyan-300" />
                        <div className="flex items-center gap-2.5">
                            <div className="rounded-lg border border-cyan-500/50 bg-cyan-950/70 p-2 shadow-[0_0_12px_rgba(6,182,212,0.25)]">
                                <Swords className="h-4 w-4 text-cyan-400" />
                            </div>
                            <div>
                                <h1 className="font-mono text-sm font-extrabold tracking-wider text-cyan-100">
                                    卡组出征
                                </h1>
                                <p className="mt-0.5 font-mono text-[11px] tracking-tight text-cyan-400/80">
                                    {inBattle ? "战斗中" : "从错题本里挑 12 张卡，爬塔 8 层"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs">
                        {!inBattle ? (
                            <div className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-slate-900/90 px-3 py-1.5 shadow-[0_0_10px_rgba(6,182,212,0.12)]">
                                <Layers className="h-3.5 w-3.5 text-cyan-400" />
                                <span className="text-[11px] text-slate-400">卡池:</span>
                                <span className="font-bold text-cyan-300">
                                    {cards.length} 张 · 上限 {BATTLE_DECK_SIZE}
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-slate-900/90 px-3 py-1.5 shadow-[0_0_10px_rgba(245,158,11,0.12)]">
                                <Target className="h-3.5 w-3.5 text-amber-400" />
                                <span className="text-[11px] text-slate-400">出战:</span>
                                <span className="font-bold text-amber-300">{deck.length} 张</span>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-3xl space-y-6 p-4 pb-16">
                {loading ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-28 text-slate-400">
                        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                        <p className="font-mono text-xs tracking-widest text-cyan-300/80">
                            正在展开卡组...
                        </p>
                    </div>
                ) : error ? (
                    <div className="rounded-xl border border-rose-900/60 bg-rose-950/30 py-16 text-center">
                        <p className="text-sm text-rose-300">{error}</p>
                        <Button onClick={fetchDeck} className="mt-4 text-xs">
                            重试
                        </Button>
                    </div>
                ) : inBattle ? (
                    <CardBattleView
                        deck={deck!}
                        onExit={() => setDeck(null)}
                    />
                ) : (
                    <>
                        <section className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/50 px-5 py-4">
                            <p className="text-xs leading-relaxed text-slate-400">
                                勾选出战卡（上限 {BATTLE_DECK_SIZE} 张，卡池不足时引擎自动补基础牌）。
                                卡所属章节命中敌人弱点关键词时伤害 ×1.5——带够「对路的卡」。
                            </p>
                            {cards.length === 0 && (
                                <span className="ml-auto shrink-0">
                                    <Link href="/cards" className="font-mono text-[11px] text-cyan-400 hover:text-cyan-300">
                                        去卡组看看 →
                                    </Link>
                                </span>
                            )}
                        </section>
                        <CardDeckBuilder
                            cards={cards}
                            onBattleStart={(d) => setDeck(d)}
                        />
                    </>
                )}
            </main>
        </div>
    );
}
