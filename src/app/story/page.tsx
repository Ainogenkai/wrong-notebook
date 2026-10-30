"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BackButton } from "@/components/ui/back-button";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { apiClient } from "@/lib/api-client";
import {
    Sparkles,
    Loader2,
    Send,
    Flame,
    ShieldAlert,
    Zap,
    Trophy,
    RotateCcw,
    Layers,
    BookOpen,
    Terminal,
    Radio,
    Compass,
    HelpCircle,
    Activity,
    Trash2
} from "lucide-react";
import Link from "next/link";

interface StoryHud {
    level: number;
    points: number;
    stage: number;
    stageTitle: string;
    streak: number;
    eventCount: number;
    totalPractice: number;
    weakTags: string[];
    unmasteredErrors: number;
    hasCurrentEvent: boolean;
}

interface ChatMessage {
    id: string;
    role: "system" | "user";
    type: "broadcast" | "event" | "question" | "answer" | "settle" | "dialogue";
    content: string;
    questionDataJson?: string | null;
    createdAt?: string;
}

interface ActiveExercise {
    tag: string;
    questionText: string;
    svgCode?: string;
    options?: string[];
    correctAnswer: string;
    explanation?: string;
}

interface CurrentEvent {
    eventType: string;
    dialogue: string;
    exercise?: ActiveExercise | null;
}

