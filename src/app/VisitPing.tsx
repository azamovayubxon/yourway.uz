"use client";

import { useEffect } from "react";

// Отмечает «заход на сайт» для аналитики воронки (/admin/analytics). Ничего не отображает.
export function VisitPing() {
  useEffect(() => {
    fetch("/api/visit", { method: "POST" }).catch(() => {});
  }, []);
  return null;
}
