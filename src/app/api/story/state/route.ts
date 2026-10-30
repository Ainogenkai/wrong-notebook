import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorized, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:story:state');

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return unauthorized();
    }

    // @ts-ignore
    const userId = session.user.id;

    try {
        // 1. 获取或创建剧情会话（首次进入自动初始化）
        let storySession = await prisma.systemStorySession.findUnique({
            where: { userId }
        });

        if (!storySession) {
            storySession = await prisma.systemStorySession.create({
                data: {
                    userId,
                    stage: 1,
                    stageTitle: "阶段一：月考倒计时",
                    points: 0,
                    level: 1,
                    streak: 0,
                }
            });
        }

        // 2. 读取对话历史（滚动窗口：最近 30 条）
        const messages = await prisma.storyChatMessage.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
            take: 30,
        });

        // 3. 聚合宿主战力数据（HUD 面板）
        const [totalPractice, weakStates, unmasteredErrors] = await Promise.all([
            prisma.practiceRecord.count({ where: { userId } }),
            prisma.knowledgeMasteryState.findMany({
                where: { userId, masteryState: 1 },
                select: { subject: true, tagName: true }
            }),
            prisma.errorItem.count({ where: { userId, masteryLevel: 0 } }),
        ]);

        const weakTags = weakStates.map(w => w.tagName);

        // HUD 属性计算
        const hud = {
            level: storySession.level,
            points: storySession.points,
            stage: storySession.stage,
            stageTitle: storySession.stageTitle,
            streak: storySession.streak,
            eventCount: storySession.eventCount,
            // 底层学情投射
            totalPractice,
            weakTags,
            unmasteredErrors,
            hasCurrentEvent: !!storySession.currentEventJson,
        };

        // 当前事件（如有）
        let currentEvent = null;
        if (storySession.currentEventJson) {
            try {
                currentEvent = JSON.parse(storySession.currentEventJson);
            } catch (e) { /* 忽略 */ }
        }

        return NextResponse.json({
            hud,
            summary: storySession.summary, // L3 记忆摘要
            currentEvent,
            messages,
        });

    } catch (error) {
        logger.error({ error }, "Failed to fetch story state");
        return internalError("获取系统状态失败");
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return unauthorized();
    }

    // @ts-ignore
    const userId = session.user.id;

    try {
        await prisma.$transaction([
            // 1. 清空当前用户的所有剧情聊天消息
            prisma.storyChatMessage.deleteMany({
                where: { userId }
            }),
            // 2. 清除当前正在进行的未结算事件与历史摘要缓存
            prisma.systemStorySession.updateMany({
                where: { userId },
                data: {
                    currentEventJson: null,
                    summary: null,
                }
            })
        ]);

        return NextResponse.json({ success: true, message: "剧情对话已重置清空" });
    } catch (error) {
        logger.error({ error }, "Failed to reset story state");
        return internalError("重置剧情记录失败");
    }
}
