import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorized, internalError } from "@/lib/api-errors";
import { getAIService } from "@/lib/ai";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:story:event');

const STAGE_TITLES: Record<number, string> = {
    1: "第一卷：普通班后排的逆袭者",
    2: "第二卷：月考黑马与全校放榜",
    3: "第三卷：拔尖集训与奥赛强基",
    4: "第四卷：特招登顶与真理学神",
};

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return unauthorized();
    }

    // @ts-ignore
    const userId = session.user.id;

    try {
        let body: any = {};
        try {
            body = await req.json();
        } catch (e) { /* empty body is ok */ }
        const force = !!body?.force;

        // ===== 1. 加载剧情会话与学情数据 =====
        let storySession = await prisma.systemStorySession.findUnique({
            where: { userId }
        });

        if (!storySession) {
            storySession = await prisma.systemStorySession.create({
                data: {
                    userId,
                    stage: 1,
                    stageTitle: STAGE_TITLES[1],
                    points: 0,
                    level: 1,
                    streak: 0,
                }
            });
        }

        // 若上一事件未结算且非强制重置，提示继续作答
        if (storySession.currentEventJson && !force) {
            try {
                const existing = JSON.parse(storySession.currentEventJson);
                return NextResponse.json({
                    success: true,
                    event: existing,
                    alreadyActive: true,
                });
            } catch (e) { /* parse error, recreate */ }
        }

        // 聚合学情：薄弱知识点 + 最近错题
        const [weakStates, recentErrors, allMessages] = await Promise.all([
            prisma.knowledgeMasteryState.findMany({
                where: { userId, subject: storySession.subject },
                orderBy: { probability: 'asc' },
                take: 8,
            }),
            prisma.errorItem.findMany({
                where: { userId, masteryLevel: 0 },
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: { questionText: true, mistakeAnalysis: true }
            }),
            prisma.storyChatMessage.count({ where: { userId } }),
        ]);

        // ===== 2. L3 记忆压缩：超过 40 条时压缩旧消息为摘要 =====
        let summary = storySession.summary || "";
        if (allMessages > 40) {
            const oldMessages = await prisma.storyChatMessage.findMany({
                where: { userId },
                orderBy: { createdAt: 'asc' },
                take: allMessages - 20,
                select: { role: true, type: true, content: true },
            });

            if (oldMessages.length > 5) {
                summary = await compressMemory(summary, oldMessages);
                const keepIds = await prisma.storyChatMessage.findMany({
                    where: { userId },
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    select: { id: true },
                });
                await prisma.storyChatMessage.deleteMany({
                    where: {
                        userId,
                        id: { notIn: keepIds.map(m => m.id) }
                    }
                });
            }
        }

        // ===== 3. 构建都市写实学霸系统 Prompt =====
        const weakTagList = weakStates.map(w => w.tagName);
        const weakSummary = weakTagList.length > 0
            ? weakTagList.join("、")
            : "（暂无扫描漏洞，从当前学科基础高频考点中选取）";

        const recentErrorSummary = recentErrors.length > 0
            ? recentErrors.map((e, i) => `${i + 1}. ${e.questionText?.substring(0, 60) || "（无题干）"} [${e.mistakeAnalysis?.substring(0, 30) || ""}]`).join("\n")
            : "（无未掌握历史错题）";

        const systemPrompt = buildScholarStoryPrompt(storySession, summary, weakSummary, recentErrorSummary);

        const userPrompt = `【校园日常突发事件触发】：请根据宿主在现实数据库中的真实薄弱知识点，在当前写实校园日常中推进一段生动、接地气的逆袭事件。
要求具备强烈的高中生活代入感与扮猪吃虎的爽感，配套题目必须切中宿主的薄弱知识点，严格按规范 JSON 双轨输出。`;

        const aiService = getAIService();
        const aiResponse = await aiService.generateText(systemPrompt, userPrompt);

        // ===== 4. 解析双轨响应 =====
        const parsed = parseDualPayload(aiResponse);
        if (!parsed) {
            logger.error({ rawResponse: aiResponse }, "Failed to parse scholar story event dual-payload");
            return internalError("剧情事件推演解析失败，请重试");
        }

        const { dialogue, dataSync } = parsed;
        const exerciseData = dataSync?.exerciseData;
        const hasExercise = dataSync?.hasExercise !== false && !!exerciseData?.questionText;

        const eventPayload = {
            eventType: dataSync?.eventType || "mock_clash",
            dialogue,
            exercise: hasExercise ? {
                tag: exerciseData.tag,
                questionText: exerciseData.questionText,
                svgCode: exerciseData.svgCode || "",
                options: exerciseData.options || [],
                correctAnswer: exerciseData.correctAnswer,
                explanation: exerciseData.explanation,
            } : null,
        };

        // ===== 5. 持久化 =====
        await prisma.$transaction([
            prisma.storyChatMessage.create({
                data: {
                    userId,
                    sessionId: storySession.id,
                    role: "system",
                    type: "event",
                    content: dialogue,
                    questionDataJson: JSON.stringify(eventPayload),
                }
            }),
            prisma.systemStorySession.update({
                where: { userId },
                data: {
                    currentEventJson: JSON.stringify(eventPayload),
                    summary,
                    stageTitle: STAGE_TITLES[storySession.stage] || storySession.stageTitle,
                }
            }),
        ]);

        return NextResponse.json({
            success: true,
            event: eventPayload,
        });

    } catch (error) {
        logger.error({ error }, "Failed to generate scholar story event");
        return internalError("生成剧情事件失败，请稍后重试");
    }
}

