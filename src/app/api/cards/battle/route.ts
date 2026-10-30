import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorized, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import type { BattleRecord, BattleRecordResponse } from "@/types/api";

const logger = createLogger('api:cards:battle');

export const dynamic = 'force-dynamic';

const RECENT_RECORDS_LIMIT = 20;
const VALID_SUBJECTS = ['math', 'physics', 'mixed'];
const DEFAULT_TOTAL_STAGES = 8;

async function findUserByEmail(email: string) {
    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
    });
    return user;
}

function toNumber(value: unknown, fallback = 0): number {
    if (value === null || value === undefined) return fallback;
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function mapRecord(row: {
    id: string;
    userId: string;
    subject: string;
    result: string;
    stagesCleared: number;
    totalStages: number;
    score: number;
    deckJson: string;
    createdAt: Date;
}): BattleRecord {
    return {
        id: row.id,
        userId: row.userId,
        subject: row.subject,
        result: row.result === 'defeat' ? 'defeat' : 'victory',
        stagesCleared: row.stagesCleared,
        totalStages: row.totalStages,
        score: row.score,
        deckJson: row.deckJson,
        createdAt: row.createdAt.toISOString(),
    };
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return unauthorized();
    }

    const user = await findUserByEmail(session.user.email);
    if (!user) {
        return unauthorized();
    }

    try {
        const where = { userId: user.id };

        const [recent, aggregate, victories] = await Promise.all([
            prisma.cardBattleRecord.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: RECENT_RECORDS_LIMIT,
            }),
            prisma.cardBattleRecord.aggregate({
                where,
                _count: { _all: true },
                _max: { stagesCleared: true },
            }),
            prisma.cardBattleRecord.count({
                where: { ...where, result: 'victory' },
            }),
        ]);

        const response: BattleRecordResponse = {
            records: recent.map(mapRecord),
            totalBattles: aggregate._count._all,
            victories,
            bestStages: aggregate._max.stagesCleared ?? 0,
        };

        return NextResponse.json(response);
    } catch (error) {
        logger.error({ error }, 'Failed to fetch battle records');
        return internalError('Failed to fetch battle records');
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return unauthorized();
    }

    const user = await findUserByEmail(session.user.email);
    if (!user) {
        return unauthorized();
    }

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        body = {};
    }

    let subject = typeof body.subject === 'string' ? body.subject : '';
    if (!VALID_SUBJECTS.includes(subject)) {
        subject = 'mixed';
    }

    const result = body.result === 'defeat' ? 'defeat' : 'victory';
    const totalStages = Math.max(0, Math.floor(toNumber(body.totalStages, DEFAULT_TOTAL_STAGES)));
    const stagesCleared = Math.min(totalStages, Math.max(0, Math.floor(toNumber(body.stagesCleared))));
    const score = Math.floor(toNumber(body.score));

    let deckJson = typeof body.deckJson === 'string' ? body.deckJson : '';
    if (typeof body.deckJson === 'object' && body.deckJson !== null) {
        deckJson = JSON.stringify(body.deckJson);
    }

    try {
        const record = await prisma.cardBattleRecord.create({
            data: {
                userId: user.id,
                subject,
                result,
                stagesCleared,
                totalStages,
                score,
                deckJson,
            },
        });

        logger.info({ userId: user.id, subject, result, stagesCleared }, 'Battle recorded');

        return NextResponse.json(mapRecord(record), { status: 201 });
    } catch (error) {
        logger.error({ error }, 'Failed to record battle');
        return internalError('Failed to record battle');
    }
}
