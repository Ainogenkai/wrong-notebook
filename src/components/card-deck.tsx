"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Swords, Target, Lock, ArrowRight, ArrowUpRight } from "lucide-react";
import type { CardTier, DeckCard } from "@/types/api";
import { TIER_META, TIER_ORDER, formatCardPath } from "@/lib/cards";
import { KnowledgeCard } from "@/components/knowledge-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface CardDeckProps {
    cards: DeckCard[];
    onInspect?: (card: DeckCard) => void;
}

const SUBJECT_FILTERS = [
    { key: "all", label: "全部" },
    { key: "physics", label: "物理" },
    { key: "math", label: "数学" },
] as const;

export function CardDeck({ cards, onInspect }: CardDeckProps) {
    const [subjectFilter, setSubjectFilter] = useState<string>("all");
    const [tierFilter, setTierFilter] = useState<CardTier | "all">("all");
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<DeckCard | null>(null);

    const filtered = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        return cards.filter((card) => {
            if (subjectFilter !== "all" && card.subject !== subjectFilter) return false;
            if (tierFilter !== "all" && card.tier !== tierFilter) return false;
            if (keyword) {
                const haystack = `${card.name} ${card.path.join(" ")}`.toLowerCase();
                if (!haystack.includes(keyword)) return false;
            }
            return true;
        });
    }, [cards, subjectFilter, tierFilter, query]);

    const handleSelect = (card: DeckCard) => {
        setSelected(card);
        onInspect?.(card);
    };

    return (
        <div className="space-y-5">
            {/* 筛选栏 */}
            <div className="flex flex-col gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-1.5">
                    {SUBJECT_FILTERS.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setSubjectFilter(item.key)}
                            className={`rounded-lg px-3 py-1.5 font-mono text-xs transition-colors ${
                                subjectFilter === item.key
                                    ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/40"
                                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-1 flex-wrap items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setTierFilter("all")}
                        className={`rounded-lg px-3 py-1.5 font-mono text-xs transition-colors ${
                            tierFilter === "all"
                                ? "bg-white/10 text-slate-100 ring-1 ring-white/20"
                                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        }`}
                    >
                        全部品级
                    </button>
                    {TIER_ORDER.map((tier) => {
                        const meta = TIER_META[tier];
                        const active = tierFilter === tier;
                        return (
                            <button
                                key={tier}
                                type="button"
                                onClick={() => setTierFilter(active ? "all" : tier)}
                                className="rounded-lg px-3 py-1.5 font-mono text-xs transition-all"
                                style={{
                                    color: active ? meta.color : `${meta.color}99`,
                                    backgroundColor: active ? `${meta.color}1f` : "transparent",
                                    boxShadow: active ? `inset 0 0 0 1px ${meta.color}66` : "none",
                                }}
                            >
                                {meta.label}
                            </button>
                        );
                    })}
                </div>

                <div className="relative sm:w-56">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="搜索术语 / 章节"
                        className="h-8 border-slate-800 bg-slate-950/60 pl-8 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus-visible:ring-cyan-500/40"
                    />
                </div>
            </div>

            {/* 卡墙 */}
            {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 py-16 text-center">
                    <p className="font-mono text-sm text-slate-400">卡组空空如也</p>
                    <p className="mt-1 text-xs text-slate-600">去做几道题，卡牌会自动出现在这里</p>
                    <Link href="/diagnostic">
                        <Button className="mt-4 gap-1.5 bg-cyan-600/90 text-xs hover:bg-cyan-500">
                            去考试
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {filtered.map((card) => (
                        <KnowledgeCard key={card.id} card={card} onSelect={handleSelect} />
                    ))}
                </div>
            )}

            {/* 详情弹窗 */}
            <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
                <DialogContent className="max-w-2xl border-slate-800 bg-slate-950/95 text-slate-100">
                    {selected && <CardDetail card={selected} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function CardDetail({ card }: { card: DeckCard }) {
    const meta = TIER_META[card.tier];
    const path = formatCardPath(card.path);
    const accuracy = card.totalTested > 0 ? Math.round((card.correctCount / card.totalTested) * 100) : 0;

    return (
        <>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-serif text-xl">
                    <span style={{ color: meta.color }}>{card.name}</span>
                    <span
                        className="rounded-full border px-2 py-0.5 font-mono text-[10px]"
                        style={{ borderColor: `${meta.color}66`, color: meta.color }}
                    >
                        {meta.label}
                    </span>
                </DialogTitle>
                <DialogDescription className="font-mono text-xs text-slate-500">
                    {card.subjectLabel}
                    {path ? ` › ${path}` : ""}
                </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
                <div className="mx-auto w-full max-w-[180px]">
                    <KnowledgeCard card={card} className="pointer-events-none" />
                </div>

                <div className="space-y-4">
                    <div>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                            <span className="text-slate-400">掌握度</span>
                            <span className="font-mono" style={{ color: meta.color }}>
                                {Math.round(card.probability * 100)}%
                            </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                                className="h-full rounded-full transition-all"
                                style={{
                                    width: `${Math.round(card.probability * 100)}%`,
                                    background: `linear-gradient(90deg, ${meta.color}55, ${meta.color})`,
                                }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                        <StatBlock label="出战" value={`${card.totalTested}`} icon={<Swords className="h-3 w-3" />} />
                        <StatBlock label="胜场" value={`${card.correctCount}`} accent={meta.color} />
                        <StatBlock label="败场" value={`${card.errorCount}`} accent={card.errorCount > 0 ? "#f87171" : undefined} />
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                        <p className="text-[11px] leading-relaxed text-slate-400">
                            <span className="font-mono text-slate-500">CARD FLAVOR · </span>
                            {card.flavor}
                        </p>
                    </div>

                    <div
                        className="rounded-lg border p-3"
                        style={{
                            borderColor: `${meta.color}44`,
                            backgroundColor: `${meta.color}0d`,
                        }}
                    >
                        <div className="mb-1 flex items-center justify-between">
                            <p className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                                <Swords className="h-3 w-3" style={{ color: meta.color }} />
                                战斗效果 · {card.effect.archetypeLabel}
                                <span
                                    className="ml-2 rounded px-1.5 py-0.5 font-mono text-[10px]"
                                    style={{
                                        backgroundColor: `${meta.color}26`,
                                        color: meta.color,
                                    }}
                                >
                                    {card.effect.cost} 能量
                                </span>
                            </p>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-300">{card.effect.description}</p>
                    </div>

                    {card.recentErrorIds.length > 0 && (
                        <div className="space-y-1.5">
                            <p className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                                <Target className="h-3 w-3" />
                                最近错题
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {card.recentErrorIds.map((id) => (
                                    <Link
                                        key={id}
                                        href={`/error-items/${id}`}
                                        className="rounded-md border border-slate-800 px-2 py-1 font-mono text-[11px] text-slate-400 transition-colors hover:border-cyan-600/50 hover:text-cyan-300"
                                    >
                                        错题 {id.slice(-6)}
                                        <ArrowUpRight className="ml-1 inline h-2.5 w-2.5 opacity-60" />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    <p className="font-mono text-[11px] text-slate-600">
                        正确率 {accuracy}% · 最近练习 {card.lastPracticedAt ? new Date(card.lastPracticedAt).toLocaleDateString("zh-CN") : "—"}
                    </p>
                </div>
            </div>
        </>
    );
}

function StatBlock({
    label,
    value,
    accent,
    icon,
}: {
    label: string;
    value: string;
    accent?: string;
    icon?: React.ReactNode;
}) {
    return (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 py-2">
            <p className="flex items-center justify-center gap-1 font-mono text-[10px] text-slate-500">
                {icon}
                {label}
            </p>
            <p className="mt-0.5 font-mono text-lg font-bold" style={{ color: accent || "#e2e8f0" }}>
                {value}
            </p>
        </div>
    );
}
