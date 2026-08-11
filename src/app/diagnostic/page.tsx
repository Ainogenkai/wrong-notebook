"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { BackButton } from "@/components/ui/back-button";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { MATH_CURRICULUM } from "@/lib/tag-data/math";
import { PHYSICS_CURRICULUM } from "@/lib/tag-data/physics";
import { apiClient } from "@/lib/api-client";
import {
    Sparkles,
    Loader2,
    CheckCircle2,
    XCircle,
    HelpCircle,
    ArrowRight,
    RotateCcw,
    Layers,
    BookOpen,
    Trophy,
    Flame,
    House
} from "lucide-react";
import Link from "next/link";

interface Question {
    id: string;
    chapter: string;
    tag: string;
    type: "choice" | "blank";
    questionText: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
}

export default function DiagnosticPage() {
    // 步骤控制： 1: 选择章节设置 -> 2: AI生成中 -> 3: 卡片答题中 -> 4: 诊断报告
    const [step, setStep] = useState<number>(1);

    const [subject, setSubject] = useState<"math" | "physics">("math");
    const [grade, setGrade] = useState<string>("高一上");
    const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
    const [questionCount, setQuestionCount] = useState<number>(6);

    const [loading, setLoading] = useState(false);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    // 用户答题记录
    const [userAnswers, setUserAnswers] = useState<Record<string, { answer: string; isGuessed: boolean }>>({});

    // 提交后诊断报告数据
    const [report, setReport] = useState<{
        score: number;
        totalCount: number;
        masteryRate: number;
        wrongTags?: string[];
        guessedTags?: string[];
        correctTags?: string[];
        skillPoints?: string[];
        reportSummary?: string;
    } | null>(null);

    // 获取当前科目与年级对应的章节列表
    const getAvailableChapters = () => {
        if (subject === "math") {
            const data = MATH_CURRICULUM[grade];
            return data ? data.map(item => item.chapter) : [];
        } else {
            const data = PHYSICS_CURRICULUM[grade];
            return data ? data.map(item => item.chapter) : [];
        }
    };

    const chapters = getAvailableChapters();

    const toggleChapter = (chapter: string) => {
        if (selectedChapters.includes(chapter)) {
            setSelectedChapters(selectedChapters.filter(c => c !== chapter));
        } else {
            setSelectedChapters([...selectedChapters, chapter]);
        }
    };

    const toggleSelectAll = () => {
        if (selectedChapters.length === chapters.length) {
            setSelectedChapters([]);
        } else {
            setSelectedChapters([...chapters]);
        }
    };

    // 开始 AI 生成交错测试试卷
    const handleGenerate = async () => {
        if (selectedChapters.length === 0) {
            alert("请至少勾选 1 个章节进行测试");
            return;
        }

        setStep(2);
        setLoading(true);

        try {
            const data = await apiClient.post<{ questions: Question[] }>("/api/diagnostic/generate", {
                subject,
                grade,
                selectedChapters,
                questionCount
            });

            setQuestions(data.questions);
            setCurrentIndex(0);
            setUserAnswers({});
            setStep(3);
        } catch (error: any) {
            console.error("Diagnostic generate failed:", error);
            alert(error?.message || "生成诊断试题失败，请检查 AI 配置与网络");
            setStep(1);
        } finally {
            setLoading(false);
        }
    };

    // 答题辅助函数
    const handleSelectOption = (questionId: string, optionLetter: string) => {
        setUserAnswers(prev => ({
            ...prev,
            [questionId]: {
                answer: optionLetter,
                isGuessed: prev[questionId]?.isGuessed || false
            }
        }));
    };

    const handleTextAnswer = (questionId: string, text: string) => {
        setUserAnswers(prev => ({
            ...prev,
            [questionId]: {
                answer: text,
                isGuessed: prev[questionId]?.isGuessed || false
            }
        }));
    };

    const toggleGuessed = (questionId: string) => {
        setUserAnswers(prev => ({
            ...prev,
            [questionId]: {
                answer: prev[questionId]?.answer || "",
                isGuessed: !prev[questionId]?.isGuessed
            }
        }));
    };

    // 提交整套测试结果
    const handleSubmitQuiz = async () => {
        setLoading(true);

        const answersPayload = questions.map(q => {
            const userAns = userAnswers[q.id]?.answer || "";
            const isGuessed = userAnswers[q.id]?.isGuessed || false;

            // 简单校验正确性
            let isCorrect = false;
            if (q.type === "choice") {
                isCorrect = userAns.trim().toUpperCase() === q.correctAnswer.trim().toUpperCase();
            } else {
                isCorrect = userAns.trim() === q.correctAnswer.trim();
            }

            return {
                questionId: q.id,
                chapter: q.chapter,
                tag: q.tag,
                questionText: q.questionText,
                options: q.options,
                userAnswer: userAns,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation,
                isCorrect,
                isGuessed
            };
        });

        try {
            const res = await apiClient.post<{
                score: number;
                totalCount: number;
                masteryRate: number;
                wrongTags?: string[];
                guessedTags?: string[];
                correctTags?: string[];
                skillPoints?: string[];
                reportSummary?: string;
            }>(
                "/api/diagnostic/submit",
                {
                    subject,
                    grade,
                    selectedChapters,
                    answers: answersPayload
                }
            );

            setReport(res);
            setStep(4);
        } catch (error: any) {
            console.error("Submit quiz error:", error);
            alert("提交测试失败，请稍后重试");
        } finally {
            setLoading(false);
        }
    };

    const currentQ = questions[currentIndex];

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl min-h-screen">
            {/* 顶部导航 */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <BackButton fallbackUrl="/stats" />
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Sparkles className="h-6 w-6 text-primary" />
                            20分钟能力扫描
                        </h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            快速诊断知识掌握状况，自动避开历史已做过的题目
                        </p>
                    </div>
                </div>
                <Link href="/stats">
                    <Button variant="outline" size="sm" className="gap-1.5">
                        <Layers className="h-4 w-4" />
                        查看教材热力图
                    </Button>
                </Link>
            </div>

            {/* 步骤 1: 灵活选区组卷 */}
            {step === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BookOpen className="h-5 w-5 text-primary" />
                                选区第一步：挑选试卷科系与年级
                            </CardTitle>
                            <CardDescription>
                                像问卷调查一样自由勾选章节组合，训练大脑在不同知识点间敏捷切换。
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">选择学科：</label>
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant={subject === "math" ? "default" : "outline"}
                                            className="flex-1"
                                            onClick={() => {
                                                setSubject("math");
                                                setSelectedChapters([]);
                                            }}
                                        >
                                            📐 人教版数学
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={subject === "physics" ? "default" : "outline"}
                                            className="flex-1"
                                            onClick={() => {
                                                setSubject("physics");
                                                setSelectedChapters([]);
                                            }}
                                        >
                                            ⚡ 人教版物理
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">选择年级/册别：</label>
                                    <Select
                                        value={grade}
                                        onValueChange={(val) => {
                                            setGrade(val);
                                            setSelectedChapters([]);
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {subject === "math"
                                                ? Object.keys(MATH_CURRICULUM).map(g => (
                                                    <SelectItem key={g} value={g}>{g}</SelectItem>
                                                ))
                                                : Object.keys(PHYSICS_CURRICULUM).map(g => (
                                                    <SelectItem key={g} value={g}>{g}</SelectItem>
                                                ))
                                            }
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t">
                                <label className="text-sm font-medium">题目数量：</label>
                                <div className="flex gap-2">
                                    {[5, 6, 8, 10].map(cnt => (
                                        <Button
                                            key={cnt}
                                            type="button"
                                            size="sm"
                                            variant={questionCount === cnt ? "default" : "outline"}
                                            onClick={() => setQuestionCount(cnt)}
                                        >
                                            {cnt} 题
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <div>
                                <CardTitle className="text-lg">选区第二步：勾选交错章节 (支持多选)</CardTitle>
                                <CardDescription className="mt-1">
                                    勾选 1 个或多个章节。勾选越多，交错测试辨别效果越佳。
                                </CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                                {selectedChapters.length === chapters.length ? "取消全选" : "一键全选本册"}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {chapters.map(ch => {
                                    const isChecked = selectedChapters.includes(ch);
                                    return (
                                        <div
                                            key={ch}
                                            onClick={() => toggleChapter(ch)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center gap-3 ${isChecked
                                                    ? "bg-primary/10 border-primary font-medium"
                                                    : "bg-background hover:bg-muted/50"
                                                }`}
                                        >
                                            <Checkbox checked={isChecked} onCheckedChange={() => { }} />
                                            <span className="text-sm truncate">{ch}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-6 flex justify-end">
                                <Button
                                    size="lg"
                                    onClick={handleGenerate}
                                    disabled={selectedChapters.length === 0}
                                    className="w-full sm:w-auto gap-2"
                                >
                                    <Sparkles className="h-5 w-5" />
                                    生成 {selectedChapters.length} 章节交错诊断卷 ({questionCount} 题)
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* 步骤 2: AI 题目生成中状态 */}
            {step === 2 && (
                <Card className="py-16 text-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                    <h3 className="text-xl font-bold">AI 正在生成能力扫描题...</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        正在针对你勾选的章节【{selectedChapters.join("、")}】注入教材防超纲约束，并自动避开你历史已做过的题目。
                    </p>
                </Card>
            )}

            {/* 步骤 3: 卡片式 15 分钟极简答题 */}
            {step === 3 && currentQ && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    {/* 答题进度卡片 */}
                    <div className="flex items-center justify-between bg-muted/40 p-4 rounded-lg border">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-sm font-semibold">
                                {currentIndex + 1} / {questions.length}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                                章节：{currentQ.chapter}
                            </Badge>
                            <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                                知识点：{currentQ.tag}
                            </Badge>
                        </div>
                        <Progress value={((currentIndex + 1) / questions.length) * 100} className="w-1/3 h-2" />
                    </div>

                    {/* 题目正文卡片 */}
                    <Card className="shadow-md">
                        <CardHeader>
                            <CardTitle className="text-base font-normal leading-relaxed">
                                <MarkdownRenderer content={currentQ.questionText} />
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* 选择题选项卡 */}
                            {currentQ.type === "choice" && currentQ.options && (
                                <div className="space-y-2.5">
                                    {currentQ.options.map((opt, idx) => {
                                        const letter = String.fromCharCode(65 + idx); // A, B, C, D
                                        const isSelected = userAnswers[currentQ.id]?.answer === letter;
                                        return (
                                            <div
                                                key={opt}
                                                onClick={() => handleSelectOption(currentQ.id, letter)}
                                                className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${isSelected
                                                        ? "bg-primary text-primary-foreground font-medium border-primary shadow-sm"
                                                        : "bg-background hover:bg-muted/60"
                                                    }`}
                                            >
                                                <Badge variant={isSelected ? "secondary" : "outline"} className="mt-0.5">
                                                    {letter}
                                                </Badge>
                                                <div className="text-sm flex-1">
                                                    <MarkdownRenderer content={opt.replace(/^[A-D][.、\s]*/, '')} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* 填空/精简计算题 */}
                            {currentQ.type === "blank" && (
                                <div className="space-y-2">
                                    <label className="text-sm text-muted-foreground">请输入你的核心计算结果或简短答案：</label>
                                    <Input
                                        placeholder="直接输入计算结果..."
                                        value={userAnswers[currentQ.id]?.answer || ""}
                                        onChange={(e) => handleTextAnswer(currentQ.id, e.target.value)}
                                        className="font-mono"
                                    />
                                </div>
                            )}

                            {/* 元认知标记开关："凭感觉猜的" */}
                            <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <HelpCircle className="h-4 w-4 text-amber-600" />
                                    <span className="text-xs font-medium text-amber-900 dark:text-amber-200">
                                        元认知校准：这道题你是凭直觉/概率猜的吗？
                                    </span>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={userAnswers[currentQ.id]?.isGuessed ? "destructive" : "outline"}
                                    onClick={() => toggleGuessed(currentQ.id)}
                                    className="text-xs h-7 gap-1"
                                >
                                    {userAnswers[currentQ.id]?.isGuessed ? "已标记为凭感觉猜" : "标记为【凭感觉猜】"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 翻页与提交按钮 */}
                    <div className="flex justify-between items-center pt-2">
                        <Button
                            variant="outline"
                            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                            disabled={currentIndex === 0}
                        >
                            上一题
                        </Button>

                        {currentIndex < questions.length - 1 ? (
                            <Button onClick={() => setCurrentIndex(prev => prev + 1)} className="gap-1.5">
                                下一题
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        ) : (
                            <Button
                                onClick={handleSubmitQuiz}
                                disabled={loading}
                                className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                                完成扫描，生成报告
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* 步骤 4: 诊断报告与三出口流程 */}
            {step === 4 && report && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* 诊断总结卡片 */}
                    <Card className="text-center py-6">
                        <CardHeader>
                            <CardTitle className="text-2xl">能力扫描完成</CardTitle>
                            <CardDescription>
                                答对 <strong className="text-primary text-lg">{report.score}</strong> / {report.totalCount} 题
                                （正确率 {report.masteryRate}%）
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* 自然语言精准诊断报告 */}
                            {report.reportSummary && (
                                <div className="text-left bg-muted/40 rounded-lg p-4 space-y-2 border">
                                    <p className="text-sm whitespace-pre-line leading-relaxed">{report.reportSummary}</p>
                                </div>
                            )}

                            {/* 标签汇总 */}
                            <div className="flex flex-wrap gap-2 justify-center text-xs">
                                {report.correctTags && report.correctTags.length > 0 && (
                                    <Badge className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">
                                        ✅ 掌握：{report.correctTags.join("、")}
                                    </Badge>
                                )}
                                {report.wrongTags && report.wrongTags.length > 0 && (
                                    <Badge variant="destructive">
                                        ❌ 薄弱：{report.wrongTags.join("、")}
                                    </Badge>
                                )}
                                {report.guessedTags && report.guessedTags.length > 0 && (
                                    <Badge className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                                        🤔 猜对：{report.guessedTags.join("、")}
                                    </Badge>
                                )}
                            </div>

                            {report.skillPoints && report.skillPoints.length > 0 && (
                                <div className="text-left text-xs text-muted-foreground border-t pt-3">
                                    <strong>核心能力卡点：</strong>
                                    <ul className="mt-1 space-y-1">
                                        {report.skillPoints.map((s, i) => (
                                            <li key={i}>• {s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <p className="text-xs text-muted-foreground pt-2">
                                做错或标记为"凭感觉猜的"题目已自动归档到错题本。
                            </p>
                        </CardContent>
                    </Card>

                    {/* 三出口按钮 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Link href="/">
                            <Button variant="outline" className="w-full h-auto py-4 gap-2">
                                <House className="h-5 w-5" />
                                <div className="flex flex-col items-start">
                                    <span className="font-medium">返回主页</span>
                                    <span className="text-xs text-muted-foreground">完成本次扫描</span>
                                </div>
                            </Button>
                        </Link>
                        <Button
                            variant="outline"
                            className="w-full h-auto py-4 gap-2 border-violet-300 hover:border-violet-500 hover:bg-violet-50/50 dark:hover:bg-violet-950/20"
                            onClick={() => {
                                setStep(1);
                                setSelectedChapters([]);
                                setQuestions([]);
                                setUserAnswers({});
                                setReport(null);
                                setCurrentIndex(0);
                            }}
                        >
                            <RotateCcw className="h-5 w-5 text-violet-500" />
                            <div className="flex flex-col items-start">
                                <span className="font-medium">继续测其他章节</span>
                                <span className="text-xs text-muted-foreground">扫描未覆盖的部分</span>
                            </div>
                        </Button>
                        <Link href="/notebooks">
                            <Button variant="outline" className="w-full h-auto py-4 gap-2">
                                <BookOpen className="h-5 w-5" />
                                <div className="flex flex-col items-start">
                                    <span className="font-medium">查看错题本</span>
                                    <span className="text-xs text-muted-foreground">复习刚归档的错题</span>
                                </div>
                            </Button>
                        </Link>
                    </div>

                    {/* 逐题解析明细 */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">答题明细</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {questions.map((q, idx) => {
                                const ansInfo = userAnswers[q.id];
                                const isCorrect = q.type === "choice"
                                    ? (ansInfo?.answer || "").toUpperCase() === q.correctAnswer.toUpperCase()
                                    : (ansInfo?.answer || "").trim() === q.correctAnswer.trim();

                                return (
                                    <div key={q.id} className="p-4 rounded-lg border space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline">第 {idx + 1} 题</Badge>
                                                <Badge variant="secondary">{q.chapter}</Badge>
                                                <Badge variant="outline" className="border-primary/40 text-primary">{q.tag}</Badge>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {ansInfo?.isGuessed && (
                                                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                                                        凭感觉猜的
                                                    </Badge>
                                                )}
                                                {isCorrect ? (
                                                    <Badge className="bg-green-600">
                                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                                        正确
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="destructive">
                                                        <XCircle className="h-3.5 w-3.5 mr-1" />
                                                        错误 (已归档)
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        <div className="text-sm font-medium mt-2">
                                            <MarkdownRenderer content={q.questionText} />
                                        </div>

                                        <div className="text-xs text-muted-foreground pt-2 border-t flex flex-wrap gap-4">
                                            <span>你的回答: <strong className="text-foreground">{ansInfo?.answer || "未填"}</strong></span>
                                            <span>正确答案: <strong className="text-green-600">{q.correctAnswer}</strong></span>
                                        </div>

                                        <div className="text-xs bg-muted/40 p-2.5 rounded border mt-2">
                                            <MarkdownRenderer content={q.explanation} />
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
