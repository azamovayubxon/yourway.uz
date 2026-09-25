// Платёжные провайдеры (CLAUDE.md §8). Остальной код знает только интерфейс PaymentProvider.
// Сейчас есть только `test` (тестовая оплата без денег, только вне боевого сайта).
// На этапе 9 рядом появятся payme.ts, click.ts, uzum.ts: они тоже реализуют PaymentProvider,
// а подтверждение оплаты придёт от шлюза вебхуком.
//
// Данные карт у нас не хранятся никогда: человек платит на стороне шлюза, а мы храним только
// id транзакции, сумму и статус (модель Payment).

import { testPaymentsEnabled } from "./config";

export interface PaymentForProvider {
  id: string;
  amount: number;
  currency: string;
}

export interface PaymentProvider {
  // test | payme | click | uzum
  id: string;
  // Можно ли сейчас принимать оплату через этого провайдера.
  available(): boolean;
  // Начать оплату: куда отправить человека (страница шлюза).
  start(payment: PaymentForProvider): { redirectUrl: string };
}

export const testProvider: PaymentProvider = {
  id: "test",
  available: testPaymentsEnabled,
  // Тестовый «шлюз» — наша страница с кнопками «Оплатить» и «Отменить».
  start: (payment) => ({ redirectUrl: `/checkout/test/${payment.id}` }),
};

const PROVIDERS: PaymentProvider[] = [testProvider];

// Провайдер, через который сейчас принимается оплата (null — оплата пока недоступна).
export function activePaymentProvider(): PaymentProvider | null {
  return PROVIDERS.find((p) => p.available()) ?? null;
}
