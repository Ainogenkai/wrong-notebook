"use client";

import { applyAction, battleScore, canPlayCard, getNextIntent, startMapBattle, upgradableCards, RESIST_MULTIPLIER } from "@/lib/card-battle";
import { MAP_TOTAL_NODES, NODE_TYPE_LABEL, availableNodes } from "@/lib/card-map";
import { getEventById } from "@/lib/card-events";
import { ARCHETYPES, ARCHETYPE_ORDER, WEAKNESS_MULTIPLIER } from "@/lib/card-effects";
import { TIER_META } from "@/lib/cards";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { BattleAction, BattleCard, BattleEnemy, BattleState, EnemyIntent } from "@/types/api";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Crown, FlaskConical, Heart, Map as MapIcon, RotateCcw, ScrollText, Shield, Skull, Swords, Target, Timer, TrendingUp, Trophy, Moon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EnemySprite } from "@/components/enemy-sprite";
import { CardMapView } from "@/components/card-map-view";

interface CardBattleViewProps {
    deck: BattleCard[];
    onExit: () => void;
}

interface Floater {
    id: number;
    text: string;
    enemyUid?: string;
    player: boolean;
    gold?: boolean;
}

const INTENT_ICONS: Record<string, LucideIcon> = {
    attack: Swords,
    special: Swords,
    defend: Shield,
    buff: TrendingUp,
    debuff: Skull,
    charge: Timer,
};

// 意图的机械效果（自明文案）：风味名之外的「这招到底干什么」
const INTENT_EFFECT: Record<EnemyIntent["kind"], (v?: number) => string> = {
    attack: (v) => `对你造成 ${v ?? 0} 点伤害`,
    special: (v) => `对你造成 ${v ?? 0} 点伤害（还可能触发它的特性）`,
    defend: (v) => `它获得 ${v ?? 0} 点护甲`,
    buff: (v) => `它的攻击 +${v ?? 0}（永久）`,
    debuff: (v) => `你下回合能量 -${v ?? 0}`,
    charge: () => "蓄力完成，下一击伤害 ×2",
};

// 意图的详细解释（InfoTip 悬浮用）
const INTENT_TIP: Record<EnemyIntent["kind"], string> = {
    attack: "直接攻击你。护盾可以抵挡。",
    special: "特殊攻击，部分怪物还会附加特性伤害（见它的面板描述）。",
    defend: "给自己叠护甲，你打的伤害会先被护甲吃掉。",
    buff: "强化自身，越拖越难打。",
    debuff: "抽走你下回合的部分能量——能量不够就出不了牌。",
    charge: "这一回合不出手，下一击伤害翻倍，注意留护盾。",
};

// 休整面板的三个固定选项（与引擎 TAKE_REST 的 kind 对应）
const REST_OPTIONS = [
    { kind: "heal", label: "小憩", desc: "回复 15 自信值" },
    { kind: "draw", label: "整理笔记", desc: "抽 3 张牌" },
    { kind: "shield", label: "布置防线", desc: "护盾 +6" },
] as const;

/** 对某怪有效的卡类型（排除其抗性），用于抗性提示 */
function weakAlternatives(enemy: BattleEnemy): string {
    const resisted = enemy.def.resist ?? [];
    const alts = ARCHETYPE_ORDER.filter((a) => !resisted.includes(a))
        .map((a) => ARCHETYPES[a].label)
        .slice(0, 3);
    return alts.join(" / ");
}

function makeSeed(): number {
    return Date.now() % 1000000;
}

