"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export default function SiteHeader() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="w-full border-b border-border bg-background px-6 py-4 flex items-center justify-between sticky top-0 z-50 print:hidden">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 relative">
          <img src="/icon.svg" alt="RubricJudge Logo" className="w-full h-full object-contain" />
        </div>
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground" style={{ fontFamily: "var(--font-display)" }}>
            RubricJudge
          </h1>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-500 uppercase tracking-wider hidden sm:block">
            v1.0
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <a href="#how-it-works" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors hidden sm:block">
          How It Works
        </a>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Toggle dark mode"
        >
          <Sun className="h-5 w-5 hidden dark:block text-zinc-400 hover:text-zinc-100" />
          <Moon className="h-5 w-5 block dark:hidden text-zinc-600 hover:text-zinc-900" />
        </button>
      </div>
    </header>
  );
}
