"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Loader2, AlertTriangle, CheckCircle2, BookOpen, ChevronRight, Target, Flame } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";

interface TagStat {
    tag: string;
    totalErrors: number;
    mastered: number;
    unmastered: number;
    masteryRate: number;
}

interface MathSectionStat {
    section: string;
    totalErrors: number;
    unmastered: number;
    tags: TagStat[];
}

interface MathChapterStat {
    chapter: string;
    totalErrors: number;
    unmastered: number;
    sections: MathSectionStat[];
}

interface GradeMathStat {
    grade: string;
    totalErrors: number;
    unmastered: number;
    chapters: MathChapterStat[];
}

interface PhysicsChapterStat {
    chapter: string;
    totalErrors: number;
    unmastered: number;
    tags: TagStat[];
}

interface GradePhysicsStat {
    grade: string;
    totalErrors: number;
    unmastered: number;
    chapters: PhysicsChapterStat[];
}

interface CurriculumWeaknessData {
    math: GradeMathStat[];
    physics: GradePhysicsStat[];
    topWeaknesses: TagStat[];
}

export function CurriculumWeaknessStats() {
    const [data, setData] = useState<CurriculumWeaknessData | null>(null);
    const [loading, setLoading] = useState(true);

    const [selectedMathGrade, setSelectedMathGrade] = useState<string>("");
    const [selectedPhysicsGrade, setSelectedPhysicsGrade] = useState<string>("");

    useEffect(() => {
        fetchWeaknessData();
    }, []);

    const fetchWeaknessData = async () => {
        try {
            const res = await apiClient.get<CurriculumWeaknessData>("/api/analytics/curriculum-weakness");
            setData(res);
            if (res.math && res.math.length > 0) {
                // 默认选择有错题的年级或第一个
                const mathWithErrors = res.math.find(g => g.totalErrors > 0) || res.math[0];
                setSelectedMathGrade(mathWithErrors.grade);
            }
            if (res.physics && res.physics.length > 0) {
                const physWithErrors = res.physics.find(g => g.totalErrors > 0) || res.physics[0];
                setSelectedPhysicsGrade(physWithErrors.grade);
            }
        } catch (error) {
            console.error("Failed to load curriculum weakness data:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!data) return null;

    const currentMathGradeData = data.math.find(g => g.grade === selectedMathGrade);
    const currentPhysicsGradeData = data.physics.find(g => g.grade === selectedPhysicsGrade);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Top 10 薄弱知识点清单卡片 */}
            <Card className="border-red-200 bg-red-50/20 dark:bg-red-950/10">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Flame className="h-5 w-5 text-red-500" />
                        <CardTitle className="text-xl">重点攻克：全局薄弱知识点榜单</CardTitle>
                    </div>
                    <CardDescription>
                        根据你的错题记录与未掌握状态排名，优先复习以下高频错题知识点。
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {data.topWeaknesses.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                            🎉 暂无未掌握的错题，保持得很好！
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {data.topWeaknesses.slice(0, 9).map((item, idx) => (
                                <div key={item.tag} className="p-3 bg-background border rounded-lg shadow-sm flex flex-col justify-between space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-sm flex items-center gap-1.5 truncate">
                                            <Badge variant={idx < 3 ? "destructive" : "secondary"} className="w-5 h-5 rounded-full p-0 flex items-center justify-center text-xs">
                                                {idx + 1}
                                            </Badge>
                                            <span className="truncate">{item.tag}</span>
                                        </span>
                                        <Badge variant={item.unmastered > 0 ? "outline" : "secondary"} className="text-xs text-red-600 border-red-200">
                                            未掌握 {item.unmastered} / {item.totalErrors} 题
                                        </Badge>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>掌握率</span>
                                            <span>{item.masteryRate}%</span>
                                        </div>
                                        <Progress value={item.masteryRate} className="h-1.5" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 教材大纲对照表（分数学 / 物理） */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <BookOpen className="h-5 w-5 text-primary" />
                                人教版教材章节薄弱点对照表
                            </CardTitle>
                            <CardDescription className="mt-1">
                                对照人教版教材大纲目录，直观查看各章节、各知识点的错题分布与攻克率。
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="math" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-6">
                            <TabsTrigger value="math" className="text-base font-medium">
                                📐 人教版数学大纲对照
                            </TabsTrigger>
                            <TabsTrigger value="physics" className="text-base font-medium">
                                ⚡ 人教版物理大纲对照
                            </TabsTrigger>
                        </TabsList>

                        {/* 数学对照表 */}
                        <TabsContent value="math" className="space-y-4">
                            <div className="flex items-center justify-between gap-4 bg-muted/40 p-3 rounded-lg border">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">选择年级/册别：</span>
                                    <Select value={selectedMathGrade} onValueChange={setSelectedMathGrade}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="选择年级" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {data.math.map(g => (
                                                <SelectItem key={g.grade} value={g.grade}>
                                                    {g.grade} {g.totalErrors > 0 ? `(${g.unmastered} 待掌握)` : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {currentMathGradeData && (
                                    <div className="flex items-center gap-4 text-sm">
                                        <span>该册累计错题: <strong className="text-primary">{currentMathGradeData.totalErrors}</strong> 题</span>
                                        <span>未掌握: <strong className="text-red-500">{currentMathGradeData.unmastered}</strong> 题</span>
                                    </div>
                                )}
                            </div>

                            {currentMathGradeData && (
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="w-[160px]">章节</TableHead>
                                                <TableHead className="w-[160px]">小节/专题</TableHead>
                                                <TableHead>标准知识点 (大纲对应)</TableHead>
                                                <TableHead className="w-[100px] text-center">错题统计</TableHead>
                                                <TableHead className="w-[130px] text-center">掌握率</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {currentMathGradeData.chapters.map((ch) =>
                                                ch.sections.map((sec, secIdx) =>
                                                    sec.tags.map((t, tagIdx) => (
                                                        <TableRow key={`${ch.chapter}-${sec.section}-${t.tag}`} className={t.totalErrors > 0 ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}>
                                                            {secIdx === 0 && tagIdx === 0 && (
                                                                <TableCell
                                                                    rowSpan={ch.sections.reduce((acc, s) => acc + s.tags.length, 0)}
                                                                    className="font-medium border-r align-top bg-muted/20"
                                                                >
                                                                    <div className="font-semibold text-foreground">{ch.chapter}</div>
                                                                    {ch.unmastered > 0 && (
                                                                        <Badge variant="outline" className="mt-1 text-xs text-red-500 border-red-200">
                                                                            需强化 {ch.unmastered} 题
                                                                        </Badge>
                                                                    )}
                                                                </TableCell>
                                                            )}
                                                            {tagIdx === 0 && (
                                                                <TableCell
                                                                    rowSpan={sec.tags.length}
                                                                    className="text-sm border-r align-top"
                                                                >
                                                                    {sec.section}
                                                                </TableCell>
                                                            )}
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-medium text-sm">{t.tag}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                {t.totalErrors > 0 ? (
                                                                    <Badge variant={t.unmastered > 0 ? "destructive" : "secondary"}>
                                                                        {t.unmastered > 0 ? `${t.unmastered} 待复习 / 共 ${t.totalErrors}` : `已掌握 (${t.totalErrors})`}
                                                                    </Badge>
                                                                ) : (
                                                                    <span className="text-xs text-muted-foreground">暂无错题</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                {t.totalErrors > 0 ? (
                                                                    <div className="space-y-1">
                                                                        <span className="text-xs font-semibold">{t.masteryRate}%</span>
                                                                        <Progress value={t.masteryRate} className="h-1.5" />
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-muted-foreground">-</span>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>

                        {/* 物理对照表 */}
                        <TabsContent value="physics" className="space-y-4">
                            <div className="flex items-center justify-between gap-4 bg-muted/40 p-3 rounded-lg border">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">选择年级/册别：</span>
                                    <Select value={selectedPhysicsGrade} onValueChange={setSelectedPhysicsGrade}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="选择年级" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {data.physics.map(g => (
                                                <SelectItem key={g.grade} value={g.grade}>
                                                    {g.grade} {g.totalErrors > 0 ? `(${g.unmastered} 待掌握)` : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {currentPhysicsGradeData && (
                                    <div className="flex items-center gap-4 text-sm">
                                        <span>该册累计错题: <strong className="text-primary">{currentPhysicsGradeData.totalErrors}</strong> 题</span>
                                        <span>未掌握: <strong className="text-red-500">{currentPhysicsGradeData.unmastered}</strong> 题</span>
                                    </div>
                                )}
                            </div>

                            {currentPhysicsGradeData && (
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="w-[180px]">章节目录</TableHead>
                                                <TableHead>知识点 (人教版物理)</TableHead>
                                                <TableHead className="w-[140px] text-center">错题统计</TableHead>
                                                <TableHead className="w-[140px] text-center">掌握率</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {currentPhysicsGradeData.chapters.map((ch) =>
                                                ch.tags.map((t, tagIdx) => (
                                                    <TableRow key={`${ch.chapter}-${t.tag}`} className={t.totalErrors > 0 ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}>
                                                        {tagIdx === 0 && (
                                                            <TableCell
                                                                rowSpan={ch.tags.length}
                                                                className="font-medium border-r align-top bg-muted/20"
                                                            >
                                                                <div className="font-semibold text-foreground">{ch.chapter}</div>
                                                                {ch.unmastered > 0 && (
                                                                    <Badge variant="outline" className="mt-1 text-xs text-red-500 border-red-200">
                                                                        需强化 {ch.unmastered} 题
                                                                    </Badge>
                                                                )}
                                                            </TableCell>
                                                        )}
                                                        <TableCell>
                                                            <span className="font-medium text-sm">{t.tag}</span>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {t.totalErrors > 0 ? (
                                                                <Badge variant={t.unmastered > 0 ? "destructive" : "secondary"}>
                                                                    {t.unmastered > 0 ? `${t.unmastered} 待复习 / 共 ${t.totalErrors}` : `已掌握 (${t.totalErrors})`}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">暂无错题</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {t.totalErrors > 0 ? (
                                                                <div className="space-y-1">
                                                                    <span className="text-xs font-semibold">{t.masteryRate}%</span>
                                                                    <Progress value={t.masteryRate} className="h-1.5" />
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">-</span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
