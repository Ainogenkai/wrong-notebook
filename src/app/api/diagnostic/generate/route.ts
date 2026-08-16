import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorized, badRequest, internalError } from "@/lib/api-errors";
import { getAIService } from "@/lib/ai";
import { createLogger } from "@/lib/logger";
import { MATH_CURRICULUM } from "@/lib/tag-data/math";
import { PHYSICS_CURRICULUM } from "@/lib/tag-data/physics";

const logger = createLogger('api:diagnostic:generate');

export interface DiagnosticQuestion {
    id: string;
    chapter: string;
    tag: string;
    type: "choice" | "blank";
    questionText: string;
    svgCode?: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
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
        const { subject, grade, selectedChapters, questionCount = 6 } = body;

        if (!subject || !grade || !Array.isArray(selectedChapters) || selectedChapters.length === 0) {
            return badRequest("Missing required parameters: subject, grade, or selectedChapters");
        }

        // 提取所选章节包含的官方标准知识点标签
        let tags: Array<{ chapter: string; tag: string }> = [];

        if (subject === "math") {
            const gradeData = MATH_CURRICULUM[grade];
            if (gradeData) {
                gradeData.forEach(ch => {
                    if (selectedChapters.includes(ch.chapter)) {
                        ch.sections.forEach(sec => {
                            sec.tags.forEach(t => {
                                tags.push({ chapter: ch.chapter, tag: t });
                            });
                        });
                    }
                });
            }
        } else if (subject === "physics") {
            const gradeData = PHYSICS_CURRICULUM[grade];
            if (gradeData) {
                gradeData.forEach(ch => {
                    if (selectedChapters.includes(ch.chapter)) {
                        ch.tags.forEach(t => {
                            tags.push({ chapter: ch.chapter, tag: t });
                        });
                    }
                });
            }
        }

        if (tags.length === 0) {
            return badRequest("No valid knowledge tags found for selected chapters");
        }

        // ===== 智能去重：调取历史测试记录与掌握状态 =====
        // 1. 获取该用户该学科的所有掌握状态
        const masteryStates = await prisma.knowledgeMasteryState.findMany({
            where: { userId, subject }
        });
        const masteryMap = new Map<string, number>();
        masteryStates.forEach(ms => {
            masteryMap.set(ms.tagName, ms.masteryState);
        });

        // 2. 获取历史诊断记录中的题目摘要（用于防重复）
        const historyRecords = await prisma.diagnosticQuizRecord.findMany({
            where: { userId, subject },
            orderBy: { createdAt: 'desc' },
            take: 5, // 最近5次记录
        });

        let historyQuestionTexts: string[] = [];
        for (const rec of historyRecords) {
            try {
                const details = JSON.parse(rec.detailJson) as Array<{
                    questionText: string;
                    tag: string;
                }>;
                details.forEach(d => {
                    if (d.questionText) {
                        historyQuestionTexts.push(d.questionText.substring(0, 80));
                    }
                });
            } catch (e) { /* 忽略解析失败 */ }
        }

        // 3. 智能选取知识点：优先选未测试(⚪)和薄弱(🔴)的
        const untestedTags = tags.filter(t => !masteryMap.has(t.tag) || masteryMap.get(t.tag) === 0);
        const weakTags = tags.filter(t => masteryMap.get(t.tag) === 1);
        const developingTags = tags.filter(t => masteryMap.get(t.tag) === 2);
        const masteredTags = tags.filter(t => masteryMap.get(t.tag) === 3);

        // 按优先级排序：未测试 > 薄弱 > 初步 > 稳固
        let prioritizedTags = [...untestedTags, ...weakTags, ...developingTags, ...masteredTags];

        // 打乱同优先级内的顺序（交错测试）
        const shuffleGroup = (arr: typeof prioritizedTags) => [...arr].sort(() => 0.5 - Math.random());
        const shuffledUntested = shuffleGroup(untestedTags);
        const shuffledWeak = shuffleGroup(weakTags);
        const shuffledDeveloping = shuffleGroup(developingTags);
        const shuffledMastered = shuffleGroup(masteredTags);
        prioritizedTags = [...shuffledUntested, ...shuffledWeak, ...shuffledDeveloping, ...shuffledMastered];

        const targetTags = prioritizedTags.slice(0, Math.min(questionCount, prioritizedTags.length));

        // 4. 构建历史题目摘要文本（注入提示词防重复）
        const historySummary = historyQuestionTexts.length > 0
            ? `\n【历史已出过的题目摘要（请勿重复或高度相似）】:\n${historyQuestionTexts.map((t, i) => `${i + 1}. ${t}...`).join("\n")}\n`
            : "";

        const systemPrompt = `你是一位顶级中学${subject === 'math' ? '数学' : '物理'}教师，擅长生成贴近真实历史工程与生活情境的诊断试题。请根据人教版${grade}教材大纲，为以下选定章节生成一份20分钟快速能力扫描题库。`;

