"use server";

import { redirect } from "next/navigation";
import { isPathType } from "@/lib/assessment/tests";
import { createSession } from "@/lib/session";
import { getLocale } from "@/i18n/server";

// Выбор на экране-развилке: создаём новую анонимную сессию и переходим к тестам.
export async function startTests(formData: FormData) {
  const pathType = formData.get("pathType");
  if (!isPathType(pathType)) redirect("/start");
  await createSession(pathType, await getLocale());
  redirect("/test");
}
