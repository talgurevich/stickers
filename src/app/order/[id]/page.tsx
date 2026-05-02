import Link from "next/link";
import { serverClient } from "@/lib/supabase";
import {
  PRODUCT_LABELS_HE,
  isProductType,
  variantFor,
} from "@/lib/prodigi-catalog";
import { formatIls } from "@/lib/pricing";

export const runtime = "nodejs";

type OrderRow = {
  id: string;
  product_type: string | null;
  size_mm: string;
  cut_type: string;
  quantity: number;
  shipping_address: { name: string; city: string };
  total_agorot: number;
  paid_at: string | null;
  printful_order_id: string | null;
  printful_status: string | null;
};

async function loadOrder(id: string): Promise<OrderRow | null> {
  const { data } = await serverClient()
    .from("orders")
    .select(
      "id, product_type, size_mm, cut_type, quantity, shipping_address, total_agorot, paid_at, printful_order_id, printful_status",
    )
    .eq("id", id)
    .maybeSingle();
  return (data as OrderRow) ?? null;
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await loadOrder(id);

  if (!order) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-bold">הזמנה לא נמצאה</h1>
          <Link className="text-sm underline" href="/">
            חזרה לדף הבית
          </Link>
        </div>
      </main>
    );
  }

  const productType = isProductType(order.product_type)
    ? order.product_type
    : "sticker";
  const variant = variantFor(productType, order.size_mm);
  const productLabel = PRODUCT_LABELS_HE[productType];

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
      <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-center">
          <div className="text-5xl">✓</div>
          <h1 className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            ההזמנה התקבלה
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            מצב נוכחי: בדיקה — אין חיוב, ההזמנה נשלחה ל־Prodigi כטיוטה לאישור ידני.
          </p>
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">מספר הזמנה</dt>
            <dd className="font-mono text-xs">{order.id}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">סוג</dt>
            <dd>{productLabel}</dd>
          </div>
          {variant && (
            <div className="flex justify-between">
              <dt className="text-zinc-500">גודל</dt>
              <dd>{variant.labelHe}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-zinc-500">כמות</dt>
            <dd>{order.quantity}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">סכום</dt>
            <dd>{formatIls(order.total_agorot)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">משלוח אל</dt>
            <dd>
              {order.shipping_address.name} · {order.shipping_address.city}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">סטטוס Prodigi</dt>
            <dd>
              {order.printful_order_id ? (
                <span dir="ltr" className="font-mono text-xs">
                  {order.printful_order_id} · {order.printful_status ?? "—"}
                </span>
              ) : (
                <span className="text-amber-600">בהמתנה</span>
              )}
            </dd>
          </div>
        </dl>

        <Link
          href="/"
          className="block w-full rounded-full bg-zinc-900 py-3 text-center text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          חזרה לדף הבית
        </Link>
      </div>
    </main>
  );
}