// 构建系统 Prompt：真实校园日常 + 都市学霸系统逆袭爽文
function buildScholarStoryPrompt(
    storySession: { stage: number; stageTitle: string; points: number; level: number; streak: number; subject: string; grade: string; eventCount: number },
    summary: string,
    weakSummary: string,
    recentErrorSummary: string,
): string {
    return `你是「天玑」，一位绑定在宿重视网膜中的高维真理推演系统。
【核心世界观与基调】：
这是原汁原味的【都市高中学霸系统爽文】。宿主原本是一名普通的重点高中学生，成绩平平，在班里属于容易被忽视的后排生。
但由于觉醒了你——高维推演系统，宿主获得了通往“真理学神”的登顶通道！
**“有系统本身已经是最大的爽文设定”**：
- 场景必须 100% 写实接地气：闷热的黄昏教室、堆满五年高考三年模拟的课桌、晚自习吱呀转动的风扇、严厉敲黑板的任课老师、前排成绩好且眼高于顶的学霸课代表、放学前的突击小测。
- 严禁任何克苏鲁、恐怖血肉、鬼怪怪谈或脱离现实的异世界玄幻设定！
- 核心爽点在于：面对同学轻视、老师抽查、大考倒计时等真实校园现实压力，宿主在系统的冷峻算力辅助下，洞悉题目破绽、秒杀压轴题、当场打脸翻盘、引发全班震撼！

【语气风格】：
- 冷峻、理性、干练的系统流播报音（如【叮！】、【检测到现实冲突】、【发布日常主线】、【目标道心受损】）。
- 绝不搞动漫卖萌，文字精炼，充满网文小说的镜头感与反差装逼感。
- 严禁直接剧透最终答案，引导宿主亲自运用数理逻辑破解困局。

【当前剧情卷目】：${storySession.stageTitle}（已完成事件：${storySession.eventCount} 起）
【宿主学神档案】：战力阶位 Lv.${storySession.level} | 学神积分 ${storySession.points} SP | 逆袭连胜 ${storySession.streak}
【当前攻坚学科】：${storySession.subject === 'math' ? '数学' : '物理'}（${storySession.grade}）

【宿主现实知识漏洞（本次冲突的核心题目考点，必须从中选取）】：
${weakSummary}

【宿主近期做错的题目残响（可作为试卷错题重现的情境）】：
${recentErrorSummary}

【过往剧情纪要（保持剧情连贯）】：
${summary || "（宿主刚刚在平常的自习课上感知到天玑系统的降临，逆袭之路刚刚开启）"}

【校园日常事件形态（请根据情境轮换，保持新鲜感）】：
1. mock_clash（学霸挑衅 / 课代表打赌）：前排傲气的学霸拿着一道模拟卷压轴题在宿主课桌前冷嘲热讽，嘲笑宿主看不懂，系统发布打脸任务。
2. teacher_quiz（讲台公开处刑 / 老师突击点名）：物理/数学老师带着威压扫视全班，点名宿主上讲台在黑板板书受力分析或公式推导，全班投来同情目光。
3. detective_debug（侦探纠错 / 揪出荒谬步骤）：系统投射出某学霸或宿主自己昨晚在草稿纸上的连环推导演算，题目要求宿主指认哪一步骤概念混淆、逻辑翻车。
4. classmate_help（同桌求救 / 费曼点拨）：绝望的同桌或隔壁组同学被难题折磨抓狂，系统发布指点任务，宿主一针见血用最精辟的一句话点醒对方。

【输出契约（严格返回合法 JSON，禁止任何 Markdown 标记或多余字符）】：
JSON 字符串中的反斜杠必须规范转义（如 LaTeX 的 \\\\frac, \\\\theta, \\\\Delta），双引号规范转义：
{
  "dialogue": "本幕剧情文本（200-360字，包含生动的校园环境描写、现实人物对白挑衅或老师点名带来的压迫感、系统冷峻发布的任务与奖励提示，结尾引出题目）",
  "dataSync": {
    "eventType": "mock_clash",
    "hasExercise": true,
    "exerciseData": {
      "tag": "知识点名称（必须是宿主盲区中的一项，如：共点力的平衡）",
      "questionText": "正规严密的题目描述（如模拟卷或黑板上的标准高考/期末题干）",
      "svgCode": "若涉及几何图形、受力分解图、电路示意，输出规范干净的 SVG 代码（<svg viewBox=\\\"0 0 400 240\\\" ...>），否则为空字符串",
      "options": ["A. 选项A内容", "B. 选项B内容", "C. 选项C内容", "D. 选项D内容"],
      "correctAnswer": "A",
      "explanation": "正规物理/数学原理深度解析，最后一句指出核心能力点"
    }
  }
}`;
}

