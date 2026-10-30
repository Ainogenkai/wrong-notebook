import { ParsedQuestion } from "@/lib/ai/types";

// 通用分页响应类型
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface Tag {
    id: string;
    name: string;
    category: string;
    subject: string;
    subcategory?: string | null;
    createdAt: string;
    updatedAt: string;
    _count?: {
        errorItems: number;
    };
}

// AI Model types
export interface AIModel {
    id: string;
    name: string;
    owned_by?: string;
}

export interface ModelsResponse {
    models: AIModel[];
    error?: string;
}

export interface Notebook {
    id: string;
    name: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
    _count?: {
        errorItems: number;
    };
}

export interface ErrorItem {
    id: string;
    userId: string;
    subjectId?: string | null;
    subject?: Notebook | null;
    originalImageUrl: string;
    ocrText?: string | null;
    questionText?: string | null;
    answerText?: string | null;
    analysis?: string | null;
    wrongAnswerText?: string | null;
    mistakeAnalysis?: string | null;
    mistakeStatus?: 'not_attempted' | 'wrong_attempt' | 'unknown' | string | null;
    knowledgePoints?: string | null;

    source?: string | null;
    errorType?: string | null;
    userNotes?: string | null;
    tags?: Tag[];

    masteryLevel: number;
    gradeSemester?: string | null;
    paperLevel?: string | null;

    createdAt: string;
    updatedAt: string;
}

// For creation/updates
export interface CreateErrorItemRequest extends ParsedQuestion {
    originalImageUrl: string;
    subjectId?: string;
    gradeSemester?: string;
    paperLevel?: string;
}

export type AnalyzeResponse = ParsedQuestion;

export interface UserProfile {
    id: string;
    email: string;
    name?: string | null;
    educationStage?: string | null;
    enrollmentYear?: number | null;
    role: string;
    isActive: boolean;
}

export interface UpdateUserProfileRequest {
    name?: string;
    email?: string;
    educationStage?: string;
    enrollmentYear?: number;
    password?: string;
}

export interface OpenAIInstance {
    id: string;           // 唯一标识 (UUID)
    name: string;         // 用户自定义名称
    apiKey: string;
    baseUrl: string;
    model: string;
}

export interface AppConfig {
    aiProvider: 'gemini' | 'openai' | 'azure';
    allowRegistration?: boolean;
    openai?: {
        instances?: OpenAIInstance[];
        activeInstanceId?: string;
    };
    gemini?: {
        apiKey?: string;
        baseUrl?: string;
        model?: string;
    };
    azure?: {
        apiKey?: string;
        endpoint?: string;       // Azure 资源端点 (https://xxx.openai.azure.com)
        deploymentName?: string; // 部署名称
        apiVersion?: string;     // API 版本 (如 2024-02-15-preview)
        model?: string;          // 显示用模型名 (如 gpt-4o)
    };
    prompts?: {
        analyze?: string;
        similar?: string;
    };
    timeouts?: {
        analyze?: number; // 毫秒
    };
}


export interface AnalyticsData {
    totalErrors: number;
    masteredCount: number;
    masteryRate: number;
    subjectStats: { name: string; value: number }[];
    activityData: { date: string; count: number }[];
}

export interface PracticeStatsData {
    subjectStats: { name: string; value: number }[];
    activityStats: { date: string; total: number; correct: number;[key: string]: number | string }[];
    difficultyStats: { name: string; value: number }[];
    overallStats: { total: number; correct: number; rate: string };
}

export interface TagStats {
    tag: string;
    count: number;
}

export interface TagStatsResponse {
    stats: TagStats[];
}

export interface TagSuggestionsResponse {
    suggestions: string[];
}

// ===== 知识卡组（卡牌系统）=====

// 卡牌品级：宗师 / 精通 / 熟练 / 破绽
export type CardTier = 'grandmaster' | 'expert' | 'skilled' | 'flawed';

export interface DeckCard {
    id: string;
    name: string;              // 卡名 = 专业术语
    subject: string;           // "math" | "physics"
    subjectLabel: string;      // 数学 / 物理
    path: string[];            // 教材路径，如 ["高一上", "相互作用——力"]
    tier: CardTier;
    tierLabel: string;         // 宗师 / 精通 / 熟练 / 破绽
    probability: number;       // 掌握概率 0-1
    totalTested: number;
    correctCount: number;
    errorCount: number;        // 有效错误次数（错题数与错答次数取大）
    flavor: string;            // 卡面 flavor 文案
    lastPracticedAt: string | null;
    recentErrorIds: string[];  // 最近错题（用于详情跳转）
    effect: CardEffect;        // 卡牌战斗效果
}

