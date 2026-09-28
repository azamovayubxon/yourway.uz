import type { ReactNode } from "react";
import type { SoonDirection } from "@/lib/directions";

// Простые линейные иконки главной (24×24, цвет — currentColor). Декоративные: aria-hidden.

function Icon({ children, className = "size-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={"shrink-0 " + className}
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

const PATHS: Record<SoonDirection | "person" | "globe" | "send" | "check" | "close", ReactNode> = {
  // Шапочка выпускника
  university: (
    <>
      <path d="M2.5 9.5 12 5l9.5 4.5L12 14 2.5 9.5Z" />
      <path d="M6.5 11.5v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4" />
      <path d="M21.5 9.5V14" />
    </>
  ),
  // Взрослый и ребёнок
  parents: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M3.5 20c.4-3.6 2.6-6 5.5-6s5.1 2.4 5.5 6" />
      <circle cx="17" cy="10" r="2.2" />
      <path d="M15 20c.2-2.3 1-3.9 2-3.9s2.8 1.3 3.2 3.9" />
    </>
  ),
  // Самолёт
  abroad: (
    <>
      <path d="M10.5 13.5 3 11l1.5-1.5 8 .5 4.5-4.5a2 2 0 0 1 3 3L15.5 13l.5 8L14.5 22.5 12 15" />
      <path d="M7 17l-2.5 2.5" />
    </>
  ),
  // Облачко с текстом
  language: (
    <>
      <path d="M4 5h16v11H9l-5 4V5Z" />
      <path d="M8 9h8M8 12.5h5" />
    </>
  ),
  // Календарь-планшет
  exam: (
    <>
      <rect x="4" y="4.5" width="16" height="16" rx="2.5" />
      <path d="M8 2.5v4M16 2.5v4M4 9.5h16" />
      <path d="m9 15 2 2 4-4" />
    </>
  ),
  // Ноутбук
  online: (
    <>
      <rect x="4.5" y="5" width="15" height="10" rx="1.5" />
      <path d="M2.5 19h19" />
    </>
  ),
  // Портфель
  business: (
    <>
      <rect x="3" y="7.5" width="18" height="12" rx="2" />
      <path d="M9 7.5V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2M3 12.5h18" />
    </>
  ),
  // Мяч
  sport: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.3 3.7 5.1 3.7 8.5S14.5 18.2 12 20.5M12 3.5C9.5 5.8 8.3 8.6 8.3 12s1.2 6.2 3.7 8.5" />
    </>
  ),
  // Палитра
  hobby: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.8 0-1 .8-1.7 1.8-1.7h2.2c2 0 3.7-1.6 3.7-3.8C20.5 6.6 16.7 3.5 12 3.5Z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10" cy="7.5" r="1" />
      <circle cx="14.5" cy="7.5" r="1" />
    </>
  ),
  // Монеты
  money: (
    <>
      <ellipse cx="9" cy="7" rx="5.5" ry="2.5" />
      <path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5M3.5 11v4c0 1.4 2.5 2.5 5.5 2.5" />
      <ellipse cx="15" cy="13.5" rx="5.5" ry="2.5" />
      <path d="M9.5 13.5v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4" />
    </>
  ),
  // Двое людей
  people: (
    <>
      <circle cx="8.5" cy="8" r="3" />
      <circle cx="16.5" cy="9" r="2.5" />
      <path d="M3 19.5c.4-3.3 2.6-5.5 5.5-5.5s5.1 2.2 5.5 5.5M14.5 14.3c.6-.2 1.3-.3 2-.3 2.4 0 4.1 1.8 4.5 4.5" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.6-4 3.3-6.5 7-6.5s6.4 2.5 7 6.5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5s1.2-6.1 3.5-8.5Z" />
    </>
  ),
  // Бумажный самолётик (Telegram)
  send: <path d="M21 3.5 10 14.5M21 3.5l-6.5 17-4.5-6-6-4.5 17-6.5Z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
};

export function LandingIcon({ name, className }: { name: keyof typeof PATHS; className?: string }) {
  return <Icon className={className}>{PATHS[name]}</Icon>;
}
