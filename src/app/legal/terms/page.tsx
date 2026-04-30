import Link from "next/link";

export const metadata = {
  title: "Terms of Service · Wallaura",
};

const LAST_UPDATED = "2026-04-30";
const CONTACT_EMAIL = "tal.gurevich2@gmail.com";

export default function TermsPage() {
  return (
    <main
      lang="en"
      dir="ltr"
      className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 text-left"
    >
      <p className="text-xs text-zinc-500">Last updated: {LAST_UPDATED}</p>
      <h1 className="mt-2 text-3xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-zinc-500">
        These terms govern use of <strong>wallaura.art</strong> (&ldquo;Wallaura,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us&rdquo;). By placing an order or otherwise
        using the service, you agree to them. If you do not agree, please do
        not use the service.
      </p>

      <section className="prose prose-sm mt-8 max-w-none space-y-6 dark:prose-invert">
        <h2 className="text-lg font-semibold">1. The service</h2>
        <p>
          Wallaura turns stickers from a customer&apos;s WhatsApp library (or
          another image they own) into physical printed stickers, fulfilled
          and shipped through a third-party print provider (currently Prodigi,
          based in the UK / EU).
        </p>

        <h2 className="text-lg font-semibold">2. Eligibility</h2>
        <p>
          You must be 18 or older to place an order. If you are under 18, a
          parent or legal guardian must place the order on your behalf.
        </p>

        <h2 className="text-lg font-semibold">3. Identification, no password</h2>
        <p>
          The service identifies customers by phone number rather than by
          username and password. By placing an order, you confirm the phone
          number you provide is yours and that you are authorized to receive
          messages on it. We may verify ownership by sending you a one-time
          code on WhatsApp.
        </p>

        <h2 className="text-lg font-semibold">4. Your content and rights</h2>
        <p>
          You are responsible for any image you submit (whether via WhatsApp
          or otherwise). You represent and warrant that you own the rights to
          print, reproduce, and ship that image, or have permission from the
          rights holder. You agree not to submit images that:
        </p>
        <ul className="list-disc space-y-1 pr-6">
          <li>infringe third-party intellectual property,</li>
          <li>are unlawful, hateful, harassing, defamatory, or violent,</li>
          <li>depict sexual content involving minors,</li>
          <li>identify a private person without their consent.</li>
        </ul>
        <p>
          We may refuse to print an image at our discretion and will refund
          any payment made for an order we refuse. You grant Wallaura and our
          fulfillment partner a non-exclusive, time-limited license to store,
          process, and reproduce the image solely for the purpose of
          fulfilling your order.
        </p>

        <h2 className="text-lg font-semibold">5. Orders and pricing</h2>
        <p>
          Prices are shown in New Israeli Shekels (₪) and include any
          applicable taxes. Once payment is captured, the order is binding;
          before payment is captured, no order is placed. We reserve the
          right to correct pricing errors and to refuse or cancel orders for
          any reason permitted by law.
        </p>

        <h2 className="text-lg font-semibold">6. Fulfillment and shipping</h2>
        <p>
          Stickers are printed and shipped by our fulfillment partner. Typical
          shipping time to Israel is 7–14 business days from the day the order
          enters production. Shipping addresses outside Israel are not
          supported in the current version of the service.
        </p>

        <h2 className="text-lg font-semibold">7. Cancellations, returns, refunds</h2>
        <p>
          Because each order is custom-made, we generally cannot accept
          returns. You may cancel an order any time before it has been sent
          to the print provider for a full refund. If your order arrives
          damaged or significantly different from what you ordered, please
          contact us within 14 days of delivery and we will arrange a refund
          or replacement.
        </p>

        <h2 className="text-lg font-semibold">8. Service availability</h2>
        <p>
          We provide the service on an &quot;as is&quot; and &quot;as
          available&quot; basis. We may change, suspend, or discontinue any
          part of the service at any time without prior notice. We do not
          guarantee that the service will be uninterrupted or error-free.
        </p>

        <h2 className="text-lg font-semibold">9. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, our total liability for any
          claim arising out of or relating to the service is limited to the
          amount you paid for the order at issue. We are not liable for
          indirect, consequential, or incidental damages.
        </p>

        <h2 className="text-lg font-semibold">10. Governing law</h2>
        <p>
          These terms are governed by the laws of the State of Israel. The
          competent courts of Tel Aviv-Jaffa have exclusive jurisdiction over
          any dispute arising out of or relating to the service.
        </p>

        <h2 className="text-lg font-semibold">11. Changes</h2>
        <p>
          We may update these terms from time to time. The &quot;Last
          updated&quot; date at the top reflects the most recent change. Your
          continued use of the service after a change means you accept the
          updated terms.
        </p>

        <h2 className="text-lg font-semibold">12. Contact</h2>
        <p>
          Questions, concerns, or notices: <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <hr className="my-10 border-zinc-200 dark:border-zinc-800" />
      <p className="text-xs text-zinc-500">
        See also the <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </main>
  );
}