export interface DeckSummary {
    total: number;
    byTier: Record<CardTier, number>;
    bySubject: Record<string, number>;
    masteryRate: number;       // 全卡组平均掌握概率
}

export interface DeckResponse {
    cards: DeckCard[];
    summary: DeckSummary;
}

// ===== 卡牌效果与战斗 =====

// 8 个效果原型
export type CardArchetype =
    | 'strike'   // 猛攻：造成伤害
    | 'multi'    // 连击：多次小额伤害
    | 'dot'      // 灼烧：持续伤害
    | 'guard'    // 护盾：获得护盾
    | 'buff'     // 增益：强化下一张卡
    | 'draw'     // 调度：抽牌 + 回能
    | 'debuff'   // 削弱：降低敌方攻击
    | 'crit';    // 精准：暴击伤害

export interface CardEffect {
    archetype: CardArchetype;
    archetypeLabel: string;   // 猛攻 / 连击 / ...（主题卡为效果名，如「并集」）
    description: string;      // 完整效果描述，如 "造成 12 点伤害"
    cost: number;             // 能量消耗
    value: number;            // 效果数值
    hits?: number;            // 连击次数
    duration?: number;        // 持续回合
    pierceArmor?: boolean;    // 无视护甲
    selfDamage?: number;      // 打出时自伤（破绽卡）
    drawCount?: number;       // 抽牌数
    energyGain?: number;      // 回能数
    critMultiplier?: number;  // 暴击倍率
    enemyAttackDown?: number; // 削弱敌方攻击数值
    enemyAttackDownTurns?: number;
    nextCardDamageBonus?: number; // 下一张卡伤害加成
    block?: number;           // 护盾值
    // ===== 主题效果扩展（可自由组合，全部可选）=====
    heal?: number;                 // 回复自信值
    bonusPerCardPlayed?: number;   // 本回合每打出 1 张牌，效果 +N（单调性/共振）
    lastDamageRatio?: number;      // 伤害 + 上一张卡伤害 × ratio（导数/错位相减）
    perEnemyAlive?: number;        // 场上每个存活敌人 +N
    handSizePer?: number;         // 每 handSizePer 张手牌，效果 +1（库仑）
    allEnemies?: boolean;         // 群体命中：当前层所有存活敌人
    probBoost?: {
        p: number;                // 触发概率
        multiplier: number;       // 触发时效果倍率
        downMultiplier?: number;   // 未触发时的倍率（可选，默认 1）
    };
    stackPerPlay?: number;        // 每次打出本卡，本卡伤害永久 +N
    turnStartEnemyDamage?: number; // 生效期间，每个敌人回合开始时敌人额外受 N 伤
    turnStartEnergy?: number;      // 生效期间，每个玩家回合开始时能量 +N
    onIncomingPct?: number;        // 你受到伤害时，攻击者同步损失 N%（动量守恒）
    reflectBlockPct?: number;      // 本回合护盾挡掉的伤害 N% 反弹给攻击者（全反射）
    shuffleEnemyIntents?: boolean; // 打乱敌人意图顺序（熵增）
    nullifyEnemyGain?: boolean;    // 敌人本回合的增益/蓄意图失效（楞次）
    ifLastDamage?: boolean;        // 仅在上一张卡造成过伤害时生效（条件概率）
    perArchetypeVariety?: number;  // 本回合每打出 1 种不同原型，效果 +N（组合）
}

// 卡组中的一张出战卡（战斗态）
export interface BattleCard {
    uid: string;
    name: string;
    subject: string;
    subjectLabel: string;
    path: string[];
    tier: CardTier;
    tierLabel: string;
    effect: CardEffect;
    flavor: string;
}

// 敌人意图
export type EnemyIntentKind = 'attack' | 'defend' | 'buff' | 'debuff' | 'charge' | 'special';

export interface EnemyIntent {
    kind: EnemyIntentKind;
    value?: number;   // 伤害/护盾/削弱数值
    text: string;     // 意图文案
}