        const userPrompt = `【所选章节】: ${selectedChapters.join(", ")}
【目标考察知识点列表】:
${targetTags.map((t, idx) => `${idx + 1}. [章节: ${t.chapter}] 知识点: ${t.tag}`).join("\n")}
${historySummary}
【生成要求】:
1. 总共生成 ${targetTags.length} 道题目，每道题严格对应上述列表中的一个知识点。
2. 题型必须包含单项选择题（choice）或关键步骤填空/精简计算题（blank）。
3. 【严禁超纲】：题目难度控制在人教版${grade}基础到中等水平，切勿出现更高级年级或超纲概念。这是快速诊断，不是竞赛，不要出偏题怪题。
4. 【情境化包装与图形规范】：
   - 尽量将题目包装为贴近真实历史工程、生活场景的情境题（如二战雷达测距、古代建筑测量、航海导航等），但底层数学/物理模型必须严谨且符合大纲。
   - 【SVG 绘图规范】：若题目涉及几何图形、函数图像、立体几何（隐藏边需用虚线 stroke-dasharray="4" 绘制）、物体受力分析（含坐标轴、力向量箭头）、简单电路图（电源、电阻、开关等），**必须**在 svgCode 字段中输出干净规范的 SVG 代码。标签使用 <svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg">，配色简洁美观（如使用 navy/teal/slate/coral 等深色线条与轻微填充）。
   - 【无图强约束】：若该题没有输出 svgCode，题目文字必须为 **100% 纯文本自包含表述**，**严禁**出现“如图所示”、“如下图”、“见图”、“如图”等任何指代图形的词汇！
5. 选择题必须提供 4 个选项 (A, B, C, D) 且只有一个正确答案。
6. 填空/精简题解答需保持简明，直接给出核心步骤的短数字或短文本答案。
7. 题目内容中的数学/物理公式使用 LaTeX 格式，JSON 字符串中所有的 LaTeX 反斜杠必须双写转义 (例如 \\\\v = \\\\v_0 + at, \\\\frac{a}{b}, \\\\theta, \\\\pi)。
8. 每道题的 explanation 字段中，除了给出解析外，请用一句话指出"这道题考察的核心能力点是什么"（如"受力分析"、"公式变形"、"图像判定"、"含参讨论"等）。

【返回 JSON 格式要求】：
必须严格返回合法 JSON 格式数组，不要包含任何 Markdown 标记或多余文字。JSON 字符串内的双引号和反斜杠请严格遵守 JSON 转义规则：
[
  {
    "id": "q1",
    "chapter": "章节名称",
    "tag": "知识点名称",
    "type": "choice",
    "questionText": "题目描述文本",
    "svgCode": "<svg viewBox=\\\"0 0 400 240\\\" xmlns=\\\"http://www.w3.org/2000/svg\\\">...</svg>",
    "options": ["A. xxx", "B. xxx", "C. xxx", "D. xxx"],
    "correctAnswer": "A",
    "explanation": "简要解析 + 核心能力点说明"
  }
]`;

        const aiService = getAIService();
        const aiResponse = await aiService.generateText(systemPrompt, userPrompt);

        // 解析 AI 返回的 JSON 字符串
        let questions: DiagnosticQuestion[] = [];
        try {
            let cleanedResponse = aiResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

            // 尝试提取 JSON 数组
            const arrStart = cleanedResponse.indexOf('[');
            const arrEnd = cleanedResponse.lastIndexOf(']');
            if (arrStart !== -1 && arrEnd !== -1) {
                cleanedResponse = cleanedResponse.substring(arrStart, arrEnd + 1);
            }

            // 安全修复 AI 返回 JSON 中非标准反斜杠转义（如 LaTeX 的 \frac \theta \Delta）
            // 1. 保护合法双反斜杠 \\
            cleanedResponse = cleanedResponse.replace(/\\\\/g, '\u0000DBL_BS\u0000');
            // 2. 修复单反斜杠的非法 JSON 转义（保留标准的 \" \/ \b \f \n \r \t \uXXXX）
            cleanedResponse = cleanedResponse.replace(/\\([^"\\\/bfnrtu])/g, '\\\\$1');
            // 3. 还原双反斜杠
            cleanedResponse = cleanedResponse.replace(/\u0000DBL_BS\u0000/g, '\\\\');

            questions = JSON.parse(cleanedResponse);
        } catch (e) {
            logger.error({ error: e, rawResponse: aiResponse }, "Failed to parse AI diagnostic questions");
            return internalError("AI 服务生成的题目格式有误，请重试");
        }

        return NextResponse.json({
            subject,
            grade,
            selectedChapters,
            questions,
            prioritizedInfo: {
                untested: untestedTags.length,
                weak: weakTags.length,
                developing: developingTags.length,
                mastered: masteredTags.length,
            }
        });

    } catch (error) {
        logger.error({ error }, "Failed to generate diagnostic quiz");
        return internalError("生成诊断测试失败，请稍后重试");
    }
}
