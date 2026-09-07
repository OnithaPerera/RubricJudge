import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-65px)] flex flex-col items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
          <FileQuestion size={40} className="text-zinc-400" />
        </div>
        <h2 className="text-3xl font-black font-display text-foreground mb-4">
          404: Page Not Found
        </h2>
        <p className="text-zinc-500 mb-8 leading-relaxed">
          The requested evaluation report or document could not be located. It may have been discarded or the URL is incorrect.
        </p>
        <Link href="/" className="btn-primary inline-flex items-center gap-2">
          <ArrowLeft size={16} />
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
