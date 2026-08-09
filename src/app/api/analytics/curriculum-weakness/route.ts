import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { MATH_CURRICULUM } from "@/lib/tag-data/math";
import { PHYSICS_CURRICULUM } from "@/lib/tag-data/physics";

const logger = createLogger('api:analytics:curriculum-weakness');

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return unauthorized();
    }

    // @ts-ignore
    const userId = session.user.id;

    try {
        // 获取用户所有错题及知识点标签
        const errorItems = await prisma.errorItem.findMany({
            where: { userId },
            include: {
                subject: true,
                tags: true
            }
        });

        // 获取用户存入的 BKT 贝叶斯掌握度状态表
        const masteryStates = await prisma.knowledgeMasteryState.findMany({
            where: { userId }
        });

        const bktStateMap = new Map<string, { masteryState: number; probability: number }>();
        masteryStates.forEach(ms => {
            bktStateMap.set(`${ms.subject}:${ms.tagName}`, {
                masteryState: ms.masteryState,
                probability: ms.probability
            });
        });

        // 整理每个知识点标签的错题分布及掌握状态
        const tagMap = new Map<string, { total: number; mastered: number; unmastered: number; items: Array<{ id: string; questionText: string; masteryLevel: number }> }>();

        errorItems.forEach(item => {
            let tagNames: string[] = [];
            if (item.tags && item.tags.length > 0) {
                tagNames = item.tags.map(t => t.name);
            } else if (item.knowledgePoints) {
                try {
                    const parsed = JSON.parse(item.knowledgePoints);
                    if (Array.isArray(parsed)) tagNames = parsed;
                } catch (e) { }
            }

            const isMastered = item.masteryLevel > 0;

            tagNames.forEach(tagName => {
                if (!tagMap.has(tagName)) {
                    tagMap.set(tagName, { total: 0, mastered: 0, unmastered: 0, items: [] });
                }
                const entry = tagMap.get(tagName)!;
                entry.total += 1;
                if (isMastered) {
                    entry.mastered += 1;
                } else {
                    entry.unmastered += 1;
                }
                entry.items.push({
                    id: item.id,
                    questionText: item.questionText || "",
                    masteryLevel: item.masteryLevel
                });
            });
        });

        // 构建数学（人教版）统计数据
        const mathAnalysis = Object.entries(MATH_CURRICULUM).map(([grade, chapters]) => {
            let gradeTotalErrors = 0;
            let gradeUnmastered = 0;

            const chapterList = chapters.map(ch => {
                let chapterTotal = 0;
                let chapterUnmastered = 0;

                const sectionList = ch.sections.map(sec => {
                    let sectionTotal = 0;
                    let sectionUnmastered = 0;

                    const tagList = sec.tags.map(t => {
                        const tagData = tagMap.get(t) || { total: 0, mastered: 0, unmastered: 0, items: [] };
                        sectionTotal += tagData.total;
                        sectionUnmastered += tagData.unmastered;

                        const bktInfo = bktStateMap.get(`math:${t}`) || { masteryState: 0, probability: 0.0 };

                        return {
                            tag: t,
                            totalErrors: tagData.total,
                            mastered: tagData.mastered,
                            unmastered: tagData.unmastered,
                            masteryRate: tagData.total > 0 ? Math.round((tagData.mastered / tagData.total) * 100) : 100,
                            bktState: bktInfo.masteryState, // 0:未诊, 1:薄弱, 2:初步, 3:稳固
                            bktProb: bktInfo.probability
                        };
                    });

                    chapterTotal += sectionTotal;
                    chapterUnmastered += sectionUnmastered;

                    return {
                        section: sec.section,
                        totalErrors: sectionTotal,
                        unmastered: sectionUnmastered,
                        tags: tagList
                    };
                });

                gradeTotalErrors += chapterTotal;
                gradeUnmastered += chapterUnmastered;

                return {
                    chapter: ch.chapter,
                    totalErrors: chapterTotal,
                    unmastered: chapterUnmastered,
                    sections: sectionList
                };
            });

            return {
                grade,
                totalErrors: gradeTotalErrors,
                unmastered: gradeUnmastered,
                chapters: chapterList
            };
        });

        // 构建物理（人教版）统计数据
        const physicsAnalysis = Object.entries(PHYSICS_CURRICULUM).map(([grade, chapters]) => {
            let gradeTotalErrors = 0;
            let gradeUnmastered = 0;

            const chapterList = chapters.map(ch => {
                let chapterTotal = 0;
                let chapterUnmastered = 0;

                const tagList = ch.tags.map(t => {
                    const tagData = tagMap.get(t) || { total: 0, mastered: 0, unmastered: 0, items: [] };
                    chapterTotal += tagData.total;
                    chapterUnmastered += tagData.unmastered;

                    const bktInfo = bktStateMap.get(`physics:${t}`) || { masteryState: 0, probability: 0.0 };

                    return {
                        tag: t,
                        totalErrors: tagData.total,
                        mastered: tagData.mastered,
                        unmastered: tagData.unmastered,
                        masteryRate: tagData.total > 0 ? Math.round((tagData.mastered / tagData.total) * 100) : 100,
                        bktState: bktInfo.masteryState, // 0:未诊, 1:薄弱, 2:初步, 3:稳固
                        bktProb: bktInfo.probability
                    };
                });

                gradeTotalErrors += chapterTotal;
                gradeUnmastered += chapterUnmastered;

                return {
                    chapter: ch.chapter,
                    totalErrors: chapterTotal,
                    unmastered: chapterUnmastered,
                    tags: tagList
                };
            });

            return {
                grade,
                totalErrors: gradeTotalErrors,
                unmastered: gradeUnmastered,
                chapters: chapterList
            };
        });

        // 提取全站 Top 薄弱知识点清单 (未掌握错题最多的 Top 10 知识点)
        const topWeaknesses = Array.from(tagMap.entries())
            .map(([tagName, stat]) => ({
                tag: tagName,
                totalErrors: stat.total,
                unmastered: stat.unmastered,
                mastered: stat.mastered,
                masteryRate: stat.total > 0 ? Math.round((stat.mastered / stat.total) * 100) : 100
            }))
            .filter(item => item.unmastered > 0 || item.totalErrors > 0)
            .sort((a, b) => b.unmastered - a.unmastered || b.totalErrors - a.totalErrors)
            .slice(0, 15);

        return NextResponse.json({
            math: mathAnalysis,
            physics: physicsAnalysis,
            topWeaknesses
        });

    } catch (error) {
        logger.error({ error }, 'Error fetching curriculum weakness analysis');
        return internalError("Failed to fetch curriculum weakness analysis");
    }
}
