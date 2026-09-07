"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full glass-card p-8 text-center border-rose-500/20">
        <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={32} className="text-rose-500" />
        </div>
        <h2 className="text-2xl font-bold font-display text-foreground mb-3">
          Something went wrong
        </h2>
        <p className="text-zinc-500 mb-8 text-sm leading-relaxed">
          {error.message || "An unexpected error occurred while rendering this page. Please try again or contact support if the issue persists."}
        </p>
        <button
          onClick={() => reset()}
          className="btn-primary w-full justify-center flex items-center gap-2"
        >
          <RefreshCcw size={16} />
          Try Again
        </button>
      </div>
    </div>
  );
}
