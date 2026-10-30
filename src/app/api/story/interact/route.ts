import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorized, badRequest, internalError } from "@/lib/api-errors";
import { getAIService } from "@/lib/ai";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:story:interact');

const STAGE_TITLES: Record<number, string> = {
    1: "第一卷：普通班后排的逆袭者",
    2: "第二卷：月考黑马与全校放榜",
    3: "第三卷：拔尖集训与奥赛强基",
    4: "第四卷：特招登顶与真理学神",
};

interface InteractPayload {
    action: string;
    isOptionSelection?: boolean;
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return unauthorized();
    }

    // @ts-ignore
    const userId = session.user.id;

    try {
        const body = (await req.json()) as InteractPayload;
        const { action, isOptionSelection } = body;

        if (!action || typeof action !== 'string' || !action.trim()) {
            return badRequest("作答或对话内容不可为空");
        }

        const trimmedAction = action.trim();

        // 1. 获取会话
        const storySession = await prisma.systemStorySession.findUnique({
            where: { userId }
        });

        if (!storySession) {
            return badRequest("请先初始化剧情会话");
        }

        // 2. 解析当前挂起的怪谈事件
        let currentEvent: any = null;
        if (storySession.currentEventJson) {
            try {
                currentEvent = JSON.parse(storySession.currentEventJson);
            } catch (e) { /* ignore */ }
        }

        const hasActiveExercise = !!(currentEvent && currentEvent.exercise && currentEvent.exercise.correctAnswer);

        // 判断用户的输入是“正式作答”还是“向系统提问/讨论推导”
        // 判定条件：直接点了选项按钮，或者内容为单字母 A/B/C/D，或者以“我选/答案是”开头，或者当题目无选项且输入简短
        const isAnswerAttempt = isOptionSelection
            || /^[A-Da-d]$/.test(trimmedAction)
            || /^(我选|答案是|选择)\s*[A-Da-d]/i.test(trimmedAction)
            || (hasActiveExercise && (!currentEvent.exercise.options || currentEvent.exercise.options.length === 0) && trimmedAction.length <= 20 && !trimmedAction.includes("？") && !trimmedAction.includes("?"));

        // ==========================================
        // 分支 A: 结算作答 (正式提交答案 -> 四路数据闭环)
        // ==========================================
        if (hasActiveExercise && isAnswerAttempt) {
            const ex = currentEvent.exercise;
            const correctAnswer = String(ex.correctAnswer || "").trim();
            const tag = String(ex.tag || "怪谈法则").trim();

            // 提取选项字母
            let cleanUserAns = trimmedAction;
            const optMatch = trimmedAction.match(/[A-Da-d]/);
            if (ex.options && ex.options.length > 0 && optMatch) {
                cleanUserAns = optMatch[0].toUpperCase();
            }

            // 判定正误
            let isCorrect = false;
            if (ex.options && Array.isArray(ex.options) && ex.options.length > 0) {
                isCorrect = cleanUserAns.toUpperCase() === correctAnswer.toUpperCase();
            } else {
                const normalize = (s: string) => s.replace(/[\s\$,\\，。]/g, '').toLowerCase();
                isCorrect = normalize(cleanUserAns) === normalize(correctAnswer) || cleanUserAns.toLowerCase().includes(normalize(correctAnswer));
            }

            // AI 生成都市学霸打脸/反思结算剧情
            const systemPrompt = `你是绑定在宿重视网膜中的高维真理系统「天玑」。当前场景为写实都市高中校园。
【当前冲突情境】：${currentEvent.dialogue}
【考核考点】：${tag}
【正确标准答案】：${correctAnswer}
【题目官方解析】：${ex.explanation || "无"}
【宿主交出的答卷】：${cleanUserAns}
【推演判定】：${isCorrect ? "【推演成功 / 完美逆袭】" : "【推演偏差 / 遗憾失误】"}

【输出契约（严格返回合法 JSON，禁止任何 Markdown 标记）】：
{
  "dialogue": "结算小说段落（160-280字）。答对时：以【叮！真理判定达成】开头，写实生动描写宿主轻描淡写或笃定报出答案/推导，瞬间击溃挑衅学霸的傲慢（或让讲台上的任课老师愣在原地、全班同学惊骇哗然），反差爽感拉满，系统结算学神积分；答错时：以【警告！推演偏差】开头，指出宿主在物理/数学公式或边界条件上的致命盲区，提醒不可自满轻敌，并记录进错题档案。必须保持都市学霸爽文的快节奏镜头感。",
  "pointsDelta": ${isCorrect ? 35 : 0}
}`;

            const aiService = getAIService();
            let settleDialogue = "";
            let pointsDelta = isCorrect ? 35 : 0;

            try {
                const aiResponse = await aiService.generateText(systemPrompt, "请根据判定结果生成本次校园冲突的推演结算播报。");
                const parsed = parseSettleJson(aiResponse);
                if (parsed?.dialogue) {
                    settleDialogue = parsed.dialogue;
                    if (typeof parsed.pointsDelta === 'number') {
                        pointsDelta = Math.max(0, Math.min(100, parsed.pointsDelta));
                    }
                }
            } catch (e) {
                logger.warn({ error: e }, "AI settle narration failed, using fallback");
            }

            if (!settleDialogue) {
                settleDialogue = isCorrect
                    ? `【叮！真理判定达成】宿主从容报出答案 [${cleanUserAns}]！公式推导严丝合缝，正中破题要害。原本带着嘲讽与看热闹的目光瞬间凝固，周围鸦雀无声。学神积分 +${pointsDelta} SP，盲区「${tag}」掌握度大幅提升！`
                    : `【警告！推演偏差】宿主给出的解 [${cleanUserAns}] 踩中了典型概念陷阱（标准答案应为 [${correctAnswer}]）。系统已捕获该逻辑断层，强制收录入「错题档案库」，提醒宿主摒除浮躁，戒骄戒躁。`;
            }

            // 四路数据闭环 (事务)
            const subjectDisplayName = storySession.subject === 'math' ? '数学' : '物理';
            const subjectKey = storySession.subject;

            let subjectObj = await prisma.subject.findFirst({
                where: { userId, name: { contains: subjectDisplayName } }
            });
            if (!subjectObj) {
                subjectObj = await prisma.subject.create({
                    data: { userId, name: subjectDisplayName }
                });
            }

            let tagObj = await prisma.knowledgeTag.findFirst({
                where: { subject: subjectKey, name: tag }
            });
            if (!tagObj) {
                tagObj = await prisma.knowledgeTag.create({
                    data: { name: tag, subject: subjectKey, isSystem: true }
                });
            }

            const existingBkt = await prisma.knowledgeMasteryState.findUnique({
                where: { userId_subject_tagName: { userId, subject: subjectKey, tagName: tag } }
            });

            const newTotal = (existingBkt?.totalTested || 0) + 1;
            const newCorrect = (existingBkt?.correctCount || 0) + (isCorrect ? 1 : 0);
            const newProb = Math.min(1.0, Math.max(0.0, newCorrect / newTotal));
            let newMasteryState = 1;
            if (isCorrect) {
                newMasteryState = (newProb >= 0.8 && newCorrect >= 2) ? 3 : 2;
            }

            const newEventCount = storySession.eventCount + 1;
            const newStreak = isCorrect ? storySession.streak + 1 : 0;
            const newPoints = storySession.points + pointsDelta;
            const newStage = Math.min(4, 1 + Math.floor(newEventCount / 5));
            const newStageTitle = STAGE_TITLES[newStage] || storySession.stageTitle;
            const newLevel = 1 + Math.floor(newPoints / 150);

            // 错题正规化格式
            let fullQuestionText = ex.questionText || "";
            if (ex.options && Array.isArray(ex.options) && ex.options.length > 0) {
                const formattedOptions = ex.options.map((opt: string, idx: number) => {
                    const letter = String.fromCharCode(65 + idx);
                    return opt.trim().match(/^[A-D][.、\s]/i) ? opt.trim() : `${letter}. ${opt.trim()}`;
                });
                fullQuestionText += "\n\n" + formattedOptions.join("\n");
            }

            await prisma.$transaction(async (tx) => {
                // 1. 练习记录 (source: story)
                await tx.practiceRecord.create({
                    data: {
                        userId,
                        subject: subjectDisplayName,
                        isCorrect,
                        difficulty: "medium",
                        source: "story",
                    }
                });

                // 2. BKT 掌握度状态更新
                await tx.knowledgeMasteryState.upsert({
                    where: { userId_subject_tagName: { userId, subject: subjectKey, tagName: tag } },
                    create: {
                        userId,
                        subject: subjectKey,
                        tagName: tag,
                        masteryState: newMasteryState,
                        probability: newProb,
                        totalTested: newTotal,
                        correctCount: newCorrect,
                    },
                    update: {
                        masteryState: newMasteryState,
                        probability: newProb,
                        totalTested: newTotal,
                        correctCount: newCorrect,
                    }
                });

                // 3. 做错时归档到 ErrorItem
                if (!isCorrect) {
                    await tx.errorItem.create({
                        data: {
                            userId,
                            subjectId: subjectObj.id,
                            originalImageUrl: "/icons/icon.png",
                            questionText: fullQuestionText,
                            answerText: correctAnswer,
                            analysis: ex.explanation || "规则怪谈异化推演错题",
                            wrongAnswerText: `宿主提交抉择: ${cleanUserAns}`,
                            mistakeAnalysis: `在校园规则怪谈【${currentEvent.eventType || "异常事件"}】中陷入真理盲区「${tag}」。`,
                            mistakeStatus: "wrong_attempt",
                            gradeSemester: storySession.grade,
                            masteryLevel: 0,
                            tags: { connect: [{ id: tagObj.id }] }
                        }
                    });
                }

                // 4. 会话解除挂起状态
                await tx.systemStorySession.update({
                    where: { userId },
                    data: {
                        points: newPoints,
                        level: newLevel,
                        streak: newStreak,
                        eventCount: newEventCount,
                        stage: newStage,
                        stageTitle: newStageTitle,
                        currentEventJson: null,
                    }
                });

                // 5. 对话消息持久化
                await tx.storyChatMessage.create({
                    data: {
                        userId,
                        sessionId: storySession.id,
                        role: "user",
                        type: "answer",
                        content: cleanUserAns,
                    }
                });

                await tx.storyChatMessage.create({
                    data: {
                        userId,
                        sessionId: storySession.id,
                        role: "system",
                        type: "settle",
                        content: settleDialogue,
                        questionDataJson: JSON.stringify({
                            isCorrect,
                            pointsDelta,
                            tag,
                            correctAnswer,
                            userAnswer: cleanUserAns,
                        }),
                    }
                });
            });

            return NextResponse.json({
                success: true,
                isCorrect,
                pointsDelta,
                settleDialogue,
                hud: {
                    level: newLevel,
                    points: newPoints,
                    stage: newStage,
                    stageTitle: newStageTitle,
                    streak: newStreak,
                    eventCount: newEventCount,
                    hasCurrentEvent: false,
                }
            });
        }

        // ==========================================
        // 分支 B: 向系统请教思路 / 自由打字推演 (不判错，保持任务挂起)
        // ==========================================
        const exContext = hasActiveExercise
            ? `【当前正处于校园挑战/解题对决中】：
现场冲突情境：${currentEvent.dialogue}
面临的数理考题：${currentEvent.exercise.questionText}
考查知识点：${currentEvent.exercise.tag}
请注意：宿主当前在与你讨论解题思路、推导演算或求助点拨。你必须扮演冷峻精准的学霸系统金手指，一针见血点出关键定理、临界状态或受力分析的破题口，启发宿主自己算出最终答案去打脸，严禁直接把答案喂给宿主！`
            : `【当前环境】：处于课间/自习闲暇状态。`;

        const systemPrompt = `你是绑定在宿重视网膜中的高维真理推演系统「天玑」。当前为写实都市高中校园逆袭世界。
【宿主当前学神等级】：Lv.${storySession.level} | 学神积分 ${storySession.points} SP。
${exContext}

【宿主对你发出的思维通讯】：
"${trimmedAction}"

【回应要求】：
以冷峻、干练、略带严厉的系统播报腔调回应宿主（80-180字）。
点拨其物理/数学思考路径，助其在现实校园中打破认知局限。严禁动漫卖萌或恐怖灵异废话。`;

        const aiService = getAIService();
        const reply = await aiService.generateText(systemPrompt, trimmedAction);

        // 持久化这两条自由互动消息
        await prisma.$transaction([
            prisma.storyChatMessage.create({
                data: {
                    userId,
                    sessionId: storySession.id,
                    role: "user",
                    type: "dialogue",
                    content: trimmedAction,
                }
            }),
            prisma.storyChatMessage.create({
                data: {
                    userId,
                    sessionId: storySession.id,
                    role: "system",
                    type: "dialogue",
                    content: reply.trim(),
                }
            }),
        ]);

        return NextResponse.json({
            success: true,
            reply: reply.trim(),
            keptActive: hasActiveExercise, // 告知前端题目依然挂起，可以继续作答
        });

    } catch (error) {
        logger.error({ error }, "Failed to process story interaction");
        return internalError("处理系统互动失败，请稍后重试");
    }
}

function parseSettleJson(response: string): { dialogue?: string; pointsDelta?: number } | null {
    try {
        let cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        cleaned = cleaned.substring(start, end + 1);

        cleaned = cleaned
            .replace(/\\\\/g, '\u0000DBL_BS\u0000')
            .replace(/\\([^"\\\/bfnrtu])/g, '\\\\$1')
            .replace(/\u0000DBL_BS\u0000/g, '\\\\');

        return JSON.parse(cleaned);
    } catch (e) {
        return null;
    }
}

function objStartSafe(str: string): number {
    return str.indexOf('{');
}
