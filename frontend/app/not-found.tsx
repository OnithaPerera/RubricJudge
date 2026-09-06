import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
      <h2 className="text-4xl font-bold font-display mb-4 text-zinc-900 dark:text-zinc-100">404 - Not Found</h2>
      <p className="text-zinc-600 dark:text-zinc-400 mb-8 max-w-md">
        Could not find requested resource. The page you are looking for might have been removed or is temporarily unavailable.
      </p>
      <Link 
        href="/" 
        className="px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
