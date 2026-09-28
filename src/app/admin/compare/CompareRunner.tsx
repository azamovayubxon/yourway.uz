"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const POLL_MS = 3000;

type VariantStatus = "generating" | "ready" | "failed";
interface State {
  variants: { slot: number; status: VariantStatus }[];
  done: boolean;
}

const STATUS_TEXT: Record<VariantStatus, string> = {
  generating: "генерируется…",
  ready: "готово",
  failed: "не удалось",
};

// Опрос статуса сравнения (как страница полного отчёта): раз в 3 секунды POST /api/admin/compare/<id>.
// Каждый запрос запускает на сервере не больше одной попытки одного варианта. Когда оба варианта
// готовы — страница перерисовывается с сервера и показывает тексты.
export function CompareRunner({ id, initial }: { id: string; initial: State }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [network, setNetwork] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/compare/${id}`, { method: "POST" });
        const data = (await res.json()) as State;
        if (stopped) return;
        setNetwork(false);
        if (!Array.isArray(data.variants)) return;
        setState(data);
        if (data.done) {
          router.refresh();
          return;
        }
      } catch {
        if (!stopped) setNetwork(true);
      }
      if (!stopped) timer.current = setTimeout(() => void poll(), POLL_MS);
    };
    void poll();
    return () => {
      stopped = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [id, router]);

  return (
    <div role="status" className="rounded-2xl bg-slate-50 p-4 text-sm">
      <p className="font-semibold">Идёт генерация — страницу можно не обновлять.</p>
      <ul className="mt-2 space-y-1">
        {state.variants.map((v) => (
          <li key={v.slot}>
            Variant {v.slot}: <b>{STATUS_TEXT[v.status]}</b>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        Тизер — до ~2 минут, часть отчёта — до ~5 минут на вариант (с повтором дольше). Варианты генерируются
        параллельно отдельными запросами.
      </p>
      {network && <p className="mt-2 text-rose-700">Нет связи с сервером — пробуем ещё раз…</p>}
    </div>
  );
}
