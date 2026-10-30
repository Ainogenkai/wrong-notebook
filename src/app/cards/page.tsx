"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Layers, Loader2, Sparkles, Swords, Target, ArrowRight, Flame, Trophy, Gamepad2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { TIER_META, TIER_ORDER } from "@/lib/cards";
import type { DeckResponse, BattleRecordResponse } from "@/types/api";
import { CardDeck } from "@/components/card-deck";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";

export default function CardsPage() {
    const [data, setData] = useState<DeckResponse | null>(null);
    const [battleStats, setBattleStats] = useState<BattleRecordResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
        apiClient
            .get<BattleRecordResponse>("/api/cards/battle")
            .then(setBattleStats)
            .catch(() => {
                /* 战报不可用时静默 */
            });
    }, [fetchDeck]);

    const summary = data?.summary;
    const total = summary?.total ?? 0;

    return (
        <div className="min-h-screen bg-[#070913] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
            {/* 顶部 HUD */}
            <header className="sticky top-0 z-30 border-b border-cyan-900/40 bg-[#0c1022]/90 backdrop-blur-md px-4 py-3">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <BackButton fallbackUrl="/" className="text-slate-400 hover:text-cyan-300" />
                        <div className="flex items-center gap-2.5">
                            <div className="rounded-lg border border-cyan-500/50 bg-cyan-950/70 p-2 shadow-[0_0_12px_rgba(6,182,212,0.25)]">
                                <Layers className="h-4 w-4 text-cyan-400" />
                            </div>
                            <div>
                                <h1 className="font-mono text-sm font-extrabold tracking-wider text-cyan-100">
                                    我的卡组
                                </h1>
                                <p className="mt-0.5 font-mono text-[11px] tracking-tight text-cyan-400/80">
                                    知识即卡牌 · 做题即抽卡
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs">
                        <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-slate-900/90 px-3 py-1.5 shadow-[0_0_10px_rgba(245,158,11,0.12)]">
                            <Flame className="h-3.5 w-3.5 text-amber-400" />
                            <span className="text-slate-400 text-[11px]">收藏:</span>
                            <span className="font-bold text-amber-300">{total} 张</span>
                        </div>
                        <Link href="/battle">
                            <Button className="h-8 gap-1.5 bg-violet-600/90 px-3 text-xs text-white hover:bg-violet-500">
                                <Gamepad2 className="h-3.5 w-3.5" />
                                组卡出战
                            </Button>
                        </Link>
                        <Link href="/diagnostic">
                            <Button className="h-8 gap-1.5 bg-cyan-600/90 px-3 text-xs text-white hover:bg-cyan-500">
                                <Swords className="h-3.5 w-3.5" />
                                去考试
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl space-y-6 p-4 pb-16">
                {loading ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-28 text-slate-400">
                        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                        <p className="font-mono text-xs tracking-widest text-cyan-300/80">
                            正在读取学情数据库，展开卡组...
                        </p>
                    </div>
                ) : error ? (
                    <div className="rounded-xl border border-rose-900/60 bg-rose-950/30 py-16 text-center">
                        <p className="text-sm text-rose-300">{error}</p>
                        <Button onClick={fetchDeck} className="mt-4 text-xs">
                            重试
                        </Button>
                    </div>
                ) : (
                    <>
                        {/* 卡组总览 */}
                        <section className="overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/70 to-slate-950/40">
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/70 px-5 py-4">
                                <div>
                                    <h2 className="font-mono text-sm font-bold tracking-wide text-slate-200">
                                        卡组总览
                                    </h2>
                                    <p className="mt-0.5 text-[11px] text-slate-500">
                                        每道题都会沉淀成一张卡，答对升品级，答错留破绽
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 font-mono text-xs">
                                    <Target className="h-3.5 w-3.5 text-cyan-400" />
                                    <span className="text-slate-400">平均掌握度</span>
                                    <span className="font-bold text-cyan-300">
                                        {Math.round((summary?.masteryRate ?? 0) * 100)}%
                                    </span>
                                </div>
                            </div>

                            <div className="px-5 py-4">
                                {/* 品级分布条 */}
                                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/5">
                                    {TIER_ORDER.map((tier) => {
                                        const count = summary?.byTier[tier] ?? 0;
                                        if (count === 0) return null;
                                        const percent = (count / Math.max(total, 1)) * 100;
                                        return (
                                            <div
                                                key={tier}
                                                title={`${TIER_META[tier].label} ${count} 张`}
                                                style={{
                                                    width: `${percent}%`,
                                                    background: `linear-gradient(90deg, ${TIER_META[tier].color}cc, ${TIER_META[tier].color})`,
                                                }}
                                            />
                                        );
                                    })}
                                </div>

                                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                                    {TIER_ORDER.map((tier) => {
                                        const meta = TIER_META[tier];
                                        return (
                                            <div key={tier} className="flex items-center gap-1.5 font-mono text-xs">
                                                <span
                                                    className="h-2 w-2 rounded-full"
                                                    style={{ backgroundColor: meta.color }}
                                                />
                                                <span className="text-slate-400">{meta.label}</span>
                                                <span className="font-bold" style={{ color: meta.color }}>
                                                    {summary?.byTier[tier] ?? 0}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    <div className="ml-auto flex items-center gap-3 font-mono text-xs text-slate-400">
                                        {Object.entries(summary?.bySubject ?? {}).map(([subject, count]) => (
                                            <span key={subject}>
                                                {subject === "math" ? "数学" : subject === "physics" ? "物理" : subject}
                                                <span className="ml-1 font-bold text-slate-200">{count}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 卡墙 */}
                        <CardDeck cards={data?.cards ?? []} />

                        {/* 战报 */}
                        {battleStats && battleStats.totalBattles > 0 && (
                            <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-violet-900/40 bg-violet-950/20 px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <Trophy className="h-5 w-5 text-violet-300" />
                                    <div className="font-mono text-xs">
                                        <p className="text-violet-200">
                                            征战 <span className="font-bold">{battleStats.totalBattles}</span> 场 ·
                                            胜 <span className="font-bold text-amber-300">{battleStats.victories}</span> ·
                                            最高通关 <span className="font-bold text-violet-300">{battleStats.bestStages}</span>/8
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-slate-500">
                                            卡组越强，爬塔越顺；破绽卡多就去补错题
                                        </p>
                                    </div>
                                </div>
                                <Link href="/battle">
                                    <Button className="gap-1.5 bg-violet-600/90 text-xs text-white hover:bg-violet-500">
                                        再战一场
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Button>
                                </Link>
                            </section>
                        )}

                        {/* 引导 */}
                        {total > 0 && (
                            <section className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-cyan-900/40 bg-cyan-950/20 px-5 py-4 sm:flex-row">
                                <div className="flex items-center gap-3">
                                    <Sparkles className="h-5 w-5 text-cyan-400" />
                                    <div>
                                        <p className="text-sm font-medium text-cyan-100">
                                            想让卡组变强？去考一张卷子
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-slate-400">
                                            答对的知识点升品级，答错的会留下「破绽」等你补刀
                                        </p>
                                    </div>
                                </div>
                                <Link href="/diagnostic">
                                    <Button className="gap-1.5 bg-cyan-600/90 text-xs text-white hover:bg-cyan-500">
                                        进入考场
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Button>
                                </Link>
                            </section>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
