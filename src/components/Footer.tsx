import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";

export function Footer({ t }: { t: Dictionary }) {
  const links = [
    { href: "/how-it-works", label: t.footer.howItWorks },
    { href: "/pricing", label: t.footer.pricing },
    { href: "/faq", label: t.footer.faq },
    { href: "/offer", label: t.footer.offer },
    { href: "/privacy", label: t.footer.privacy },
    { href: "/refund", label: t.footer.refund },
  ];
  return (
    <footer className="mt-16 border-t border-slate-100 bg-slate-50">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="text-lg font-extrabold">
            your<span className="text-brand-500">way</span>.uz
          </p>
          <p className="mt-2 text-sm text-muted">{t.footer.tagline}</p>
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="py-1.5 text-ink hover:text-brand-600">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="text-sm">
          <p className="font-semibold">{t.footer.contactsTitle}</p>
          <p className="mt-2 text-muted">{t.footer.contactsValue}</p>
        </div>
      </div>
      <p className="pb-8 text-center text-xs text-muted">
        © {new Date().getFullYear()} yourway.uz. {t.footer.rights}
      </p>
    </footer>
  );
}
