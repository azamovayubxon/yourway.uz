"use client";

import { useEffect, useId, useRef, useState } from "react";

// Кнопки «Поделиться» и «Сохранить картинку» на странице результата (этап 2б).
//  • «Поделиться»: сначала создаёт (или получает уже созданную) открытую ссылку /t/[code] —
//    POST /api/share; ничего не публикуется без нажатия. Дальше — системное меню «Поделиться»
//    (navigator.share, на телефонах), а если его нет — маленькое меню: Telegram и «Скопировать
//    ссылку». По ссылке видно только название типа и три сильные стороны (решение владельца).
//  • «Сохранить картинку»: PNG 1080×1350 с карточкой типа, рисуется на сервере; маршрут доступен
//    только владельцу тизера и открытую страницу не создаёт.

export interface ShareTexts {
  share: string;
  saveImage: string;
  // Готовый текст сообщения на языке тизера: «Мой тип — X. Узнайте и свой:».
  message: string;
  telegram: string;
  copyLink: string;
  linkCopied: string;
  note: string;
  error: string;
  close: string;
}

type Status = "idle" | "loading" | "error";

export function ShareActions({ teaserId, texts }: { teaserId: string; texts: ShareTexts }) {
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const menuId = useId();

  async function getUrl(): Promise<string | null> {
    if (url) return url;
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teaserId }),
      });
      if (!res.ok) return null;
      const { code } = (await res.json()) as { code?: string };
      if (!code) return null;
      const link = `${window.location.origin}/t/${code}`;
      setUrl(link);
      return link;
    } catch {
      return null;
    }
  }

  async function onShare() {
    if (status === "loading") return;
    setStatus("loading");
    setCopied(false);
    const link = await getUrl();
    if (!link) {
      setStatus("error");
      return;
    }
    setStatus("idle");
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: texts.message, url: link });
        return;
      } catch (e) {
        // Человек закрыл системное меню — ничего не делаем; другая ошибка — показываем своё меню.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    setMenuOpen(true);
  }

  async function onCopy() {
    if (!url) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      // Старые браузеры и WebView без доступа к буферу — выделяем ссылку и копируем «по-старому».
      input.current?.select();
      ok = document.execCommand?.("copy") ?? false;
    }
    setCopied(ok);
  }

  function closeMenu() {
    setMenuOpen(false);
    shareButton.current?.focus();
  }

  // Esc и нажатие мимо меню закрывают его; при открытии фокус — на первую кнопку меню.
  useEffect(() => {
    if (!menuOpen) return;
    menu.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        shareButton.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !shareButton.current?.contains(target)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);

  const telegramHref = url
    ? `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(texts.message)}`
    : "#";

  return (
    <div className="relative">
      <div className="grid grid-cols-2 gap-3">
        <button
          ref={shareButton}
          type="button"
          onClick={onShare}
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          aria-busy={status === "loading"}
          className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-4 text-[15px] font-bold text-on-dark transition-opacity disabled:opacity-70"
        >
          <ShareIcon className="size-[18px] shrink-0" />
          {texts.share}
        </button>
        <a
          href={`/api/share/image?teaser=${encodeURIComponent(teaserId)}`}
          download="yourway-tip.png"
          className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-line bg-white px-4 text-center text-[15px] font-bold leading-tight text-ink hover:border-ink"
        >
          <DownloadIcon className="size-[18px] shrink-0" />
          {texts.saveImage}
        </a>
      </div>

      {status === "error" && (
        <p role="alert" className="mt-2 text-sm font-semibold text-brand-600">
          {texts.error}
        </p>
      )}

      {menuOpen && url && (
        <div
          ref={menu}
          id={menuId}
          role="group"
          aria-label={texts.share}
          className="absolute inset-x-0 top-full z-20 mt-2 rounded-3xl border border-line bg-white p-4 shadow-xl shadow-ink/10"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm leading-snug text-muted">{texts.note}</p>
            <button
              type="button"
              onClick={closeMenu}
              aria-label={texts.close}
              className="focus-ring -m-1 flex size-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-muted hover:bg-app-bg"
            >
              ×
            </button>
          </div>
          <input
            ref={input}
            readOnly
            value={url}
            aria-label={texts.copyLink}
            onFocus={(e) => e.currentTarget.select()}
            className="focus-ring mt-3 w-full rounded-2xl border border-line bg-app-bg px-3 py-2.5 text-sm text-ink"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={telegramHref}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring inline-flex min-h-11 items-center justify-center rounded-full bg-teal px-3 text-sm font-bold text-white"
            >
              {texts.telegram}
            </a>
            <button
              type="button"
              onClick={onCopy}
              className="focus-ring inline-flex min-h-11 items-center justify-center rounded-full border border-line px-3 text-sm font-bold text-ink hover:border-ink"
            >
              {texts.copyLink}
            </button>
          </div>
          <p aria-live="polite" className="mt-2 min-h-5 text-center text-sm font-semibold text-teal">
            {copied ? `✓ ${texts.linkCopied}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 15V3M7.5 7.5 12 3l4.5 4.5" />
      <path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 20h16" />
    </svg>
  );
}
