import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { unauthorized, badRequest, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { randomUUID } from "crypto";

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

        const subjectDisplayName = subject === 'math' ? '数学' : '物理';
        const allTagNames = [...new Set(answers.map(a => a.tag))];

        // ===== Phase 1: Batch reads (2 round trips, parallelized) =====
        const [existingMasteryStates, existingTags] = await Promise.all([
            prisma.knowledgeMasteryState.findMany({
                where: { userId, subject, tagName: { in: allTagNames } }
            }),
            prisma.knowledgeTag.findMany({
                where: { subject, name: { in: allTagNames } }
            }),
        ]);

        // Build tag ID map: existing IDs + pre-generated IDs for missing tags
        const tagIdMap = new Map<string, string>();
        existingTags.forEach(t => tagIdMap.set(t.name, t.id));

        const missingTags: Array<{ id: string; name: string; subject: string; isSystem: boolean }> = [];
        for (const tagName of allTagNames) {
            if (!tagIdMap.has(tagName)) {
                const newId = randomUUID();
                tagIdMap.set(tagName, newId);
                missingTags.push({ id: newId, name: tagName, subject, isSystem: true });
            }
        }

        // Build mastery state map for in-memory lookup
        const masteryMap = new Map(existingMasteryStates.map(ms => [ms.tagName, ms]));

        // ===== Phase 2: In-memory computation (0 DB round trips) =====
        let correctTotal = 0;
        let wrongTotal = 0;

        const wrongTags: string[] = [];
        const guessedTags: string[] = [];
        const correctTags: string[] = [];
        const skillPoints: string[] = [];

        const newMasteryStates: Array<{
            userId: string; subject: string; tagName: string;
            masteryState: number; probability: number;
            totalTested: number; correctCount: number; guessedCount: number;
        }> = [];
        const masteryUpdates: Array<{
            id: string; masteryState: number; probability: number;
            totalTested: number; correctCount: number; guessedCount: number;
        }> = [];

        const errorItemsToCreate: Array<{
            data: {
                userId: string; subjectId: string; originalImageUrl: string;
                questionText: string; answerText: string; analysis: string;
                wrongAnswerText: string; mistakeAnalysis: string;
                mistakeStatus: string; gradeSemester: string; masteryLevel: number;
                tags?: { connect: { id: string }[] };
            };
        }> = [];

        for (const ans of answers) {
            const isTrulyMastered = ans.isCorrect && !ans.isGuessed;

            if (ans.isCorrect) {
                correctTotal += 1;
                if (ans.isGuessed) {
                    guessedTags.push(ans.tag);
                } else {
                    correctTags.push(ans.tag);
                }
            } else {
                wrongTotal += 1;
                wrongTags.push(ans.tag);
            }

            // Extract skill point from explanation
            if (ans.explanation) {
                const lastSentence = ans.explanation.split(/[。\n]/).filter(s => s.trim()).pop();
                if (lastSentence && (lastSentence.includes('考察') || lastSentence.includes('能力') || lastSentence.includes('核心'))) {
                    skillPoints.push(lastSentence.trim());
                }
            }

            // Compute BKT values
            const existing = masteryMap.get(ans.tag);
            const newTotalTested = (existing?.totalTested || 0) + 1;
            const newCorrectCount = (existing?.correctCount || 0) + (ans.isCorrect ? 1 : 0);
            const newGuessedCount = (existing?.guessedCount || 0) + (ans.isGuessed ? 1 : 0);

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

            if (existing) {
                masteryUpdates.push({
                    id: existing.id,
                    masteryState: newMasteryState,
                    probability: newProbability,
                    totalTested: newTotalTested,
                    correctCount: newCorrectCount,
                    guessedCount: newGuessedCount,
                });
            } else {
                newMasteryStates.push({
                    userId, subject, tagName: ans.tag,
                    masteryState: newMasteryState,
                    probability: newProbability,
                    totalTested: newTotalTested,
                    correctCount: newCorrectCount,
                    guessedCount: newGuessedCount,
                });
            }

            // Collect error items for archival (wrong or guessed)
            if (!isTrulyMastered) {
                const tagId = tagIdMap.get(ans.tag);
                errorItemsToCreate.push({
                    data: {
                        userId,
                        subjectId: "", // filled after subject upsert
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
                        tags: tagId ? { connect: [{ id: tagId }] } : undefined,
                    }
                });
            }
        }

        // Build practice records for all answers
        const practiceRecords = answers.map(ans => ({
            userId,
            subject: subjectDisplayName,
            isCorrect: ans.isCorrect,
            source: "diagnostic",
        }));

        // ===== Phase 3: Subject upsert (1 round trip) =====
        const userSubjectObj = await prisma.subject.upsert({
            where: { name_userId: { name: subjectDisplayName, userId } },
            create: { name: subjectDisplayName, userId },
            update: {},
        });

        // Fill subjectId into error items
        errorItemsToCreate.forEach(item => { item.data.subjectId = userSubjectObj.id; });

        // ===== Phase 4: Batch transaction write (1 round trip commit) =====
        // Build transaction operations array (ordered: tags first so ErrorItem connect works)
        const txOps: Prisma.PrismaPromise<any>[] = [];

        // 1. Create missing KnowledgeTags (batch)
        if (missingTags.length > 0) {
            txOps.push(prisma.knowledgeTag.createMany({ data: missingTags }));
        }

        // 2. Create new KnowledgeMasteryStates (batch)
        if (newMasteryStates.length > 0) {
            txOps.push(prisma.knowledgeMasteryState.createMany({ data: newMasteryStates }));
        }

        // 3. Update existing KnowledgeMasteryStates
        for (const u of masteryUpdates) {
            txOps.push(prisma.knowledgeMasteryState.update({
                where: { id: u.id },
                data: {
                    masteryState: u.masteryState,
                    probability: u.probability,
                    totalTested: u.totalTested,
                    correctCount: u.correctCount,
                    guessedCount: u.guessedCount,
                }
            }));
        }

        // 4. Create ErrorItems with tag connections
        for (const item of errorItemsToCreate) {
            txOps.push(prisma.errorItem.create({ data: item.data }));
        }

        // 5. Create PracticeRecords (batch) — links diagnostic to practice stats
        txOps.push(prisma.practiceRecord.createMany({ data: practiceRecords }));

        // 6. Create DiagnosticQuizRecord
        txOps.push(prisma.diagnosticQuizRecord.create({
            data: {
                userId, subject, grade,
                chapters: JSON.stringify(selectedChapters),
                score: correctTotal,
                totalCount: answers.length,
                detailJson: JSON.stringify(answers)
            }
        }));

        await prisma.$transaction(txOps);

        // ===== Generate natural language report =====
        const strengths: string[] = [];
        if (correctTags.length > 0) {
            strengths.push(`掌握良好：${correctTags.join("、")}`);
        }

        const weaknesses: string[] = [];
        if (wrongTags.length > 0) {
            weaknesses.push(`存在薄弱：${[...new Set(wrongTags)].join("、")}`);
        }
        if (guessedTags.length > 0) {
            weaknesses.push(`凭直觉猜对（侥幸项）：${[...new Set(guessedTags)].join("、")}`);
        }

        const skillSummary = [...new Set(skillPoints)].slice(0, 5);

        const reportSummary = [
            strengths.length > 0 ? `✅ ${strengths.join("；")}` : null,
            weaknesses.length > 0 ? `⚠️ ${weaknesses.join("；")}` : null,
            skillSummary.length > 0 ? `🔍 核心能力卡点：${skillSummary.join("；")}` : null,
        ].filter(Boolean).join("\n");

        return NextResponse.json({
            success: true,
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
