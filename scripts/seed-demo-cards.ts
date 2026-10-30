/**
 * 演示卡组数据脚本
 *
 * 用途：把知识标签树补全成「教材层级」，并为指定用户生成一批覆盖各个品级的
 *       掌握度记录，让 /cards 页面立刻拥有一面可看的卡墙。
 *
 * 非破坏性：不会删除既有标签 / 错题；孤立的旧标签会被重新挂到正确的章节下
 *           （tag id 不变，因此已有的错题关联不会断）。
 *
 * 使用方法:
 *   npx tsx scripts/seed-demo-cards.ts            # 建标签层级 + 造演示卡
 *   npx tsx scripts/seed-demo-cards.ts --reset    # 清掉演示卡的掌握度记录
 */

import { PrismaClient } from '@prisma/client';
import { PHYSICS_CURRICULUM, PHYSICS_GRADE_ORDER } from '../src/lib/tag-data/physics';
import { MATH_CURRICULUM, MATH_GRADE_ORDER } from '../src/lib/tag-data/math';

const prisma = new PrismaClient();

const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL || 'admin@localhost';

// 演示卡点位：subject / tagName / 掌握概率 / 出战次数 / 胜场
// 覆盖四个品级，便于预览卡面效果
const DEMO_POINTS: Array<{
    subject: 'physics' | 'math';
    tagName: string;
    probability: number;
    totalTested: number;
    correctCount: number;
}> = [
    // ---- 物理 · 高一上 ----
    { subject: 'physics', tagName: '质点', probability: 0.9, totalTested: 5, correctCount: 5 },
    { subject: 'physics', tagName: '参考系', probability: 1, totalTested: 3, correctCount: 3 },
    { subject: 'physics', tagName: '速度', probability: 0.75, totalTested: 4, correctCount: 3 },
    { subject: 'physics', tagName: '加速度', probability: 0.5, totalTested: 4, correctCount: 2 },
    { subject: 'physics', tagName: '位移', probability: 0.67, totalTested: 3, correctCount: 2 },
    { subject: 'physics', tagName: '匀变速直线运动规律', probability: 0.4, totalTested: 5, correctCount: 2 },
    { subject: 'physics', tagName: '自由落体运动', probability: 0.8, totalTested: 5, correctCount: 4 },
    { subject: 'physics', tagName: 'x-t图', probability: 0.25, totalTested: 4, correctCount: 1 },
    { subject: 'physics', tagName: 'v-t图', probability: 0.2, totalTested: 5, correctCount: 1 },
    { subject: 'physics', tagName: '重力', probability: 0.85, totalTested: 4, correctCount: 4 },
    { subject: 'physics', tagName: '弹力', probability: 0.5, totalTested: 4, correctCount: 2 },
    { subject: 'physics', tagName: '胡克定律', probability: 0.33, totalTested: 6, correctCount: 2 },
    { subject: 'physics', tagName: '摩擦力', probability: 0.75, totalTested: 8, correctCount: 6 },
    { subject: 'physics', tagName: '力的合成与分解', probability: 0.67, totalTested: 6, correctCount: 4 },
    { subject: 'physics', tagName: '共点力的平衡', probability: 0.5, totalTested: 8, correctCount: 4 },
    { subject: 'physics', tagName: '牛顿第二定律', probability: 0.43, totalTested: 7, correctCount: 3 },
    { subject: 'physics', tagName: '牛顿第三定律', probability: 0.86, totalTested: 7, correctCount: 6 },
    // ---- 物理 · 高一下 / 高二 / 高三 ----
    { subject: 'physics', tagName: '平抛运动', probability: 0.31, totalTested: 5, correctCount: 2 },
    { subject: 'physics', tagName: '向心力', probability: 0.29, totalTested: 7, correctCount: 2 },
    { subject: 'physics', tagName: '功', probability: 0.78, totalTested: 5, correctCount: 4 },
    { subject: 'physics', tagName: '功率', probability: 0.67, totalTested: 6, correctCount: 4 },
    { subject: 'physics', tagName: '动能定理', probability: 0.36, totalTested: 5, correctCount: 2 },
    { subject: 'physics', tagName: '机械能守恒定律', probability: 0.5, totalTested: 8, correctCount: 4 },
    { subject: 'physics', tagName: '欧姆定律', probability: 0.71, totalTested: 7, correctCount: 5 },
    { subject: 'physics', tagName: '焦耳定律', probability: 0.4, totalTested: 5, correctCount: 2 },
    { subject: 'physics', tagName: '动量守恒定律', probability: 0.25, totalTested: 6, correctCount: 2 },
    { subject: 'physics', tagName: '楞次定律', probability: 0.2, totalTested: 5, correctCount: 1 },
    { subject: 'physics', tagName: '法拉第电磁感应定律', probability: 0.4, totalTested: 5, correctCount: 2 },
    { subject: 'physics', tagName: '光的折射', probability: 0.63, totalTested: 4, correctCount: 3 },
    { subject: 'physics', tagName: '热力学第一定律', probability: 0.5, totalTested: 4, correctCount: 2 },
    // ---- 数学 · 高一 ----
    { subject: 'math', tagName: '集合', probability: 0.86, totalTested: 7, correctCount: 6 },
    { subject: 'math', tagName: '交集', probability: 0.67, totalTested: 6, correctCount: 4 },
    { subject: 'math', tagName: '充分条件', probability: 0.25, totalTested: 4, correctCount: 1 },
    { subject: 'math', tagName: '不等式性质', probability: 0.5, totalTested: 4, correctCount: 2 },
    { subject: 'math', tagName: '一元二次不等式', probability: 0.33, totalTested: 6, correctCount: 2 },
    { subject: 'math', tagName: '单调性', probability: 0.75, totalTested: 8, correctCount: 6 },
    { subject: 'math', tagName: '奇偶性', probability: 0.8, totalTested: 5, correctCount: 4 },
    { subject: 'math', tagName: '指数运算', probability: 0.6, totalTested: 5, correctCount: 3 },
    { subject: 'math', tagName: '对数函数', probability: 0.29, totalTested: 7, correctCount: 2 },
    { subject: 'math', tagName: '三角函数', probability: 0.71, totalTested: 7, correctCount: 5 },
    { subject: 'math', tagName: '正弦函数', probability: 0.43, totalTested: 7, correctCount: 3 },
    // ---- 数学 · 高二 / 高三 ----
    { subject: 'math', tagName: '数量积', probability: 0.63, totalTested: 4, correctCount: 3 },
    { subject: 'math', tagName: '表面积', probability: 0.5, totalTested: 4, correctCount: 2 },
    { subject: 'math', tagName: '体积', probability: 0.2, totalTested: 5, correctCount: 1 },
    { subject: 'math', tagName: '条件概率', probability: 0.25, totalTested: 8, correctCount: 2 },
    { subject: 'math', tagName: '古典概型', probability: 0.67, totalTested: 6, correctCount: 4 },
    { subject: 'math', tagName: '排列数', probability: 0.36, totalTested: 8, correctCount: 3 },
    { subject: 'math', tagName: '组合数', probability: 0.25, totalTested: 6, correctCount: 2 },
    { subject: 'math', tagName: '二项式定理', probability: 0.5, totalTested: 6, correctCount: 3 },
    { subject: 'math', tagName: '导数与单调性', probability: 0.33, totalTested: 6, correctCount: 2 },
    { subject: 'math', tagName: '极值', probability: 0.4, totalTested: 5, correctCount: 2 },
    { subject: 'math', tagName: '最优化问题', probability: 0.25, totalTested: 4, correctCount: 1 },
];

