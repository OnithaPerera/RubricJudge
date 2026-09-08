import Link from "next/link";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full border-t border-border bg-background py-8 px-6 print:hidden mt-20">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-col items-center md:items-start gap-1">
          <p className="text-sm font-medium text-foreground">
            &copy; {year} RubricJudge. Built by <a href="https://www.linkedin.com/in/onitha-perera/" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">Onitha Perera</a>.
          </p>
          <p className="text-xs text-zinc-500 text-center md:text-left">
            100% Academic Integrity Compliant. RubricJudge provides diagnostic feedback without ghostwriting.
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm text-zinc-500">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  );
}
