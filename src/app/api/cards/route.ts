import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorized, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { CARD_SUBJECTS, compileDeck, summarizeDeck } from "@/lib/cards";

const logger = createLogger('api:cards');

export const dynamic = 'force-dynamic';

const MAX_RECENT_ERROR_IDS = 5;

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return unauthorized();
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        if (!user) {
            return unauthorized();
        }

        const [masteryStates, tags, errorItems] = await Promise.all([
            prisma.knowledgeMasteryState.findMany({
                where: {
                    userId: user.id,
                    subject: { in: [...CARD_SUBJECTS] },
                    totalTested: { gt: 0 },
                },
            }),
            prisma.knowledgeTag.findMany({
                where: { subject: { in: [...CARD_SUBJECTS] } },
                select: { id: true, name: true, subject: true, parentId: true },
            }),
            prisma.errorItem.findMany({
                where: {
                    userId: user.id,
                    tags: { some: { subject: { in: [...CARD_SUBJECTS] } } },
                },
                select: {
                    id: true,
                    createdAt: true,
                    tags: { select: { id: true, name: true, subject: true } },
                },
                orderBy: { createdAt: "desc" },
            }),
        ]);

        // 标签路径索引：subject::name -> 祖先链
        const tagById = new Map(tags.map((t) => [t.id, t]));
        const pathIndex = new Map<string, string[]>();

        for (const tag of tags) {
            const chain: string[] = [];
            const visited = new Set<string>();
            let currentId: string | null | undefined = tag.id;

            while (currentId && !visited.has(currentId)) {
                visited.add(currentId);
                const current: { name: string; parentId: string | null } | undefined = tagById.get(currentId);
                if (!current) break;
                chain.unshift(current.name);
                currentId = current.parentId;
            }

            const key = `${tag.subject}::${tag.name}`;
            const existing = pathIndex.get(key);
            if (!existing || chain.length > existing.length) {
                pathIndex.set(key, chain);
            }
        }

        // 错题统计：按 subject::name 聚合数量与最近错题 ID
        const errorCountMap = new Map<string, number>();
        const recentErrorMap = new Map<string, string[]>();

        for (const item of errorItems) {
            for (const tag of item.tags) {
                const key = `${tag.subject}::${tag.name}`;
                errorCountMap.set(key, (errorCountMap.get(key) || 0) + 1);
                const recent = recentErrorMap.get(key);
                if (recent) {
                    if (recent.length < MAX_RECENT_ERROR_IDS) recent.push(item.id);
                } else {
                    recentErrorMap.set(key, [item.id]);
                }
            }
        }

        // 并集：掌握度记录的知识点 ∪ 仅由错题标签产生的知识点
        // 手动录入的错题也会立即生成一张「破绽」卡（做题即抽卡）
        const masteryKeys = new Set(
            masteryStates.map((state) => `${state.subject}::${state.tagName}`)
        );

        const errorOnlyKeys = [...errorCountMap.keys()].filter((key) => !masteryKeys.has(key));

        const rows = [
            ...masteryStates.map((state) => {
                const key = `${state.subject}::${state.tagName}`;
                return {
                    subject: state.subject,
                    tagName: state.tagName,
                    probability: state.probability,
                    totalTested: state.totalTested,
                    correctCount: state.correctCount,
                    errorCount: errorCountMap.get(key) || 0,
                    path: pathIndex.get(key) || [state.tagName],
                    lastPracticedAt: state.updatedAt,
                    recentErrorIds: recentErrorMap.get(key) || [],
                };
            }),
            ...errorOnlyKeys.map((key) => {
                const [subject, ...rest] = key.split("::");
                const tagName = rest.join("::");
                return {
                    subject,
                    tagName,
                    probability: 0,
                    totalTested: 1,
                    correctCount: 0,
                    errorCount: errorCountMap.get(key) || 0,
                    path: pathIndex.get(key) || [tagName],
                    lastPracticedAt: null,
                    recentErrorIds: recentErrorMap.get(key) || [],
                };
            }),
        ];

        const cards = compileDeck(rows);

        return NextResponse.json({
            cards,
            summary: summarizeDeck(cards),
        });
    } catch (error) {
        logger.error({ error }, 'Failed to build card deck');
        return internalError("Failed to build card deck");
    }
}
