"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export default function SiteHeader() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-6 py-4 flex items-center justify-between sticky top-0 z-50 print:hidden">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50" style={{ fontFamily: "var(--font-display)" }}>
          RubricJudge
        </h1>
      </div>
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        aria-label="Toggle dark mode"
      >
        <Sun className="h-5 w-5 hidden dark:block text-zinc-400 hover:text-zinc-100" />
        <Moon className="h-5 w-5 block dark:hidden text-zinc-600 hover:text-zinc-900" />
      </button>
    </header>
  );
}