type TagNode = { name: string; children: TagNode[] };

async function ensureTag(
    subject: string,
    name: string,
    parentId: string | null,
    order: number,
    orphanPool: Map<string, string>
): Promise<string> {
    const existing = await prisma.knowledgeTag.findFirst({
        where: { subject, name, parentId },
        select: { id: true },
    });
    if (existing) return existing.id;

    // 复用孤立旧标签（保持 tag id，避免错题关联断裂）
    const orphanKey = `${subject}::${name}`;
    const orphanId = orphanPool.get(orphanKey);
    if (orphanId) {
        orphanPool.delete(orphanKey);
        await prisma.knowledgeTag.update({
            where: { id: orphanId },
            data: { parentId, isSystem: true, order },
        });
        return orphanId;
    }

    const created = await prisma.knowledgeTag.create({
        data: { subject, name, parentId, isSystem: true, order },
        select: { id: true },
    });
    return created.id;
}

async function buildTree(
    subject: string,
    tree: TagNode[],
    orphanPool: Map<string, string>,
    gradeOrder: Record<string, number>
): Promise<void> {
    let gradeIndex = 0;

    for (const grade of tree) {
        gradeIndex += 1;
        const gradeId = await ensureTag(
            subject,
            grade.name,
            null,
            gradeOrder[grade.name] || gradeIndex,
            orphanPool
        );
        await ensureChildren(subject, grade.children, gradeId, orphanPool);
    }
}

