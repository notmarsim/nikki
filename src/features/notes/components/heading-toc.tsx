"use client";

import React, { useEffect, useState } from "react";

export interface HeadingTocItem {
  index: number;
  level: 1 | 2 | 3;
  text: string;
}

interface HeadingTocProps {
  headings: HeadingTocItem[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

const TICK_WIDTH: Record<1 | 2 | 3, string> = {
  1: "w-4",
  2: "w-3",
  3: "w-2",
};

const INDENT_CLASS: Record<1 | 2 | 3, string> = {
  1: "pl-0",
  2: "pl-3",
  3: "pl-6",
};

export function HeadingToc({ headings, scrollContainerRef }: HeadingTocProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || headings.length === 0) return;

    const handleScroll = () => {
      const headingEls = container.querySelectorAll(".ProseMirror h1, .ProseMirror h2, .ProseMirror h3");
      if (headingEls.length === 0) return;

      const containerTop = container.getBoundingClientRect().top;
      let current = 0;

      headingEls.forEach((el, idx) => {
        const rect = el.getBoundingClientRect();
        if (rect.top - containerTop <= 120) {
          current = idx;
        }
      });

      setActiveIndex(current);
    };

    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [headings, scrollContainerRef]);

  if (headings.length === 0) return null;

  const scrollToHeading = (index: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const headingEls = container.querySelectorAll(".ProseMirror h1, .ProseMirror h2, .ProseMirror h3");
    const target = headingEls[index];
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveIndex(index);
    }
  };

  return (
    <div
      className="pointer-events-auto relative z-20 hidden sm:flex flex-col items-end"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Minimalist Tick Minimap (always visible when headings exist) */}
      <div
        className="flex flex-col items-end gap-2.5 rounded-lg py-2 px-1.5 cursor-pointer"
        aria-label="Document outline"
      >
        {headings.map((h) => {
          const isActive = h.index === activeIndex;
          return (
            <button
              key={`${h.index}-${h.text}`}
              type="button"
              onClick={() => scrollToHeading(h.index)}
              title={h.text}
              aria-label={`Jump to ${h.text}`}
              className={`h-[2px] rounded-full transition-all duration-150 ${TICK_WIDTH[h.level]} ${
                isActive
                  ? "bg-[var(--foreground)] shadow-[0_0_6px_rgba(255,255,255,0.45)]"
                  : "bg-[var(--muted-foreground)]/45 hover:bg-[var(--muted-foreground)]"
              }`}
            />
          );
        })}
      </div>

      {/* Floating TOC Popover on Hover */}
      {hovered && (
        <div className="absolute right-0 top-0 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 p-3 shadow-xl backdrop-blur-sm">
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {headings.map((h) => {
              const isActive = h.index === activeIndex;
              return (
                <button
                  key={`toc-${h.index}-${h.text}`}
                  type="button"
                  onClick={() => scrollToHeading(h.index)}
                  className={`block w-full truncate text-left text-xs transition-colors ${INDENT_CLASS[h.level]} ${
                    isActive
                      ? "font-medium text-blue-500 dark:text-blue-400"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {h.text || "Untitled section"}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