// 弱点技：命中弱点时除 ×1.5 外触发的额外效果
export type EnemyExploit =
    | { kind: "energy"; value: number; text: string }        // 你能量 +value
    | { kind: "block"; value: number; text: string }         // 你获得 value 护盾
    | { kind: "enemyPoison"; value: number; text: string }   // 该敌人获得 value 层灼烧
    | { kind: "breakArmor"; value: number; text: string }    // 击碎该敌人 value 点护甲
    | { kind: "recoverCard"; text: string }                   // 你抽 1 张牌
    | { kind: "lockIntent"; value: number; text: string }    // 该敌人未来 value 个意图锁定为攻击
    | { kind: "noCharge"; text: string };                     // 该敌人下一次蓄力失效

export interface EnemyDef {
    id: string;
    name: string;
    subject: string;           // "math" | "physics"
    chapterKeywords: string[]; // 弱点关键词：卡路径命中则伤害 ×1.5
    hp: number;
    armor: number;             // 每回合开始获得的护甲
    intents: EnemyIntent[];    // 意图循环
    trait?: string;            // 特性标识
    traitDesc: string;
    desc: string;              // 外观/设定描述
    isBoss?: boolean;
    // ===== 弱点 2.0 =====
    resist?: CardArchetype[];  // 抗性：打出这些原型的卡伤害 ×0.5
    exploit?: EnemyExploit;    // 弱点技：命中弱点时的额外效果
}

// 爬塔的一层：1~3 只敌人（组群战）
export type BattleStage = EnemyDef[];

// 战斗中的敌人状态
export interface BattleEnemy {
    uid: string;               // 实例 id（同层多敌时区分）
    def: EnemyDef;
    hp: number;
    maxHp: number;
    block: number;
    intentIndex: number;
    intentOrder: number[];     // 意图序列的排列（熵增乱序用）
    lockedIntents: number;     // 剩余几个意图被锁定为攻击（弱点技）
    noChargeOnce: boolean;     // 下一次蓄力失效（弱点技）
    gainNullified: boolean;    // 本回合增益/蓄力意图失效（楞次）
    attackDown: number;        // 当前被削弱的攻击力
    attackDownTurns: number;   // 削弱剩余回合
    poisoned: number;          // 灼烧每回合伤害
    poisonedTurns: number;
    dotAuraDamage: number;     // 特性光环伤害
    attackUp: number;          // 蓄力/强化带来的攻击加成
    charged: boolean;          // 是否处于蓄力状态（下一击翻倍）
    phase: number;             // BOSS 阶段
}

// 战斗奖励选项
export type BattleRewardKind = 'upgrade' | 'heal' | 'draw';

export interface BattleReward {
    kind: BattleRewardKind;
    label: string;
    desc: string;
}

// 玩家状态
export interface BattlePlayer {
    hp: number;
    maxHp: number;
    block: number;
    energy: number;
    maxEnergy: number;
    nextCardDamageBonus: number;
    energyDrainNextTurn: number;
    dmgBonus?: number;        // 事件：本次战斗所有伤害卡 +N
    energyBonus?: number;    // 事件：最大能量 +N（已并入 maxEnergy）
    nextTurnEnergy?: number; // 事件：下回合能量 +N
    nextDrawBonus?: number;  // 事件：下次战斗多抽 N 张
    nextBlock?: number;      // 事件：下次战斗开始时护盾 +N
}

// 节点地图（杀戮尖塔第一幕式）
export type BattleNodeType = 'battle' | 'elite' | 'event' | 'rest' | 'boss';

export interface MapNode {
    id: number;
    col: number; // 0..11 中间列，12 = BOSS
    row: number; // 0..3
    type: BattleNodeType;
}

export interface GameMap {
    seed: number;
    nodes: MapNode[];
}

// 事件节点（事件卡数据驱动）
export interface EventChoiceEffects {
    heal?: number;
    selfDamage?: number;
    dmgBonus?: number;
    energyBonus?: number;
    nextTurnEnergy?: number;
    nextDrawBonus?: number;
    nextBlock?: number;
    draw?: number;
    discardHand?: number;
    upgradeRandom?: boolean; // 随机强化一张卡
    buffRandomCard?: number; // 随机一张伤害卡永久 +N
    gamble?: boolean;        // 掷骰：偶数回复 / 奇数受伤
}

export interface EventChoice {
    id: string;
    label: string;
    desc: string;
    effects: EventChoiceEffects;
}

export interface CardEventData {
    id: number;
    name: string;
    desc: string;
    choices: EventChoice[];
}

