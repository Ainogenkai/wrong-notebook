"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { BarChart3, TrendingUp, Activity, House, BookOpenCheck, Loader2 } from "lucide-react";
import Link from "next/link";

// 使用 dynamic import 并禁用 ssr 渲染，避免 Next.js 服务器 HTML 与客户端 DOM 不匹配引发水合报错
const WrongAnswerStats = dynamic(
    () => import("@/components/wrong-answer-stats").then((mod) => mod.WrongAnswerStats),
    { ssr: false, loading: () => <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> }
);

const PracticeStats = dynamic(
    () => import("@/components/practice-stats").then((mod) => mod.PracticeStats),
    { ssr: false, loading: () => <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> }
);

const CurriculumWeaknessStats = dynamic(
    () => import("@/components/curriculum-weakness-stats").then((mod) => mod.CurriculumWeaknessStats),
    { ssr: false, loading: () => <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> }
);

function StatsContent() {
    const { t } = useLanguage();

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="flex items-center gap-4 mb-6">
                <BackButton fallbackUrl="/" />
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <BarChart3 className="h-8 w-8" />
                        {t.stats?.headerTitle || "Statistics Center"}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {t.stats?.headerDesc || "View your learning progress and data analysis"}
                    </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Link href="/diagnostic">
                        <Button className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-sm">
                            <BookOpenCheck className="h-4 w-4" />
                            发起章节诊断
                        </Button>
                    </Link>
                    <Link href="/">
                        <Button variant="ghost" size="icon">
                            <House className="h-5 w-5" />
                        </Button>
                    </Link>
                </div>
            </div>

            <Tabs defaultValue="weakness" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="weakness" className="flex items-center gap-2 font-medium">
                        <BookOpenCheck className="h-4 w-4" />
                        教材薄弱点对照
                    </TabsTrigger>
                    <TabsTrigger value="wrong" className="flex items-center gap-2 font-medium">
                        <Activity className="h-4 w-4" />
                        {t.wrongAnswerStats?.title || "Wrong Answer Stats"}
                    </TabsTrigger>
                    <TabsTrigger value="practice" className="flex items-center gap-2 font-medium">
                        <TrendingUp className="h-4 w-4" />
                        {t.stats?.title || "Practice Stats"}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="weakness" className="space-y-4">
                    <CurriculumWeaknessStats />
                </TabsContent>
                <TabsContent value="wrong" className="space-y-4">
                    <WrongAnswerStats />
                </TabsContent>
                <TabsContent value="practice" className="space-y-4">
                    <PracticeStats />
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function StatsPage() {
    return (
        <Suspense fallback={null}>
            <StatsContent />
        </Suspense>
    );
}
