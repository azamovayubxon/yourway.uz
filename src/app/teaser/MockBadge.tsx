// Плашка «тестовый режим ИИ»: видна, когда вместо настоящего Claude работают готовые ответы-образцы.
export function MockBadge({ label, note }: { label: string; note: string }) {
  return (
    <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-amber-900">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-bold">
        <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
        {label}
      </span>
      <span className="text-amber-800/80">{note}</span>
    </p>
  );
}