function EnemyPanel({
    enemy,
    isTarget,
    floaters,
    shakeKey,
    onTarget,
}: {
    enemy: BattleEnemy;
    isTarget: boolean;
    floaters: Floater[];
    shakeKey: number;
    onTarget: () => void;
}) {
    const dead = enemy.hp <= 0;
    const intent = getNextIntent(enemy);
    const IntentIcon = INTENT_ICONS[intent.kind] ?? Swords;
    const charge = intent.kind === "charge";
    const resistLabels = enemy.def.resist?.map((a) => ARCHETYPES[a].label).join(" / ");

    return (
        <button
            type="button"
            disabled={dead}
            onClick={dead ? undefined : onTarget}
            className={cn(
                "relative w-56 shrink-0 rounded-xl border bg-slate-900/60 p-3 text-left transition-all duration-150",
                dead ? "border-slate-800/60 opacity-70" : "cursor-pointer border-slate-800 hover:border-slate-600",
                isTarget && "ring-2 ring-violet-400"
            )}
        >
            {floaters.map((f) => (
                <span
                    key={f.id}
                    className="wb-float-up pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 text-lg font-bold"
                    style={{
                        color: f.gold ? "rgb(252, 211, 77)" : "rgb(251, 113, 133)",
                        textShadow: "0 1px 4px rgba(0,0,0,.6)",
                    }}
                >
                    {f.text}
                </span>
            ))}
            <div
                key={shakeKey}
                className={cn(dead ? "grayscale" : undefined, !dead && shakeKey > 0 ? "wb-shake" : undefined)}
            >
                <div className="flex items-start gap-2.5">
                    <EnemySprite id={enemy.def.id} size={64} dead={dead} className="rounded-lg bg-slate-800/60" />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <p className="truncate text-xs font-bold text-slate-100">{enemy.def.name}</p>
                            {enemy.def.isBoss && <Crown className="h-3 w-3 shrink-0 text-amber-400" />}
                        </div>
                        <p className="mt-0.5 line-clamp-2 font-mono text-[10px] leading-tight text-slate-500">
                            {enemy.def.traitDesc}
                        </p>
                        <div className="mt-1.5">
                            <div className="mb-0.5 flex items-center justify-between font-mono text-[10px]">
                                <span className="text-slate-400">
                                    HP {enemy.hp}/{enemy.maxHp}
                                </span>
                                {enemy.def.isBoss && enemy.phase > 1 && (
                                    <span className="text-rose-300">阶段 {enemy.phase}</span>
                                )}
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-300"
                                    style={{ width: `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 护甲 / 灼烧 / 削弱 / 蓄力 */}
                <div className="mt-2 flex flex-wrap items-center gap-1">
                    {enemy.block > 0 && (
                        <span className="rounded border border-sky-500/40 bg-sky-950/30 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
                            <Shield className="mr-0.5 inline h-2.5 w-2.5" />
                            护甲 {enemy.block}
                        </span>
                    )}
                    {enemy.poisonedTurns > 0 && (
                        <span className="rounded border border-amber-500/40 bg-amber-950/30 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                            灼烧 {enemy.poisoned}/回合
                        </span>
                    )}
                    {enemy.attackDownTurns > 0 && (
                        <span className="rounded border border-emerald-500/40 bg-emerald-950/30 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                            攻击 -{enemy.attackDown}
                        </span>
                    )}
                    {enemy.charged && (
                        <span className="rounded border border-rose-500/40 bg-rose-950/30 px-1.5 py-0.5 font-mono text-[10px] text-rose-300">
                            蓄力中
                        </span>
                    )}
                    {enemy.attackUp > 0 && !enemy.charged && (
                        <span className="rounded border border-fuchsia-500/40 bg-fuchsia-950/30 px-1.5 py-0.5 font-mono text-[10px] text-fuchsia-300">
                            攻击 +{enemy.attackUp}
                        </span>
                    )}
                </div>

                {/* 下一个意图：风味名 · 机械效果（悬停看详情） */}
                {!dead && intent && (
                    <div className="mt-2">
                        <InfoTip
                            side="bottom"
                            tip={`${intent.text}——${INTENT_TIP[intent.kind]}`}
                        >
                            <div
                                className={cn(
                                    "flex items-center gap-1.5 rounded-md border px-2 py-1",
                                    charge
                                        ? "wb-pulse-danger border-rose-500/60 bg-rose-950/40"
                                        : "border-amber-500/30 bg-amber-950/20"
                                )}
                            >
                                <IntentIcon
                                    className={cn("h-3 w-3 shrink-0", charge ? "text-rose-300" : "text-amber-400")}
                                />
                                <span
                                    className={cn(
                                        "truncate font-mono text-[10px]",
                                        charge ? "font-bold text-rose-300" : "text-amber-200/90"
                                    )}
                                >
                                    {intent.text} · {INTENT_EFFECT[intent.kind](intent.value)}
                                </span>
                            </div>
                        </InfoTip>
                    </div>
                )}

                {/* 弱点：命中条件（悬停看详情） */}
                {enemy.def.chapterKeywords.length > 0 && (
                    <div className="mt-1.5">
                        <InfoTip
                            side="bottom"
                            tip={`弱点命中条件：你打出的卡，卡名或所属章节含这些词时，伤害 ×${WEAKNESS_MULTIPLIER}。`}
                        >
                            <span className="font-mono text-[10px] text-slate-500">
                                弱点 ×{WEAKNESS_MULTIPLIER}
                                <span className="text-slate-400">
                                    {" · "}
                                    {enemy.def.chapterKeywords.slice(0, 2).join(" / ")}
                                </span>
                            </span>
                        </InfoTip>
                    </div>
                )}

                {/* 抗性（悬停看详情） */}
                {resistLabels && (
                    <div className="mt-1.5">
                        <InfoTip
                            side="bottom"
                            tip={`「${resistLabels}」类卡打它只有 ${Math.round(RESIST_MULTIPLIER * 100)}% 伤害。改用「${weakAlternatives(enemy)}」更有效。`}
                        >
                            <span className="font-mono text-[10px] text-orange-400/90">
                                抗 · {resistLabels}
                            </span>
                        </InfoTip>
                    </div>
                )}

                {/* 弱点技：命中弱点时的额外奖励（悬停看详情） */}
                {enemy.def.exploit && (
                    <div className="mt-1.5">
                        <InfoTip
                            side="bottom"
                            tip={`触发条件：弱点命中（伤害 ×${WEAKNESS_MULTIPLIER}）时，额外获得这个奖励。`}
                        >
                            <span className="font-mono text-[10px] leading-snug text-violet-400/90">
                                命中弱点时 · {enemy.def.exploit.text}
                            </span>
                        </InfoTip>
                    </div>
                )}
            </div>

            {dead && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <span className="rounded-full bg-slate-950/85 px-3 py-1 font-mono text-[11px] text-slate-400 ring-1 ring-slate-700/80">
                        已击败
                    </span>
                </div>
            )}
        </button>
    );
}

export function CardBattleView({ deck, onExit }: CardBattleViewProps) {
    const [state, setState] = useState<BattleState>(() => {
        return startMapBattle(deck, makeSeed());
    });
    const [pendingUpgrade, setPendingUpgrade] = useState(false);
    const [targetUid, setTargetUid] = useState<string | null>(null);
    const [playingUid, setPlayingUid] = useState<string | null>(null);
    const [floaters, setFloaters] = useState<Floater[]>([]);
    const [hitKeys, setHitKeys] = useState<Record<string, number>>({});
    const [playerHitKey, setPlayerHitKey] = useState(0);
    const reported = useRef(false);
    const floaterId = useRef(0);
    const stateRef = useRef(state);
    const timeoutsRef = useRef<number[]>([]);

    const alive = state.enemies.filter((e) => e.hp > 0);
    const activeTargetUid =
        targetUid && alive.some((e) => e.uid === targetUid) ? targetUid : alive[0]?.uid;
    const upgradable = upgradableCards(state);
    const ended = state.phase === "victory" || state.phase === "defeat";
    const stagesCleared = state.map
        ? state.nodesCleared
        : state.phase === "victory"
          ? state.stages.length
          : state.currentStage;
    const totalStages = state.map ? MAP_TOTAL_NODES : state.stages.length;
    const stageEnemyCount = state.stages[state.currentStage]?.length ?? 0;
    const mapPath = state.path ?? [];
    const mapAvailable = state.map
        ? availableNodes({ seed: state.mapSeed ?? 0, nodes: state.map }, mapPath)
        : [];
    const pendingEvent =
        state.pendingPanel === "event" ? getEventById(state.pendingEventId ?? 0) : undefined;
    const rewardPanel: "event" | "rest" | "node" | "reward" =
        state.pendingPanel === "event"
            ? "event"
            : state.pendingPanel === "rest"
              ? "rest"
              : state.pendingPanel === "node"
                ? "node"
                : "reward";
    const rewardPanelMeta: { icon: LucideIcon; title: string } =
        rewardPanel === "event"
            ? { icon: ScrollText, title: pendingEvent ? `事件：${pendingEvent.name}` : "事件" }
            : rewardPanel === "rest"
              ? { icon: Moon, title: "休整" }
              : rewardPanel === "node"
                ? { icon: MapIcon, title: "选择下一节点" }
                : {
                      icon: TrendingUp,
                      title:
                          state.pendingReward?.length === 1
                              ? `奖励：${state.pendingReward[0].label}`
                              : "奖励：三选一",
                  };
    const showRewardSection =
        state.phase === "reward" &&
        (state.pendingPanel != null ||
            (!state.rewardTaken && (state.pendingReward?.length ?? 0) > 0));

    const pushFloaters = (fs: Floater[]) => {
        if (fs.length === 0) return;
        setFloaters((cur) => [...cur, ...fs]);
        const ids = new Set(fs.map((f) => f.id));
        const t = window.setTimeout(() => {
            setFloaters((cur) => cur.filter((f) => !ids.has(f.id)));
        }, 900);
        timeoutsRef.current.push(t);
    };

    useEffect(() => {
        const pending = timeoutsRef.current;
        return () => pending.forEach((t) => clearTimeout(t));
    }, []);

    // 状态 diff（出牌 / 结束回合 / 奖励 / 重开）：伤害飘字 / 弱点金飘 / 受击抖动
    const spawnFloaters = (prev: BattleState, next: BattleState) => {
        const fs: Floater[] = [];
        const push = (f: Omit<Floater, "id">) => {
            floaterId.current += 1;
            fs.push({ ...f, id: floaterId.current });
        };

        const hitUids = new Set<string>();
        const newLines = next.log.slice(prev.log.length);
        for (const e of next.enemies) {
            const before = prev.enemies.find((b) => b.uid === e.uid);
            if (before && before.hp > e.hp) {
                const multiNote = newLines
                    .find((l) => l.includes(`对「${e.def.name}」`) && l.includes("连击"))
                    ?.match(/(\d+) 连击 ×\d+/)?.[0];
                push({ text: multiNote ? `-${before.hp - e.hp} ${multiNote}` : `-${before.hp - e.hp}`, enemyUid: e.uid, player: false });
                hitUids.add(e.uid);
            }
        }

        let playerHit = false;
        if (next.player.hp < prev.player.hp) {
            push({ text: `-${prev.player.hp - next.player.hp}`, player: true });
            playerHit = true;
        } else if (next.player.hp > prev.player.hp) {
            push({ text: `+${next.player.hp - prev.player.hp}`, player: true });
        }

        const goldUids = new Set<string>();
        for (const line of next.log.slice(prev.log.length)) {
            if (!line.includes("弱点命中")) continue;
            const name = line.match(/对「([^」]+)」/)?.[1];
            const e = next.enemies.find((x) => x.def.name === name);
            if (e && !goldUids.has(e.uid)) {
                goldUids.add(e.uid);
                push({ text: "弱点 ×1.5！", enemyUid: e.uid, player: false, gold: true });
            }
        }

        if (fs.length > 0) pushFloaters(fs);
        if (hitUids.size > 0) {
            setHitKeys((k) => {
                const cur = { ...k };
                for (const uid of hitUids) cur[uid] = (cur[uid] ?? 0) + 1;
                return cur;
            });
        }
        if (playerHit) setPlayerHitKey((k) => k + 1);
    };

    const dispatch = (action: BattleAction) => {
        const prev = stateRef.current;
        const next = applyAction(prev, action);
        stateRef.current = next;
        spawnFloaters(prev, next);
        setState(next);
    };

    const handlePlay = (card: BattleCard) => {
        if (playingUid) return;
        setPlayingUid(card.uid);
        const t = window.setTimeout(() => {
            setPlayingUid(null);
            dispatch({ type: "PLAY_CARD", cardUid: card.uid, targetUid: activeTargetUid });
        }, 250);
        timeoutsRef.current.push(t);
    };

    const restart = () => {
        const fresh = startMapBattle(deck, makeSeed());
        stateRef.current = fresh;
        reported.current = false;
        floaterId.current = 0;
        setPendingUpgrade(false);
        setTargetUid(null);
        setPlayingUid(null);
        setFloaters([]);
        setHitKeys({});
        setPlayerHitKey(0);
        setState(fresh);
    };

    useEffect(() => {
        if (ended && !reported.current) {
            reported.current = true;
            const payload = {
                subject: "mixed",
                result: state.phase === "victory" ? "victory" : "defeat",
                stagesCleared: stagesCleared,
                totalStages: totalStages,
                score: battleScore(state),
                deckJson: JSON.stringify(state.deck.map((d) => d.name)),
            };
            apiClient.post("/api/cards/battle", payload).catch(() => {});
        }
    }, [ended, state, stagesCleared, totalStages]);

    const enemyFloaters = (uid: string) => floaters.filter((f) => f.enemyUid === uid);
    const playerFloaters = floaters.filter((f) => f.player);

    return (
        <div
            className={cn(
                "flex min-h-[calc(100vh-190px)] flex-col justify-between gap-4",
                state.phase === "victory" && "wb-victory",
                state.phase === "defeat" && "wb-defeat"
            )}
        >
            {/* 敌人区 */}
            <section className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/70 to-slate-950/40">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/70 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <BackButton fallbackUrl="/cards" className="text-slate-400 hover:text-cyan-300" />
                        <h2 className="font-mono text-sm font-bold tracking-wide text-slate-200">战斗</h2>
                        {state.stages[state.currentStage]?.some((e) => e.isBoss) && (
                            <span className="flex items-center gap-1 rounded-full border border-rose-500/50 bg-rose-950/50 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-300">
                                <Crown className="h-3 w-3" />
                                BOSS
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                        <Timer className="h-3.5 w-3.5 text-cyan-400" />
                        <span>
                            {state.map
                                ? `节点 ${mapPath.length}/${MAP_TOTAL_NODES}`
                                : `第 ${state.currentStage + 1} 层 / ${state.stages.length} 层`}
                        </span>
                        <span className="flex items-center gap-1" title={`本层 ${stageEnemyCount} 只敌人`}>
                            {Array.from({ length: stageEnemyCount }, (_, i) => (
                                <span key={i} className="h-1.5 w-1.5 rounded-full bg-rose-400/80" />
                            ))}
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 px-4 py-4">
                    {state.enemies.map((enemy) => (
                        <EnemyPanel
                            key={enemy.uid}
                            enemy={enemy}
                            isTarget={activeTargetUid === enemy.uid}
                            floaters={enemyFloaters(enemy.uid)}
                            shakeKey={hitKeys[enemy.uid] ?? 0}
                            onTarget={() => setTargetUid(enemy.uid)}
                        />
                    ))}
                </div>
            </section>

            {/* 战报 */}
            {ended ? (
                <section
                    className={cn(
                        "wb-pop rounded-2xl border px-5 py-8 text-center",
                        state.phase === "victory"
                            ? "border-amber-500/40 bg-gradient-to-b from-amber-950/30 to-slate-950/60"
                            : "border-rose-900/60 bg-gradient-to-b from-rose-950/30 to-slate-950/60"
                    )}
                >
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-900/80 shadow-[0_0_18px_rgba(245,158,11,0.2)]">
                        {state.phase === "victory" ? (
                            <Trophy className="h-6 w-6 text-amber-400" />
                        ) : (
                            <Skull className="h-6 w-6 text-rose-400" />
                        )}
                    </div>
                    <h3 className={`text-2xl font-extrabold ${state.phase === "victory" ? "text-amber-300" : "text-rose-300"}`}>
                        {state.phase === "victory" ? "胜利" : "战败"}
                    </h3>
                    <p className="mt-1 font-mono text-xs text-slate-400">
                        {state.phase === "victory"
                            ? state.map
                                ? "13 个节点全部走完，路线远征成功！"
                                : "全部敌人被击败，爬塔成功！"
                            : "你被击倒了……下次换一套卡组"}
                    </p>

                    <div className="mx-auto mt-5 grid max-w-md grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
                        <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                            <p className="text-slate-500">得分</p>
                            <p className="mt-0.5 text-base font-bold text-cyan-300">{battleScore(state)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                            <p className="text-slate-500">{state.map ? "通过节点" : "通过层数"}</p>
                            <p className="mt-0.5 text-base font-bold text-slate-200">
                                {stagesCleared}/{totalStages}
                            </p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                            <p className="text-slate-500">打出卡牌</p>
                            <p className="mt-0.5 text-base font-bold text-slate-200">{state.cardsPlayed}</p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                            <p className="text-slate-500">总伤害</p>
                            <p className="mt-0.5 text-base font-bold text-slate-200">{state.damageDealt}</p>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <Button
                            className="gap-1.5 bg-cyan-600/90 text-xs text-white hover:bg-cyan-500"
                            onClick={restart}
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            再来一场
                        </Button>
                        <Button
                            asChild
                            variant="outline"
                            className="gap-1.5 border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                        >
                            <Link href="/cards">回卡组复习弱点卡</Link>
                        </Button>
                        <Button variant="outline" className="gap-1.5 border-slate-700 text-xs text-slate-300 hover:bg-slate-800" onClick={onExit}>
                            回卡组
                        </Button>
                    </div>
                </section>
            ) : (
                <>
                    {/* 奖励阶段 */}
                    {showRewardSection && (
                        <section className="wb-pop rounded-2xl border border-cyan-900/40 bg-cyan-950/20 px-4 py-4">
                            <div className="mb-3 flex items-center gap-2">
                                <rewardPanelMeta.icon className="h-4 w-4 text-cyan-400" />
                                <h3 className="font-mono text-sm font-bold text-cyan-100">{rewardPanelMeta.title}</h3>
                            </div>

                            {rewardPanel === "event" ? (
                                <div className="wb-pop space-y-2.5">
                                    {pendingEvent ? (
                                        <>
                                            <p className="text-xs leading-relaxed text-slate-300">{pendingEvent.desc}</p>
                                            <div className="grid gap-2 sm:grid-cols-3">
                                                {pendingEvent.choices.map((c) => (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => dispatch({ type: "TAKE_EVENT", choice: c.id })}
                                                        className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 px-3 py-3 text-left transition-colors hover:border-cyan-400/60 hover:bg-cyan-900/40"
                                                    >
                                                        <p className="text-xs font-semibold text-cyan-100">{c.label}</p>
                                                        <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{c.desc}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <p className="font-mono text-[11px] text-slate-500">事件已结算，选择下一节点</p>
                                    )}
                                </div>
                            ) : rewardPanel === "rest" ? (
                                <div className="wb-pop grid gap-2 sm:grid-cols-3">
                                    {REST_OPTIONS.map((o) => (
                                        <button
                                            key={o.kind}
                                            type="button"
                                            onClick={() => dispatch({ type: "TAKE_REST", kind: o.kind })}
                                            className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 px-3 py-3 text-left transition-colors hover:border-cyan-400/60 hover:bg-cyan-900/40"
                                        >
                                            <p className="text-xs font-semibold text-cyan-100">{o.label}</p>
                                            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{o.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            ) : rewardPanel === "node" ? (
                                <div className="wb-pop space-y-2.5">
                                    <CardMapView
                                        nodes={state.map ?? []}
                                        path={mapPath}
                                        available={mapAvailable}
                                        onChoose={(n) => dispatch({ type: "CHOOSE_NODE", nodeId: n.id })}
                                        active
                                    />
                                    {mapAvailable.length > 0 && (
                                        <div className="grid gap-1.5 sm:grid-cols-3">
                                            {mapAvailable.map((n) => (
                                                <button
                                                    key={n.id}
                                                    type="button"
                                                    onClick={() => dispatch({ type: "CHOOSE_NODE", nodeId: n.id })}
                                                    className="flex w-full items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-left transition-colors hover:border-cyan-500/50"
                                                >
                                                    <span className="text-xs font-semibold text-slate-100">
                                                        第 {n.row + 1} 行 · {NODE_TYPE_LABEL[n.type]}
                                                    </span>
                                                    <span className="ml-auto font-mono text-[10px] text-slate-500">选择</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : pendingUpgrade ? (
                                <div>
                                    {upgradable.length === 0 ? (
                                        <p className="font-mono text-[11px] text-slate-500">没有可强化的卡了</p>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {upgradable.map((c) => {
                                                const meta = TIER_META[c.tier];
                                                return (
                                                    <button
                                                        key={c.uid}
                                                        type="button"
                                                        onClick={() => {
                                                            dispatch({ type: "UPGRADE_CARD", cardUid: c.uid });
                                                            setPendingUpgrade(false);
                                                        }}
                                                        className="flex w-full items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-left transition-colors hover:border-cyan-500/50"
                                                    >
                                                        <span className="text-xs font-semibold text-slate-100">{c.name}</span>
                                                        <span
                                                            className="rounded-full border px-1.5 py-0.5 font-mono text-[9px]"
                                                            style={{ borderColor: `${meta.color}66`, color: meta.color }}
                                                        >
                                                            {meta.label}
                                                        </span>
                                                        <span className="ml-auto font-mono text-[10px] text-slate-500">
                                                            点击强化
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-[11px] text-slate-400"
                                                onClick={() => setPendingUpgrade(false)}
                                            >
                                                重新选择
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="grid gap-2 sm:grid-cols-3">
                                    {(state.pendingReward ?? []).map((opt) => {
                                        const disabled = opt.kind === "upgrade" && upgradable.length === 0;
                                        return (
                                            <button
                                                key={opt.kind}
                                                type="button"
                                                disabled={disabled}
                                                title={disabled ? "没有可强化的卡" : undefined}
                                                onClick={() => {
                                                    if (opt.kind === "upgrade") {
                                                        setPendingUpgrade(true);
                                                    } else {
                                                        dispatch({ type: "TAKE_REWARD", reward: opt.kind });
                                                    }
                                                }}
                                                className={cn(
                                                    "rounded-xl border px-3 py-3 text-left transition-colors",
                                                    disabled
                                                        ? "cursor-not-allowed border-slate-800 bg-slate-900/40 opacity-50"
                                                        : "border-cyan-500/30 bg-cyan-950/30 hover:border-cyan-400/60 hover:bg-cyan-900/40"
                                                )}
                                            >
                                                <p className="text-xs font-semibold text-cyan-100">{opt.label}</p>
                                                <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{opt.desc}</p>
                                                {disabled && (
                                                    <p className="mt-1 font-mono text-[10px] text-slate-500">无可强化卡</p>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    )}

                    {/* 战斗日志 */}
                    <section className="rounded-2xl border border-slate-800/80 bg-slate-950/50 px-4 py-3">
                        <div className="mb-2 flex items-center justify-between">
                            <h3 className="font-mono text-[11px] font-bold tracking-wider text-slate-400">战斗日志</h3>
                            <span className="font-mono text-[10px] text-slate-600">
                                抽牌堆 {state.drawPile.length} · 弃牌堆 {state.discardPile.length}
                            </span>
                        </div>
                        <div className="space-y-1">
                            {state.log.slice(-6).map((line, i) => (
                                <p
                                    key={`${i}-${line}`}
                                    className={`font-mono text-[11px] leading-relaxed ${
                                        i === 5 ? "text-cyan-200" : "text-slate-400"
                                    }`}
                                >
                                    <span className="mr-1.5 text-slate-600">›</span>
                                    {line}
                                </p>
                            ))}
                        </div>
                    </section>

                    {/* 玩家区 */}
                    <section className="sticky bottom-3 rounded-2xl border border-slate-800/80 bg-[#0c1022]/95 p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] backdrop-blur-md">
                        <div key={playerHitKey} className={cn("flex items-center justify-between gap-3", playerHitKey > 0 && "wb-shake")}>
                            <div className="relative flex items-center gap-1.5 font-mono text-[11px]">
                                {playerFloaters.map((f) => (
                                    <span
                                        key={f.id}
                                        className="wb-float-up pointer-events-none absolute -top-6 left-0 text-lg font-bold"
                                        style={{
                                            color: f.text.startsWith("+") ? "rgb(52, 211, 153)" : "rgb(251, 113, 133)",
                                            textShadow: "0 1px 4px rgba(0,0,0,.6)",
                                        }}
                                    >
                                        {f.text}
                                    </span>
                                ))}
                                <Heart className="h-3.5 w-3.5 text-rose-400" />
                                <span className="text-slate-400">自信值</span>
                                <span className="font-bold text-rose-300">
                                    {state.player.hp}/{state.player.maxHp}
                                </span>
                            </div>
                            <div className="h-2.5 max-w-56 flex-1 overflow-hidden rounded-full bg-white/5">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-300"
                                    style={{ width: `${(state.player.hp / state.player.maxHp) * 100}%` }}
                                />
                            </div>
                            {state.player.block > 0 && (
                                <div className="flex items-center gap-1 font-mono text-[11px] text-sky-300">
                                    <Shield className="h-3.5 w-3.5" />
                                    {state.player.block}
                                </div>
                            )}
                        </div>

                        {/* 能量槽 */}
                        <div className="mt-3 flex items-center gap-1.5">
                            <span className="font-mono text-[10px] tracking-wider text-slate-500">能量</span>
                            {Array.from({ length: state.player.maxEnergy }, (_, i) => (
                                <span
                                    key={i}
                                    className={`h-2.5 w-2.5 rounded-full ${
                                        i < state.player.energy
                                            ? "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]"
                                            : "bg-slate-700"
                                    }`}
                                />
                            ))}
                            {state.player.energy > state.player.maxEnergy && (
                                <span className="font-mono text-[10px] text-cyan-300">
                                    +{state.player.energy - state.player.maxEnergy}
                                </span>
                            )}
                        </div>

                        {/* 手牌 */}
                        <div className="mt-3">
                            {state.phase === "player" && alive.length > 1 && (
                                <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
                                    <Target className="h-3 w-3 text-violet-400" />
                                    本层多敌人：点击敌人面板选择目标
                                </p>
                            )}
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {state.hand.length === 0 && (
                                    <p className="py-3 font-mono text-[11px] text-slate-500">
                                        手牌为空，点「结束回合」抽牌
                                    </p>
                                )}
                                {state.hand.map((card, i) => {
                                    const meta = TIER_META[card.tier];
                                    const playable = canPlayCard(state, card);
                                    const isPlaying = playingUid === card.uid;
                                    return (
                                        <button
                                            key={`${state.turn}-${card.uid}`}
                                            type="button"
                                            data-hand-card={card.name}
                                            disabled={!playable || !!playingUid}
                                            title={playable ? card.effect.description : "能量不足"}
                                            onClick={() => handlePlay(card)}
                                            className={cn(
                                                "relative w-36 shrink-0 rounded-xl border bg-gradient-to-b from-slate-900 to-slate-950 p-2.5 text-left transition-all duration-150",
                                                isPlaying
                                                    ? "wb-card-play"
                                                    : "wb-deal-in",
                                                playable
                                                    ? "hover:-translate-y-1 hover:brightness-110"
                                                    : "cursor-not-allowed opacity-40 grayscale"
                                            )}
                                            style={{
                                                borderColor: `${meta.color}66`,
                                                boxShadow: playable ? `inset 0 1px 0 ${meta.color}26` : undefined,
                                                animationDelay: isPlaying ? undefined : `${i * 55}ms`,
                                            }}
                                        >
                                            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500/90 font-mono text-[10px] font-bold text-[#070913]">
                                                {card.effect.cost}
                                            </span>
                                            <p className="pr-5 text-xs font-bold text-slate-100">{card.name}</p>
                                            <p className="mt-0.5 font-mono text-[9px]" style={{ color: meta.color }}>
                                                {card.tierLabel}
                                            </p>
                                            <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate-400">
                                                {card.effect.archetypeLabel}：{card.effect.description}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 结束回合 */}
                        {state.phase === "player" && (
                            <Button
                                className="mt-3 h-9 w-full bg-cyan-600/90 text-xs text-white hover:bg-cyan-500"
                                onClick={() => dispatch({ type: "END_TURN" })}
                            >
                                <FlaskConical className="h-3.5 w-3.5" />
                                结束回合
                            </Button>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
