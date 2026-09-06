export default function TermsOfService() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold font-display mb-6 text-zinc-900 dark:text-zinc-100">Terms of Service</h1>
      <div className="space-y-6 text-zinc-700 dark:text-zinc-300 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold mb-3 text-zinc-900 dark:text-zinc-100">Diagnostic Tool Disclaimer</h2>
          <p>RubricJudge provides AI-generated diagnostic estimates based on the rubric provided. These scores and evaluations are for feedback purposes only and do not constitute official grades.</p>
        </section>
        <section>
          <h2 className="text-xl font-bold mb-3 text-zinc-900 dark:text-zinc-100">Final Authority</h2>
          <p>Final grading authority always rests with human instructors. Users should not rely on RubricJudge estimates as guarantees of academic performance.</p>
        </section>
      </div>
    </div>
  );
}
