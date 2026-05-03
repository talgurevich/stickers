// Cart confirmation page — shown after checkout. Displays every order row
// in the cart with its image, alongside one shared shipping/payment summary.

import Link from "next/link";
import { serverClient, STORAGE_BUCKET } from "@/lib/supabase";
import {
  PRODUCT_LABELS_HE,
  isProductType,
  variantFor,
} from "@/lib/prodigi-catalog";
import { formatIls } from "@/lib/pricing";
import ClearCartOnMount from "./ClearCartOnMount";

export const runtime = "nodejs";

type OrderRow = {
  id: string;
  cart_id: string | null;
  product_type: string | null;
  size_mm: string;
  cut_type: string;
  quantity: number;
  shipping_address: { name: string; city: string };
  product_cost_agorot: number;
  shipping_cost_agorot: number;
  total_agorot: number;
  paid_at: string | null;
  printful_order_id: string | null;
  printful_status: string | null;
  image_url: string;
};

async function loadCart(cartId: string): Promise<OrderRow[]> {
  const { data } = await serverClient()
    .from("orders")
    .select(
      "id, cart_id, product_type, size_mm, cut_type, quantity, shipping_address, product_cost_agorot, shipping_cost_agorot, total_agorot, paid_at, printful_order_id, printful_status, image_url",
    )
    .eq("cart_id", cartId)
    .order("created_at", { ascending: true });
  return (data as OrderRow[]) ?? [];
}

async function signRow(path: string): Promise<string | null> {
  const { data } = await serverClient()
    .storage.from(STORAGE_BUCKET)
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export default async function CartConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rows = await loadCart(id);

  if (rows.length === 0) {
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

  const totalAgorot = rows.reduce((s, r) => s + r.total_agorot, 0);
  const productAgorot = rows.reduce((s, r) => s + r.product_cost_agorot, 0);
  const shippingAgorot = rows.reduce((s, r) => s + r.shipping_cost_agorot, 0);
  const handlingAgorot = totalAgorot - productAgorot - shippingAgorot;
  const fulfillmentId = rows.find((r) => r.printful_order_id)
    ?.printful_order_id;
  const fulfillmentStatus = rows.find((r) => r.printful_status)
    ?.printful_status;

  const previewUrls = await Promise.all(rows.map((r) => signRow(r.image_url)));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <ClearCartOnMount />
      <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-center">
          <div className="text-5xl">✓</div>
          <h1 className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            ההזמנה התקבלה
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {rows.length === 1
              ? "תודה! ההזמנה נשלחה לייצור. נשלח עדכון במייל כשתצא למשלוח."
              : `תודה! ${rows.length} פריטים נשלחים במשלוח אחד. נשלח עדכון במייל כשהחבילה תצא.`}
          </p>
        </div>

        <ul className="space-y-3">
          {rows.map((row, i) => {
            const productType = isProductType(row.product_type)
              ? row.product_type
              : "sticker";
            const variant = variantFor(productType, row.size_mm);
            return (
              <li
                key={row.id}
                className="flex items-center gap-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                {previewUrls[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrls[i]!}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-md object-contain bg-zinc-50 dark:bg-zinc-950"
                  />
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-md bg-zinc-100 dark:bg-zinc-800" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {PRODUCT_LABELS_HE[productType]}
                    {variant ? ` · ${variant.labelHe}` : ` · ${row.size_mm}`}
                  </div>
                  <div className="text-xs text-zinc-500">
                    כמות: {row.quantity}
                  </div>
                </div>
                <div className="text-sm font-semibold">
                  {formatIls(row.product_cost_agorot)}
                </div>
              </li>
            );
          })}
        </ul>

        <dl className="space-y-2 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
          <div className="flex justify-between">
            <dt className="text-zinc-500">מספר הזמנה</dt>
            <dd className="font-mono text-xs">{id}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">פריטים</dt>
            <dd>{formatIls(productAgorot)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">משלוח</dt>
            <dd>{formatIls(shippingAgorot)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">עמלה</dt>
            <dd>{formatIls(handlingAgorot)}</dd>
          </div>
          <div className="flex justify-between pt-2 text-base font-bold">
            <dt>סך הכל</dt>
            <dd>{formatIls(totalAgorot)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">משלוח אל</dt>
            <dd>
              {rows[0].shipping_address.name} · {rows[0].shipping_address.city}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">סטטוס Prodigi</dt>
            <dd>
              {fulfillmentId ? (
                <span dir="ltr" className="font-mono text-xs">
                  {fulfillmentId} · {fulfillmentStatus ?? "—"}
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
