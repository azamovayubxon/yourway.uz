import { OG_SIZE, shareOgImage } from "@/lib/og/share-images";
import { getShareCard } from "@/lib/share";

// Превью ссылки /t/[code] для Telegram и других мессенджеров (этап 2б), 1200×630: повёрнутая
// бирюзовая карточка, «Мой тип:», название, три сильные стороны, логотип. Только то, что есть
// в ShareCard. Рисуется на каждый запрос: удалённая карточка — сразу 404.
export const dynamic = "force-dynamic";
export const alt = "yourway.uz";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const card = await getShareCard((await params).code);
  if (!card) return new Response(null, { status: 404 });
  return shareOgImage(card);
}
