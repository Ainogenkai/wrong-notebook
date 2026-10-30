"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InfoTipProps {
    /** 详情文案（悬停预览 / 点击钉住时展开） */
    tip: ReactNode;
    /** 被包裹的标签内容 */
    children: ReactNode;
    /** 提示出现方位，默认朝上；敌人面板在页面上部时传 "bottom" */
    side?: "top" | "bottom";
    className?: string;
}

/**
 * 通用详情提示：悬停预览，点击可「钉住」保持展开（再点收起）。
 * 纯受控实现，零依赖。点击会 stopPropagation，避免触发外层（如敌方面板）的 onClick。
 */
export function InfoTip({ tip, children, side = "top", className }: InfoTipProps) {
    const [hovered, setHovered] = useState(false);
    const [pinned, setPinned] = useState(false);
    const visible = hovered || pinned;

    return (
        <span
            tabIndex={0}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={(e) => {
                e.stopPropagation();
                setPinned((p) => !p);
            }}
            aria-expanded={visible}
            className={cn("relative inline-flex cursor-pointer items-center outline-none", className)}
        >
            {children}
            <span
                role="tooltip"
                className={cn(
                    "absolute left-0 z-50 w-56 rounded-lg border border-slate-700/80 bg-slate-950/95 p-2 text-left font-mono text-[10px] leading-relaxed text-slate-300 shadow-xl backdrop-blur-sm transition-opacity duration-150",
                    visible ? "opacity-100" : "pointer-events-none opacity-0",
                    side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
                )}
            >
                {tip}
            </span>
        </span>
    );
}