/** 递归写入子节点（兼容数学的 章节 > 小节 > 知识点 四层结构） */
async function ensureChildren(
    subject: string,
    nodes: TagNode[],
    parentId: string,
    orphanPool: Map<string, string>
): Promise<void> {
    let index = 0;
    for (const node of nodes) {
        index += 1;
        const nodeId = await ensureTag(subject, node.name, parentId, index, orphanPool);
        if (node.children.length > 0) {
            await ensureChildren(subject, node.children, nodeId, orphanPool);
        }
    }
}

function physicsTree(): TagNode[] {
    return Object.entries(PHYSICS_CURRICULUM).map(([grade, chapters]) => ({
        name: grade,
        children: chapters.map((c) => ({
            name: c.chapter,
            children: c.tags.map((t) => ({ name: t, children: [] })),
        })),
    }));
}

function mathTree(): TagNode[] {
    return Object.entries(MATH_CURRICULUM).map(([grade, chapters]) => ({
        name: grade,
        children: chapters.map((c) => ({
            name: c.chapter,
            children: c.sections.map((s) => ({
                name: s.section,
                children: s.tags.map((t) => ({ name: t, children: [] as TagNode[] })),
            })),
        })),
    }));
}

async function collectOrphans(): Promise<Map<string, string>> {
    const orphans = await prisma.knowledgeTag.findMany({
        where: {
            subject: { in: ['physics', 'math'] },
            parentId: null,
            isSystem: true,
        },
        select: { id: true, name: true, subject: true },
    });
    const pool = new Map<string, string>();
    for (const tag of orphans) {
        const key = `${tag.subject}::${tag.name}`;
        if (!pool.has(key)) pool.set(key, tag.id);
    }
    return pool;
}

async function main() {
    const isReset = process.argv.includes('--reset');
    const user = await prisma.user.findUnique({
        where: { email: DEMO_USER_EMAIL },
        select: { id: true, email: true },
    });
    if (!user) {
        throw new Error(`找不到用户 ${DEMO_USER_EMAIL}，请先注册或修改 DEMO_USER_EMAIL`);
    }

    if (isReset) {
        console.log('🗑️  清除演示卡掌握度记录...');
        const deleted = await prisma.knowledgeMasteryState.deleteMany({
            where: {
                userId: user.id,
                OR: DEMO_POINTS.map((p) => ({ subject: p.subject, tagName: p.tagName })),
            },
        });
        console.log(`✅ 已清除 ${deleted.count} 条演示掌握度记录（标签树保留）`);
        return;
    }

    console.log('🌳 构建教材标签层级（物理 / 数学）...');
    const orphanPool = await collectOrphans();
    console.log(`   发现 ${orphanPool.size} 个孤立旧标签，将重新挂载`);

    await buildTree('physics', physicsTree(), orphanPool, PHYSICS_GRADE_ORDER);
    await buildTree('math', mathTree(), orphanPool, MATH_GRADE_ORDER);

    console.log('\n🎴 写入演示卡掌握度...');
    let created = 0;
    let updated = 0;
    let missing = 0;

    for (const point of DEMO_POINTS) {
        const tagExists = await prisma.knowledgeTag.findFirst({
            where: { subject: point.subject, name: point.tagName },
            select: { id: true },
        });
        if (!tagExists) {
            console.warn(`   ⚠️  标签不存在，跳过：${point.subject} / ${point.tagName}`);
            missing += 1;
            continue;
        }

        const masteryState = point.probability >= 0.8 ? 3 : point.probability >= 0.5 ? 2 : 1;
        const existing = await prisma.knowledgeMasteryState.findUnique({
            where: {
                userId_subject_tagName: {
                    userId: user.id,
                    subject: point.subject,
                    tagName: point.tagName,
                },
            },
            select: { id: true },
        });

        if (existing) {
            await prisma.knowledgeMasteryState.update({
                where: { id: existing.id },
                data: {
                    probability: point.probability,
                    totalTested: point.totalTested,
                    correctCount: point.correctCount,
                    masteryState,
                },
            });
            updated += 1;
        } else {
            await prisma.knowledgeMasteryState.create({
                data: {
                    userId: user.id,
                    subject: point.subject,
                    tagName: point.tagName,
                    probability: point.probability,
                    totalTested: point.totalTested,
                    correctCount: point.correctCount,
                    masteryState,
                },
            });
            created += 1;
        }
    }

    const total = await prisma.knowledgeMasteryState.count({ where: { userId: user.id } });
    console.log(`\n✅ 演示卡准备完成：新增 ${created} / 更新 ${updated} / 跳过 ${missing}`);
    console.log(`   当前用户卡组共 ${total} 张，去 http://localhost:3000/cards 看看`);
}

main()
    .catch((e) => {
        console.error('❌ 执行失败:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
