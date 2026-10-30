import type { EnemyDef, BattleStage } from "@/types/api";

/**
 * 章节怪
 *
 * 每只怪绑定一组章节关键词（chapterKeywords）。你打出的卡若所属章节命中关键词，
 * 伤害 ×1.5（见 lib/card-effects.ts 的 WEAKNESS_MULTIPLIER）。
 * 这样「这张卡属于哪一章」就成了真正的策略信息。
 */
export const ENEMIES: EnemyDef[] = [
    {
        id: "rusty-construct",
        name: "锈铁傀儡",
        subject: "physics",
        chapterKeywords: ["相互作用", "牛顿", "力学", "力", "运动"],
        hp: 32,
        armor: 0,
        intents: [
            { kind: "attack", value: 6, text: "挥臂重击" },
            { kind: "defend", value: 5, text: "铁皮护体" },
            { kind: "attack", value: 9, text: "双锤砸下" },
            { kind: "charge", text: "蓄力：下一击伤害翻倍" },
        ],
        trait: "charge_strike",
        traitDesc: "每隔三回合蓄力，下一击伤害翻倍",
        desc: "废弃工厂里缓缓重组的锈铁巨人，关节处卡着断裂的弹簧。",
        resist: ["strike"],
        exploit: { kind: "noCharge", text: "锈链崩断，它下一次蓄力失效" },
    },
    {
        id: "tesla-leech",
        name: "特斯拉水蛭",
        subject: "physics",
        chapterKeywords: ["电磁", "电", "磁", "静电", "电路"],
        hp: 28,
        armor: 0,
        intents: [
            { kind: "attack", value: 5, text: "电击吮吸" },
            { kind: "debuff", value: 1, text: "抽走你的专注力" },
            { kind: "attack", value: 7, text: "高压放电" },
        ],
        trait: "drain_energy",
        traitDesc: "每回合抽走你 1 点能量",
        desc: "在潮湿下水道里游荡的半透明水蛭，吸饱电后会微微发紫。",
        resist: ["dot"],
        exploit: { kind: "energy", value: 1, text: "电花四溅，你能量 +1" },
    },
    {
        id: "entropy-flame",
        name: "熵增火苗",
        subject: "physics",
        chapterKeywords: ["热", "内能", "分子", "功和机械能", "热学"],
        hp: 24,
        armor: 0,
        intents: [
            { kind: "attack", value: 4, text: "灼舔" },
            { kind: "special", value: 3, text: "热辐射光环灼伤" },
            { kind: "attack", value: 6, text: "爆燃" },
        ],
        trait: "dot_aura",
        traitDesc: "每回合对你造成 3 点灼烧伤害",
        desc: "一团没有温度却越烧越旺的蓝色火苗，靠近时空气会变得粘稠。",
        resist: ["guard"],
        exploit: { kind: "enemyPoison", value: 2, text: "熵逆流，它被灼烧 2 层" },
    },
    {
        id: "prism-beast",
        name: "棱镜折射兽",
        subject: "physics",
        chapterKeywords: ["光", "透镜", "波动", "波", "色散"],
        hp: 26,
        armor: 2,
        intents: [
            { kind: "defend", value: 6, text: "折射成盾" },
            { kind: "attack", value: 7, text: "聚焦穿刺" },
            { kind: "attack", value: 5, text: "散射乱击" },
        ],
        trait: "shield_regen",
        traitDesc: "每回合结束回复 4 点护盾",
        desc: "身体由无数棱镜拼成，走动时会折射出七色残影。",
        resist: ["multi"],
        exploit: { kind: "breakArmor", value: 4, text: "折射失焦，击碎 4 护甲" },
    },
    {
        id: "function-labyrinth",
        name: "函数迷宫守卫",
        subject: "math",
        chapterKeywords: ["函数", "方程", "不等式", "单调", "三角"],
        hp: 38,
        armor: 4,
        intents: [
            { kind: "defend", value: 8, text: "折叠走廊" },
            { kind: "attack", value: 8, text: "代入求解" },
            { kind: "buff", value: 3, text: "自我求导强化" },
        ],
        trait: "armor_per_card",
        traitDesc: "你每出一张牌，它获得 3 点护甲",
        desc: "由无数条抛物线编织成的守卫，你走的每一步都在给它加固。",
        resist: ["draw"],
        exploit: { kind: "block", value: 4, text: "迷宫死路，反手给你 4 护盾" },
    },
    {
        id: "dice-priest",
        name: "骰子教皇",
        subject: "math",
        chapterKeywords: ["概率", "统计", "计数", "排列", "组合", "二项式", "分布"],
        hp: 30,
        armor: 0,
        intents: [
            { kind: "attack", value: 7, text: "掷骰裁决" },
            { kind: "debuff", value: 2, text: "混乱诅咒" },
            { kind: "defend", value: 7, text: "命运庇护" },
            { kind: "attack", value: 9, text: "天罚三连" },
        ],
        trait: "random_intent",
        traitDesc: "意图顺序每回合随机重排",
        desc: "头戴骰子面具的祭司，据说它从不为自己的运气买单。",
        resist: ["crit"],
        exploit: { kind: "lockIntent", value: 2, text: "命运显形，它的下 2 个意图将锁定为攻击" },
    },
    {
        id: "compass-samurai",
        name: "圆规武士",
        subject: "math",
        chapterKeywords: ["几何", "圆", "向量", "空间", "立体", "平面向量", "解析几何"],
        hp: 34,
        armor: 6,
        intents: [
            { kind: "attack", value: 9, text: "圆规穿刺" },
            { kind: "defend", value: 9, text: "铁尺格挡" },
            { kind: "attack", value: 11, text: "双规夹击" },
        ],
        trait: "high_armor",
        traitDesc: "高护甲，需要用「精准」或无视护甲的效果破防",
        desc: "以圆规和直尺为武器的沉默武士，盔甲上刻满几何证明。",
        resist: ["strike"],
        exploit: { kind: "recoverCard", text: "它跪了抽回 1 张" },
    },
    {
        id: "series-serpent",
        name: "级数之蛇",
        subject: "math",
        chapterKeywords: ["数列", "递推", "极限", "归纳", "等差", "等比"],
        hp: 28,
        armor: 0,
        intents: [
            { kind: "attack", value: 6, text: "缠绕撕咬" },
            { kind: "debuff", value: 1, text: "逼你弃牌" },
            { kind: "attack", value: 8, text: "无限连段" },
        ],
        trait: "force_discard",
        traitDesc: "每回合结束时你随机弃 1 张手牌",
        desc: "身体由首尾相接的数列构成，鳞片上写着越来越小的分数。",
        resist: ["multi"],
        exploit: { kind: "recoverCard", text: "蛇尾吐牌，你抽 1 张" },
    },
    {
        id: "final-exam",
        name: "期末试卷·拟人",
        subject: "physics",
        chapterKeywords: [],
        hp: 80,
        armor: 4,
        intents: [
            { kind: "attack", value: 10, text: "压轴题砸脸" },
            { kind: "defend", value: 12, text: "附加题护体" },
            { kind: "special", value: 8, text: "超纲综合题" },
            { kind: "charge", text: "整张试卷压下" },
        ],
        trait: "boss_phases",
        traitDesc: "三阶段：每损失三分之一血量切换一次攻击形态",
        desc: "由一整张期末卷折叠而成的人形，答题卡上写满了你的名字。",
        isBoss: true,
        resist: ["multi"],
        exploit: { kind: "block", value: 6, text: "答题卡反写，你获得 6 护盾" },
    },
];

