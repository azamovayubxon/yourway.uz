import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";

// Внутри теста/опроса — сокращённый footer (ТЗ аудита §6): длинная маркетинговая навигация
// отвлекает от прохождения, но помощь (FAQ) и ссылка о данных (приватность) остаются.
export function Footer({ t, compact = false }: { t: Dictionary; compact?: boolean }) {
  if (compact) {
    return (
      <footer className="mt-10 border-t border-line bg-app-bg">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm">
          <Link href="/faq" className="focus-ring rounded font-semibold text-ink hover:text-brand-600">
            {t.footer.faq}
          </Link>
          <Link href="/privacy" className="focus-ring rounded font-semibold text-ink hover:text-brand-600">
            {t.footer.privacy}
          </Link>
          <a href={`mailto:${t.footer.email}`} className="focus-ring rounded text-muted hover:text-brand-600">
            {t.footer.emailLabel}: {t.footer.email}
          </a>
        </div>
      </footer>
    );
  }

  const links = [
    { href: "/how-it-works", label: t.footer.howItWorks },
    { href: "/pricing", label: t.footer.pricing },
    { href: "/faq", label: t.footer.faq },
    { href: "/offer", label: t.footer.offer },
    { href: "/privacy", label: t.footer.privacy },
    { href: "/refund", label: t.footer.refund },
  ];
  return (
    <footer className="mt-16 border-t border-line bg-app-bg">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="text-lg font-extrabold">
            your<span className="text-brand-500">way</span>.uz
          </p>
          <p className="mt-2 text-sm text-muted">{t.footer.tagline}</p>
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="focus-ring rounded py-1.5 text-ink hover:text-brand-600">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="text-sm">
          <p className="font-semibold">{t.footer.contactsTitle}</p>
          <ul className="mt-2 space-y-1.5 text-muted">
            <li>
              <a href={`https://t.me/${t.footer.telegram.replace(/^@/, "")}`} className="focus-ring rounded hover:text-brand-600">
                {t.footer.telegramLabel}: {t.footer.telegram}
              </a>
            </li>
            <li>
              <a href={`tel:${t.footer.phone.replace(/[^+\d]/g, "")}`} className="focus-ring rounded hover:text-brand-600">
                {t.footer.phoneLabel}: {t.footer.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${t.footer.email}`} className="focus-ring rounded hover:text-brand-600">
                {t.footer.emailLabel}: {t.footer.email}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <p className="pb-8 text-center text-xs text-muted">
        © {new Date().getFullYear()} yourway.uz. {t.footer.rights}
      </p>
    </footer>
  );
}