export default function StoryTerminalPage() {
    const [loading, setLoading] = useState(true);
    const [eventLoading, setEventLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [hud, setHud] = useState<StoryHud | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [currentEvent, setCurrentEvent] = useState<CurrentEvent | null>(null);

    // 宿主输入框
    const [inputText, setInputText] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, currentEvent, eventLoading, submitting]);

    // 读取初始状态
    const fetchState = async () => {
        try {
            setLoading(true);
            const res = await apiClient.get<{
                hud: StoryHud;
                summary?: string;
                currentEvent?: CurrentEvent | null;
                messages: ChatMessage[];
            }>("/api/story/state");

            setHud(res.hud);
            setMessages(res.messages || []);
            setCurrentEvent(res.currentEvent || null);
        } catch (err: any) {
            console.error("Failed to fetch story state:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchState();
    }, []);

    // 清空历史对话与重置当前事件
    const handleResetStory = async () => {
        if (!confirm("确定要清空当前的剧情对话并重新开局吗？\n（你的学神积分 SP、等级与现实做题战力将完整保留）")) {
            return;
        }
        try {
            setLoading(true);
            await apiClient.delete("/api/story/state");
            setMessages([]);
            setCurrentEvent(null);
            await fetchState();
        } catch (err: any) {
            alert(err?.message || "重置剧情失败");
            setLoading(false);
        }
    };

    // 触发下一幕校园剧情 (支持强制覆盖)
    const handleTriggerEvent = async (force: boolean = false) => {
        if (eventLoading) return;
        setEventLoading(true);

        try {
            const res = await apiClient.post<{
                success: boolean;
                event: CurrentEvent;
                alreadyActive?: boolean;
            }>("/api/story/event", { force });

            if (res.success && res.event) {
                setCurrentEvent(res.event);
                if (!res.alreadyActive) {
                    setMessages(prev => [
                        ...prev,
                        {
                            id: "evt_" + Date.now(),
                            role: "system",
                            type: res.event.exercise ? "event" : "broadcast",
                            content: res.event.dialogue,
                            questionDataJson: JSON.stringify(res.event),
                        }
                    ]);
                }
                if (hud) {
                    setHud({ ...hud, hasCurrentEvent: true });
                }
            }
        } catch (err: any) {
            console.error("Failed to generate event:", err);
            alert(err?.message || "推进剧情事件失败，请稍后重试");
        } finally {
            setEventLoading(false);
        }
    };

    // 宿主发送行动/作答/请教系统
    const handleSendAction = async (actionText: string, isOptionSelection: boolean = false) => {
        const text = actionText.trim();
        if (!text || submitting) return;
        setInputText("");
        setSubmitting(true);

        // 1. 立即乐观将用户发送的消息呈现在气泡流右侧
        setMessages(prev => [
            ...prev,
            {
                id: "user_" + Date.now(),
                role: "user",
                type: isOptionSelection ? "answer" : "dialogue",
                content: isOptionSelection ? `【推演抉择】: 选项 ${text}` : text,
            }
        ]);

        try {
            const res = await apiClient.post<{
                success: boolean;
                isCorrect?: boolean;
                pointsDelta?: number;
                settleDialogue?: string;
                reply?: string;
                keptActive?: boolean;
                hud?: StoryHud;
            }>("/api/story/interact", { action: text, isOptionSelection });

            if (res.success) {
                if (res.settleDialogue) {
                    // 分支 1: 正式答题结算
                    setMessages(prev => [
                        ...prev,
                        {
                            id: "settle_" + Date.now(),
                            role: "system",
                            type: "settle",
                            content: res.settleDialogue!,
                            questionDataJson: JSON.stringify({
                                isCorrect: res.isCorrect,
                                pointsDelta: res.pointsDelta,
                            }),
                        }
                    ]);
                    setCurrentEvent(null);
                    if (res.hud) {
                        setHud(prev => ({ ...prev, ...res.hud!, hasCurrentEvent: false }));
                    }
                } else if (res.reply) {
                    // 分支 2: 向系统请教 / 自由推导对话（题目依然挂起）
                    setMessages(prev => [
                        ...prev,
                        {
                            id: "reply_" + Date.now(),
                            role: "system",
                            type: "dialogue",
                            content: res.reply!,
                        }
                    ]);
                }
            }
        } catch (err: any) {
            console.error("Interact error:", err);
            alert(err?.message || "与系统通讯受阻，请重试");
        } finally {
            setSubmitting(false);
        }
    };

    const formatSvg = (svg?: string) => {
        if (!svg) return "";
        let code = svg.trim();
        if (code.startsWith("&lt;")) {
            code = code
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&amp;/g, "&");
        }
        return code;
    };

    return (
        <div className="min-h-screen bg-[#070913] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
            {/* 顶栏 HUD：赛博学霸全息终端 */}
            <header className="border-b border-cyan-900/40 bg-[#0c1022]/90 backdrop-blur-md sticky top-0 z-30 px-4 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
                <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
                    {/* 左侧：系统标识 */}
                    <div className="flex items-center gap-3">
                        <BackButton fallbackUrl="/" className="text-slate-400 hover:text-cyan-300" />
                        <div className="flex items-center gap-2.5">
                            <div className="relative p-2 rounded-lg bg-cyan-950/70 border border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                                <Radio className="h-4 w-4 text-cyan-400 animate-pulse" />
                                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                                </span>
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-extrabold tracking-wider text-cyan-100 flex items-center gap-1.5 font-mono">
                                        天玑 · 学霸推演系统
                                    </span>
                                    <Badge className="bg-cyan-950 text-cyan-300 border-cyan-500/40 font-mono text-[11px] px-1.5 py-0">
                                        Lv.{hud?.level || 1} 宿主
                                    </Badge>
                                </div>
                                <p className="text-[11px] font-mono text-cyan-400/80 tracking-tight flex items-center gap-1 mt-0.5">
                                    <Activity className="h-3 w-3" />
                                    <span>{hud?.stageTitle || "第一卷：普通班后排的逆袭者"}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 右侧：战力面板与操作 */}
                    <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono">
                        <div className="flex items-center gap-1.5 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                            <Zap className="h-3.5 w-3.5 text-amber-400" />
                            <span className="text-slate-400 text-[11px]">积分:</span>
                            <span className="text-amber-300 font-bold">{hud?.points || 0} SP</span>
                        </div>

                        <div className="flex items-center gap-1.5 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.15)]">
                            <Flame className="h-3.5 w-3.5 text-rose-400" />
                            <span className="text-slate-400 text-[11px]">连对:</span>
                            <span className="text-rose-300 font-bold">{hud?.streak || 0}</span>
                        </div>

                        <Link href="/stats">
                            <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/40 gap-1 border border-slate-800">
                                <Layers className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">战力档案</span>
                            </Button>
                        </Link>

                        {/* 清空重置对话按钮 */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleResetStory}
                            className="h-8 text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 gap-1 border border-slate-800"
                            title="清空当前对话记录并开启全新剧情"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">清空重置</span>
                        </Button>
                    </div>
                </div>

                {/* 现实知识漏洞监控条 (根据数据库真实数据) */}
                {hud && hud.weakTags && hud.weakTags.length > 0 && (
                    <div className="max-w-5xl mx-auto mt-2.5 pt-2 border-t border-cyan-900/30 flex items-center gap-2 text-xs overflow-x-auto py-0.5">
                        <ShieldAlert className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span className="text-amber-300/80 font-mono text-[11px] shrink-0">[WEAK_POINTS] 待攻克现实考点:</span>
                        <div className="flex items-center gap-1.5 flex-nowrap">
                            {hud.weakTags.slice(0, 6).map(tag => (
                                <span
                                    key={tag}
                                    className="px-2 py-0.5 rounded bg-amber-950/50 border border-amber-500/40 text-amber-300 font-mono text-[11px] whitespace-nowrap"
                                >
                                    ● {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </header>

            {/* 主对话时间线视窗 */}
            <main className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col space-y-4 overflow-y-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-28 text-slate-400 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                        <p className="text-xs font-mono tracking-widest text-cyan-300/80">
                            正在同步现实学情数据库，唤醒天玑推演系统...
                        </p>
                    </div>
                ) : messages.length === 0 && !currentEvent ? (
                    <div className="text-center py-20 space-y-5">
                        <div className="w-16 h-16 rounded-2xl bg-cyan-950/50 border border-cyan-500/40 flex items-center justify-center mx-auto text-cyan-400 shadow-[0_0_24px_rgba(6,182,212,0.25)]">
                            <Compass className="h-8 w-8 animate-spin" style={{ animationDuration: '10s' }} />
                        </div>
                        <div className="space-y-1.5">
                            <h2 className="text-lg font-bold text-white tracking-wide">
                                普通班后排课桌前，天玑系统视网膜神经接入完成
                            </h2>
                            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                                系统已捕获你所有的薄弱考点与错题残响。在熟悉的教室日常里，每一次推演都将化作打脸逆袭的现实战力。
                            </p>
                        </div>
                        <Button
                            onClick={() => handleTriggerEvent(false)}
                            disabled={eventLoading}
                            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-6 py-2.5 shadow-[0_0_16px_rgba(6,182,212,0.4)] gap-2 transition-all"
                        >
                            {eventLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            触发今日校园日常事件
                        </Button>
                    </div>
                ) : (
                    <>
                        {messages.map((msg, idx) => {
                            const isSystem = msg.role === "system";

                            return (
                                <div
                                    key={msg.id || idx}
                                    className={`flex ${isSystem ? "justify-start" : "justify-end"} animate-in fade-in duration-300`}
                                >
                                    <div
                                        className={`max-w-[88%] sm:max-w-[78%] rounded-2xl p-4 shadow-xl text-sm leading-relaxed ${
                                            isSystem
                                                ? msg.type === "settle"
                                                    ? "bg-[#11172e] border border-amber-500/40 text-slate-100 shadow-[0_0_16px_rgba(245,158,11,0.12)]"
                                                    : "bg-[#0d1326] border border-cyan-900/50 text-slate-200"
                                                : "bg-cyan-600/95 text-white border border-cyan-400/50 font-medium shadow-[0_0_16px_rgba(6,182,212,0.2)]"
                                        }`}
                                    >
                                        {/* 系统标识 */}
                                        {isSystem && (
                                            <div className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400 mb-2 border-b border-cyan-900/40 pb-1.5">
                                                <Terminal className="h-3 w-3" />
                                                <span>TIANJI://LOG &gt;</span>
                                                {msg.type === "settle" ? (
                                                    <span className="ml-auto text-amber-300 font-bold flex items-center gap-1">
                                                        <Zap className="h-3 w-3" /> 逆袭判定结算
                                                    </span>
                                                ) : (
                                                    <span className="ml-auto text-slate-400 text-[10px]">
                                                        {msg.type === "event" ? "校园日常任务" : "系统点拨指导"}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* 宿主自身发言标识 */}
                                        {!isSystem && (
                                            <div className="flex items-center justify-end gap-1.5 text-[10px] font-mono text-cyan-200 mb-1 opacity-80">
                                                <span>HOST://YOU</span>
                                            </div>
                                        )}

                                        {/* 正文 (Markdown + LaTeX) */}
                                        <div className="whitespace-pre-wrap break-words">
                                            <MarkdownRenderer content={msg.content} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* 当前进行中的题目卡片 (若未结算) */}
                        {currentEvent && currentEvent.exercise && (
                            <div className="bg-[#0e1428] border-2 border-cyan-500/50 rounded-2xl p-5 shadow-[0_0_28px_rgba(6,182,212,0.2)] space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 my-3">
                                <div className="flex items-center justify-between border-b border-cyan-900/60 pb-2.5">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold">
                                            【日常推演题】
                                        </span>
                                        <Badge variant="outline" className="text-xs text-slate-300 border-slate-700 font-mono">
                                            {currentEvent.exercise.tag}
                                        </Badge>
                                    </div>
                                    <span className="text-xs text-amber-400 font-mono font-bold flex items-center gap-1">
                                        <Zap className="h-3 w-3" /> 破局收益 +35 SP
                                    </span>
                                </div>

                                {/* 题干正文 */}
                                <div className="text-sm font-medium text-slate-100 leading-relaxed">
                                    <MarkdownRenderer content={currentEvent.exercise.questionText} />
                                </div>

                                {/* SVG 示意图 */}
                                {currentEvent.exercise.svgCode && (
                                    <div className="p-3 bg-[#070a14] rounded-lg border border-cyan-900/40 flex justify-center items-center overflow-x-auto">
                                        <div
                                            className="w-full flex justify-center [&>svg]:w-full [&>svg]:max-w-[380px] [&>svg]:h-auto [&>svg]:max-h-52 [&>svg]:mx-auto"
                                            dangerouslySetInnerHTML={{ __html: formatSvg(currentEvent.exercise.svgCode) }}
                                        />
                                    </div>
                                )}

                                {/* 单选题快捷选项按钮栏 */}
                                {currentEvent.exercise.options && currentEvent.exercise.options.length > 0 && (
                                    <div className="space-y-2 pt-1">
                                        <p className="text-[11px] font-mono text-cyan-400/80">点击下方选项可直接提交作答，亦可在底部输入框自由输入推导思路：</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            {currentEvent.exercise.options.map((opt, idx) => {
                                                const letter = String.fromCharCode(65 + idx);
                                                return (
                                                    <Button
                                                        key={opt}
                                                        type="button"
                                                        variant="outline"
                                                        disabled={submitting}
                                                        onClick={() => handleSendAction(letter, true)}
                                                        className="h-auto py-2.5 px-3 bg-[#080c1a] border-cyan-900/60 hover:border-cyan-400 hover:bg-cyan-950/40 text-left justify-start gap-2.5 transition-all text-slate-200"
                                                    >
                                                        <Badge variant="secondary" className="bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-mono text-xs shrink-0">
                                                            {letter}
                                                        </Badge>
                                                        <span className="text-xs flex-1 line-clamp-2">
                                                            {opt.replace(/^[A-D][.、\s]*/, '')}
                                                        </span>
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* AI 思考中指示器 */}
                        {(eventLoading || submitting) && (
                            <div className="flex justify-start animate-in fade-in">
                                <div className="bg-[#0e1428] border border-cyan-900/60 rounded-2xl px-4 py-2.5 flex items-center gap-2 text-xs text-cyan-400 font-mono shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>天玑系统正在推演真实因果逻辑...</span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </>
                )}
            </main>

            {/* 底部常驻交互底栏 */}
            <footer className="border-t border-cyan-900/40 bg-[#0c1022]/95 backdrop-blur-md p-4 sticky bottom-0 z-20 shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
                <div className="max-w-4xl mx-auto space-y-2.5">
                    {/* 快捷指令栏 */}
                    <div className="flex items-center justify-between text-xs overflow-x-auto pb-0.5 gap-2">
                        <div className="flex items-center gap-1.5 shrink-0">
                            {currentEvent ? (
                                <>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleSendAction("天玑，这道题的受力临界点或者核心定理是什么？点拨一下思路。")}
                                        disabled={submitting}
                                        className="h-7 px-2 text-[11px] text-cyan-400 hover:text-cyan-200 hover:bg-cyan-950/40 border border-cyan-900/40 font-mono gap-1"
                                    >
                                        <HelpCircle className="h-3 w-3" /> 请求思路点拨
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleTriggerEvent(true)}
                                        disabled={eventLoading || submitting}
                                        className="h-7 px-2 text-[11px] text-slate-400 hover:text-amber-300 hover:bg-amber-950/20 border border-slate-800 font-mono gap-1"
                                    >
                                        <RotateCcw className="h-3 w-3" /> 换一个日常事件
                                    </Button>
                                </>
                            ) : (
                                <span className="text-[11px] font-mono text-cyan-400/80 flex items-center gap-1">
                                    <Terminal className="h-3 w-3" /> 当前任务已化解，可与系统对话交流或触发新事件
                                </span>
                            )}
                        </div>

                        {/* 如果当前没有进行中的事件，显示推进剧情主按钮 */}
                        {!currentEvent && (
                            <Button
                                size="sm"
                                onClick={() => handleTriggerEvent(false)}
                                disabled={eventLoading || submitting}
                                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-slate-950 font-bold text-xs h-7 px-3 gap-1.5 shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                            >
                                {eventLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                推进下一幕剧情
                            </Button>
                        )}
                    </div>

                    {/* 主命令行输入框 (永远常驻，绝不禁用) */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-cyan-500/70 select-none">
                                PROMPT &gt;
                            </span>
                            <Input
                                placeholder={currentEvent ? "自由输入你的推导思路、对系统的提问或答案..." : "向天玑系统请教数理定理、商量对策..."}
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSendAction(inputText);
                                }}
                                disabled={submitting || eventLoading}
                                className="bg-[#060812] border-cyan-900/60 focus:border-cyan-400 text-slate-100 placeholder:text-slate-600 text-xs sm:text-sm pl-20 font-mono shadow-inner h-10"
                            />
                        </div>
                        <Button
                            onClick={() => handleSendAction(inputText)}
                            disabled={!inputText.trim() || submitting}
                            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 h-10 shadow-[0_0_12px_rgba(6,182,212,0.3)] shrink-0 transition-all"
                        >
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </footer>
        </div>
    );
}