export const BOSS_ENEMY_ID = "final-exam";

export function getEnemyById(id: string): EnemyDef | undefined {
    return ENEMIES.find((e) => e.id === id);
}

/**
 * 按种子生成一场爬塔的敌人序列（8 只怪，BOSS 固定最后）。
 * 同一 seed 必得同一序列，便于复现与测试。
 *
 * @deprecated 返回扁平序列兼容旧调用，新代码请用 buildEnemyStages
 */
export function buildEnemyWave(seed: number, totalStages: number = 8): EnemyDef[] {
    const pool = ENEMIES.filter((e) => !e.isBoss);
    const rng = createSeededRandom(seed);
    const picked: EnemyDef[] = [];

    for (let i = 0; i < totalStages - 1; i++) {
        picked.push(pool[Math.floor(rng() * pool.length)]);
    }

    const boss = getEnemyById(BOSS_ENEMY_ID);
    if (boss) picked.push(boss);
    return picked;
}

/**
 * 按种子生成 8 层爬塔（组群战）。
 * 层模板：[单, 双, 单, 双, 三(精英), 双, 单, BOSS]
 * 双怪每只 HP ×0.8，三怪每只 ×0.65，单怪不变。
 * 返回的 EnemyDef 是副本，不会修改原始 ENEMIES 数组。
 */
export function buildEnemyStages(seed: number): BattleStage[] {
    const pool = ENEMIES.filter((e) => !e.isBoss);
    const rng = createSeededRandom(seed);
    const stageSizes = [1, 2, 1, 2, 3, 2, 1];

    const stages: BattleStage[] = stageSizes.map((size) => {
        const factor = size === 1 ? 1 : size === 2 ? 0.8 : 0.65;
        const seen = new Set<string>();
        const stage: EnemyDef[] = [];

        for (let i = 0; i < size; i++) {
            let def = pool[Math.floor(rng() * pool.length)];
            if (seen.has(def.id) && pool.length > 1) {
                const next = pool[Math.floor(rng() * pool.length)];
                if (!seen.has(next.id)) def = next;
            }
            seen.add(def.id);
            stage.push({ ...def, hp: Math.round(def.hp * factor) });
        }

        return stage;
    });

    const boss = getEnemyById(BOSS_ENEMY_ID);
    if (boss) stages.push([{ ...boss }]);
    return stages;
}

/** 可复现的伪随机数发生器（mulberry32） */
export function createSeededRandom(seed: number): () => number {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
