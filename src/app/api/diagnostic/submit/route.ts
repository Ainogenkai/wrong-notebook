import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorized, badRequest, internalError } from "@/lib/api-errors";
import { getAIService } from "@/lib/ai";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:diagnostic:submit');

interface QuestionAnswerSubmission {
    questionId: string;
    chapter: string;
    tag: string;
    questionText: string;
    options?: string[];
    userAnswer: string;
    correctAnswer: string;
    explanation: string;
    isCorrect: boolean;
    isGuessed: boolean;
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return unauthorized();
    }

    // @ts-ignore
    const userId = session.user.id;

    try {
        const body = await req.json();
        const { subject, grade, selectedChapters, answers } = body as {
            subject: string;
            grade: string;
            selectedChapters: string[];
            answers: QuestionAnswerSubmission[];
        };

        if (!subject || !grade || !Array.isArray(answers) || answers.length === 0) {
            return badRequest("Invalid submission payload");
        }

        let correctTotal = 0;
        let guessedCorrect = 0;
        let wrongTotal = 0;

        // 分类统计
        const wrongTags: string[] = [];
        const guessedTags: string[] = [];
        const correctTags: string[] = [];
        const skillPoints: string[] = []; // 从 explanation 中提取的能力点

        // 查找或自动创建学科对象
        let userSubjectObj = await prisma.subject.findFirst({
            where: {
                userId,
                name: { contains: subject === 'math' ? '数学' : '物理' }
            }
        });

        if (!userSubjectObj) {
            userSubjectObj = await prisma.subject.create({
                data: { userId, name: subject === 'math' ? '数学' : '物理' }
            });
        }

        // 逐题评估
        for (const ans of answers) {
            const isTrulyMastered = ans.isCorrect && !ans.isGuessed;

            if (ans.isCorrect) {
                correctTotal += 1;
                if (ans.isGuessed) {
                    guessedCorrect += 1;
                    guessedTags.push(ans.tag);
                } else {
                    correctTags.push(ans.tag);
                }
            } else {
                wrongTotal += 1;
                wrongTags.push(ans.tag);
            }

            // 从 explanation 中提取能力点（最后一句通常是能力点说明）
            if (ans.explanation) {
                const lastSentence = ans.explanation.split(/[。\n]/).filter(s => s.trim()).pop();
                if (lastSentence && (lastSentence.includes('考察') || lastSentence.includes('能力') || lastSentence.includes('核心'))) {
                    skillPoints.push(lastSentence.trim());
                }
            }

            // 更新 BKT 知识点状态
            const existingState = await prisma.knowledgeMasteryState.findUnique({
                where: {
                    userId_subject_tagName: { userId, subject, tagName: ans.tag }
                }
            });

            const newTotalTested = (existingState?.totalTested || 0) + 1;
            const newCorrectCount = (existingState?.correctCount || 0) + (ans.isCorrect ? 1 : 0);
            const newGuessedCount = (existingState?.guessedCount || 0) + (ans.isGuessed ? 1 : 0);

            let newProbability = newCorrectCount / newTotalTested;
            if (ans.isGuessed) newProbability *= 0.7;

            let newMasteryState = 0;
            if (!ans.isCorrect) {
                newMasteryState = 1;
            } else if (ans.isGuessed) {
                newMasteryState = 2;
            } else if (newProbability >= 0.8 && newCorrectCount >= 2) {
                newMasteryState = 3;
            } else {
                newMasteryState = 2;
            }

            await prisma.knowledgeMasteryState.upsert({
                where: {
                    userId_subject_tagName: { userId, subject, tagName: ans.tag }
                },
                update: {
                    masteryState: newMasteryState,
                    probability: newProbability,
                    totalTested: newTotalTested,
                    correctCount: newCorrectCount,
                    guessedCount: newGuessedCount,
                },
                create: {
                    userId, subject, tagName: ans.tag,
                    masteryState: newMasteryState,
                    probability: newProbability,
                    totalTested: newTotalTested,
                    correctCount: newCorrectCount,
                    guessedCount: newGuessedCount,
                }
            });

            // 做错或猜对 ➔ 自动归档到错题本
            if (!isTrulyMastered) {
                const tagObj = await prisma.knowledgeTag.findFirst({
                    where: { subject, name: ans.tag }
                });

                await prisma.errorItem.create({
                    data: {
                        userId,
                        subjectId: userSubjectObj.id,
                        originalImageUrl: "/icons/icon.png",
                        questionText: ans.questionText,
                        answerText: ans.correctAnswer,
                        analysis: ans.explanation,
                        wrongAnswerText: ans.userAnswer ? `提交的答案: ${ans.userAnswer}` : "未作答",
                        mistakeAnalysis: ans.isGuessed
                            ? "【凭感觉猜对】此知识点存在模糊侥幸，建议针对性复习。"
                            : `章节【${ans.chapter}】知识点【${ans.tag}】存在理解偏差。`,
                        mistakeStatus: ans.isCorrect ? "unknown" : "wrong_attempt",
                        gradeSemester: grade,
                        masteryLevel: 0,
                        tags: tagObj ? { connect: [{ id: tagObj.id }] } : undefined
                    }
                });
            }
        }

        // ===== 生成自然语言精准诊断报告 =====
        let reportSummary = "";

        // 构建掌握良好项
        const strengths: string[] = [];
        if (correctTags.length > 0) {
            strengths.push(`掌握良好：${correctTags.join("、")}`);
        }

        // 构建关键卡点
        const weaknesses: string[] = [];
        if (wrongTags.length > 0) {
            weaknesses.push(`存在薄弱：${[...new Set(wrongTags)].join("、")}`);
        }
        if (guessedTags.length > 0) {
            weaknesses.push(`凭直觉猜对（侥幸项）：${[...new Set(guessedTags)].join("、")}`);
        }

        // 能力点汇总
        const skillSummary = [...new Set(skillPoints)].slice(0, 5);

        reportSummary = [
            strengths.length > 0 ? `✅ ${strengths.join("；")}` : null,
            weaknesses.length > 0 ? `⚠️ ${weaknesses.join("；")}` : null,
            skillSummary.length > 0 ? `🔍 核心能力卡点：${skillSummary.join("；")}` : null,
        ].filter(Boolean).join("\n");

        // 保存诊断记录
        const record = await prisma.diagnosticQuizRecord.create({
            data: {
                userId, subject, grade,
                chapters: JSON.stringify(selectedChapters),
                score: correctTotal,
                totalCount: answers.length,
                detailJson: JSON.stringify(answers)
            }
        });

        return NextResponse.json({
            success: true,
            recordId: record.id,
            score: correctTotal,
            totalCount: answers.length,
            masteryRate: Math.round((correctTotal / answers.length) * 100),
            wrongTags: [...new Set(wrongTags)],
            guessedTags: [...new Set(guessedTags)],
            correctTags: [...new Set(correctTags)],
            skillPoints: skillSummary,
            reportSummary,
        });

    } catch (error) {
        logger.error({ error }, "Failed to submit diagnostic result");
        return internalError("提交测试结果失败，请稍后重试");
    }
}