async function compressMemory(existingSummary: string, oldMessages: Array<{ role: string; type: string; content: string }>): Promise<string> {
    try {
        const transcript = oldMessages
            .slice(0, 30)
            .map(m => `[${m.role}] ${m.content.substring(0, 150)}`)
            .join("\n");

        const aiService = getAIService();
        const response = await aiService.generateText(
            "你是都市学霸逆袭小说的剧情记录官。请将以下宿主在校园中的逆袭历程与系统交互浓缩为 300 字以内的档案摘要（保留关键人物冲突、攻克的知识点、考试与挑战结果）。只返回纯文本摘要。",
            `【已有档案】:\n${existingSummary || "（无）"}\n\n【最新记录】:\n${transcript}`
        );
        return response.trim().substring(0, 2000);
    } catch (e) {
        return existingSummary;
    }
}

function parseDualPayload(response: string): { dialogue: string; dataSync?: { eventType?: string; hasExercise?: boolean; exerciseData?: { tag: string; questionText: string; svgCode?: string; options?: string[]; correctAnswer: string; explanation: string }; pointsDelta?: number } } | null {
    try {
        let cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        const objStart = cleaned.indexOf('{');
        const objEnd = cleaned.lastIndexOf('}');
        if (objStart === -1 || objEnd === -1) return null;
        cleaned = cleaned.substring(objStart, objEnd + 1);

        cleaned = cleaned
            .replace(/\\\\/g, '\u0000DBL_BS\u0000')
            .replace(/\\([^"\\\/bfnrtu])/g, '\\\\$1')
            .replace(/\u0000DBL_BS\u0000/g, '\\\\');

        return JSON.parse(cleaned);
    } catch (e) {
        return null;
    }
}
