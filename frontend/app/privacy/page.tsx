export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold font-display mb-6 text-zinc-900 dark:text-zinc-100">Privacy Policy</h1>
      <div className="space-y-6 text-zinc-700 dark:text-zinc-300 leading-relaxed">
        <p>Your privacy is important to us. This policy outlines how RubricJudge handles your data.</p>
        <section>
          <h2 className="text-xl font-bold mb-3 text-zinc-900 dark:text-zinc-100">Zero Data Retention</h2>
          <p>We do not store your assignment drafts, rubrics, or evaluation reports on our servers after the evaluation session has concluded. All data is processed in memory and immediately discarded.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold mb-3 text-zinc-900 dark:text-zinc-100">Academic Integrity</h2>
          <p>RubricJudge is designed as a diagnostic tool. We do not share your submissions with third-party plagiarism detection services or use your essays to train our AI models.</p>
        </section>
      </div>
    </div>
  );
}
