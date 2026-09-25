"use client";

import Link from "next/link";
import { useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";

// Код восстановления: показывается один раз после регистрации или восстановления доступа.
// Кнопка «Продолжить» становится активной, только когда человек отметил, что сохранил код.

export function RecoveryCodeCard({
  t,
  login,
  code,
  next,
  note,
}: {
  t: Dictionary["auth"];
  login: string;
  code: string;
  next: string;
  note?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер обмена недоступен (старый браузер): код виден на экране, его можно выделить вручную.
    }
  }

  function download() {
    const text = `${t.code.fileTitle}\r\n\r\n${t.loginLabel}: ${login}\r\n${t.recover.codeLabel}: ${code}\r\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `yourway-${login}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="space-y-4">
      {note && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">{note}</p>}
      <h2 className="text-xl font-extrabold">🔑 {t.code.title}</h2>
      <p className="text-muted">{t.code.text}</p>

      <div className="rounded-3xl border-2 border-dashed border-brand-500/40 bg-brand-50 p-5 text-center">
        <p className="text-sm text-muted">
          {t.loginLabel}: <b className="text-ink">{login}</b>
        </p>
        <p className="mt-2 select-all break-all font-mono text-2xl font-bold tracking-wider text-ink sm:text-3xl">
          {code}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={copy}
            className="min-h-11 rounded-2xl bg-white px-4 font-semibold text-brand-600 shadow-sm active:bg-brand-100"
          >
            {copied ? `✓ ${t.code.copied}` : t.code.copy}
          </button>
          <button
            type="button"
            onClick={download}
            className="min-h-11 rounded-2xl bg-white px-4 font-semibold text-brand-600 shadow-sm active:bg-brand-100"
          >
            {t.code.download}
          </button>
        </div>
      </div>

      <p className="text-sm text-muted">{t.code.tips}</p>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-slate-200 p-4">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-brand-500"
        />
        <span className="font-semibold">{t.code.confirm}</span>
      </label>

      {saved ? (
        <Link
          href={next}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-brand-500 px-6 text-base font-bold text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600 active:bg-brand-700"
        >
          {t.code.continue}
        </Link>
      ) : (
        <span
          aria-disabled
          className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-2xl bg-slate-200 px-6 text-base font-bold text-slate-500"
        >
          {t.code.continue}
        </span>
      )}
    </div>
  );
}