// 战斗状态
export interface BattleState {
    phase: 'player' | 'enemy' | 'reward' | 'victory' | 'defeat';
    turn: number;
    player: BattlePlayer;
    hand: BattleCard[];
    drawPile: BattleCard[];
    discardPile: BattleCard[];
    exhausted: BattleCard[];
    stages: BattleStage[];     // 爬塔全部层（8 层，每层 1~3 只）
    currentStage: number;      // 当前层
    enemies: BattleEnemy[];    // 当前层的敌人实例（1~3 只）
    targetIndex: number;       // 手牌目标（enemies 下标）
    cardsPlayedThisTurn: number;   // 本回合已出牌数
    archetypesThisTurn: string[]; // 本回合出过的原型
    lastDamage: number;        // 上一张卡的伤害（导数/错位）
    persistent: {
        enemyDamagePerTurn: number;  // 每个敌人回合开始时，存活敌人额外受 N 伤
        turnStartEnergy: number;     // 玩家回合开始时能量 +N
        onIncomingPct: number;       // 受到伤害时攻击者反伤 N%
        reflectBlockPct: number;     // 护盾挡掉的伤害 N% 反弹给攻击者
    };
    stacks: Record<string, number>;  // cardUid → 永久伤害堆叠
    deck: BattleCard[];        // 完整出战卡组
    log: string[];
    pendingReward?: BattleReward[];
    rewardTaken: boolean;
    cardsPlayed: number;
    damageDealt: number;
    rngState: number;          // 确定性随机源状态
    // 节点地图模式（undefined = 旧 8 层模式）
    map?: MapNode[];
    mapSeed?: number;
    mapStages?: Record<number, BattleStage[]>; // nodeId → 该节点的敌群
    path?: number[];             // 已走过的节点 id
    currentNodeId?: number;
    pendingPanel?: 'node' | 'event' | 'rest' | null;
    pendingEventId?: number;
    nodesCleared: number;        // 已清节点数（战报用）
}

export type BattleAction =
    | { type: 'PLAY_CARD'; cardUid: string; targetUid?: string }
    | { type: 'END_TURN' }
    | { type: 'TAKE_REWARD'; reward: BattleRewardKind }
    | { type: 'UPGRADE_CARD'; cardUid: string }
    | { type: 'CHOOSE_NODE'; nodeId: number }
    | { type: 'TAKE_EVENT'; choice: string }
    | { type: 'TAKE_REST'; kind: 'heal' | 'draw' | 'shield' };

// 战斗记录（落库）
export interface BattleRecord {
    id: string;
    userId: string;
    subject: string;
    result: 'victory' | 'defeat';
    stagesCleared: number;   // 地图模式下 = 已清节点数
    totalStages: number;     // 地图模式下 = 13
    score: number;
    deckJson: string;
    createdAt: string;
}

export interface BattleRecordResponse {
    records: BattleRecord[];
    totalBattles: number;
    victories: number;
    bestStages: number;
}

export interface AdminUser extends UserProfile {
    createdAt: string;
    _count: {
        errorItems: number;
        practiceRecords: number;
    };
}

export interface AdminDashboardData {
    overview: {
        totalUsers: number;
        totalErrorItems: number;
        totalPracticeRecords: number;
        totalSubjects: number;
    };
    userStats: AdminUserStats[];
    subjectDistribution: { name: string; count: number }[];
    dailyTrend: { date: string; count: number }[];
    masteryDistribution: {
        new: number;
        reviewing: number;
        mastered: number;
    };
}

export interface AdminUserStats {
    id: string;
    name: string | null;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    educationStage: string | null;
    enrollmentYear: number | null;
    errorCount: number;
    practiceCount: number;
    notebookCount: number;
}

export interface AdminUserDetail {
    user: {
        id: string;
        name: string | null;
        email: string;
        role: string;
        isActive: boolean;
        createdAt: string;
        educationStage: string | null;
        enrollmentYear: number | null;
    };
    notebooks: { id: string; name: string; errorCount: number }[];
    errorCount: number;
    practiceCount: number;
    notebookCount: number;
    recent7DaysCount: number;
    masteryDistribution: {
        new: number;
        reviewing: number;
        mastered: number;
    };
    subjectDistribution: { name: string; count: number }[];
    recentErrorItems: {
        id: string;
        questionText: string | null;
        ocrText: string | null;
        masteryLevel: number;
        createdAt: string;
        subject: { name: string } | null;
    }[];
}

export interface RegisterRequest {
    name: string;
    email: string;
    password: string;
    educationStage: string;
    enrollmentYear: number;
}
