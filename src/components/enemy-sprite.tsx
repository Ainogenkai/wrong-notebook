import { SPRITE_SIZE, getSprite } from "@/lib/enemy-sprites";

interface EnemySpriteProps {
    id: string;
    size?: number;
    dead?: boolean;
    className?: string;
}

/**
 * 16×16 像素敌人渲染（SVG rect，行游程压缩）。
 * 待机浮动 + 死亡灰化（CSS 类见 globals.css 的 .wb-bob / .wb-sprite-dead）。
 */
export function EnemySprite({ id, size = 64, dead = false, className = "" }: EnemySpriteProps) {
    const sprite = getSprite(id);

    if (!sprite) {
        return (
            <div
                className={`grid place-items-center rounded-lg bg-slate-800/60 text-2xl ${className}`}
                style={{ width: size, height: size }}
            >
                {id.slice(0, 1).toUpperCase()}
            </div>
        );
    }

    const rects: React.ReactNode[] = [];
    for (let y = 0; y < sprite.rows.length; y++) {
        const row = sprite.rows[y];
        let x = 0;
        while (x < SPRITE_SIZE) {
            const ch = row[x] ?? ".";
            if (ch === ".") {
                x++;
                continue;
            }
            let run = 1;
            while (row[x + run] === ch) run++;
            const color = sprite.palette[ch];
            if (color) {
                rects.push(<rect key={`${y}-${x}`} x={x} y={y} width={run} height={1} fill={color} />);
            }
            x += run;
        }
    }

    return (
        <div
            className={`${dead ? "wb-sprite-dead" : "wb-bob"} ${className}`}
            style={{ width: size, height: size }}
        >
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${SPRITE_SIZE} ${SPRITE_SIZE}`}
                shapeRendering="crispEdges"
                aria-hidden
            >
                {rects}
            </svg>
        </div>
    );
}
