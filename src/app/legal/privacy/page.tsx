import Link from "next/link";

export const metadata = {
  title: "Privacy Policy · Wallaura",
};

const LAST_UPDATED = "2026-04-30";
const CONTACT_EMAIL = "tal.gurevich2@gmail.com";

export default function PrivacyPage() {
  return (
    <main
      lang="en"
      dir="ltr"
      className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 text-left"
    >
      <p className="text-xs text-zinc-500">Last updated: {LAST_UPDATED}</p>
      <h1 className="mt-2 text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-500">
        This policy explains what personal data Wallaura
        (<strong>wallaura.art</strong>) collects, how we use it, and the
        choices you have.
      </p>

      <section className="prose prose-sm mt-8 max-w-none space-y-6 dark:prose-invert">
        <h2 className="text-lg font-semibold">1. What we collect</h2>
        <ul className="list-disc space-y-1 pr-6">
          <li>
            <strong>Identifiers:</strong> phone number (in international
            format), name, shipping address, optional email address.
          </li>
          <li>
            <strong>Order content:</strong> the sticker image you submit, the
            size / quantity / cut you select, the price you paid, and any
            free-text notes.
          </li>
          <li>
            <strong>WhatsApp messages:</strong> when you choose to send your
            sticker via WhatsApp, the inbound message is processed by our
            messaging gateway and stored as part of your order. We do not
            initiate marketing messages on WhatsApp.
          </li>
          <li>
            <strong>Technical data:</strong> standard server logs (request
            time, status, user-agent) for security and debugging. We do not
            run advertising or analytics cookies.
          </li>
        </ul>

        <h2 className="text-lg font-semibold">2. Why we use it</h2>
        <ul className="list-disc space-y-1 pr-6">
          <li>To fulfill the order and ship the printed stickers to you.</li>
          <li>
            To send transactional notifications by email (order confirmation,
            shipped notice).
          </li>
          <li>To respond when you contact us.</li>
          <li>To prevent fraud and abuse and to comply with the law.</li>
        </ul>

        <h2 className="text-lg font-semibold">3. Who we share it with</h2>
        <p>
          We share the minimum amount of data necessary with third-party
          processors who help us run the service:
        </p>
        <ul className="list-disc space-y-1 pr-6">
          <li>
            <strong>Supabase</strong> — database and image storage (host: EU).
          </li>
          <li>
            <strong>Vercel</strong> — application hosting and serverless
            functions.
          </li>
          <li>
            <strong>Prodigi</strong> — print and shipping fulfillment (UK / EU).
          </li>
          <li>
            <strong>Resend</strong> — transactional email delivery.
          </li>
          <li>
            <strong>Green API</strong> — WhatsApp messaging gateway.
          </li>
          <li>
            <strong>PayPlus</strong> — payment processing (when payments are
            enabled). PayPlus handles card data directly; we do not see or
            store full card numbers.
          </li>
        </ul>
        <p>
          We do not sell your personal data and do not share it with anyone
          for marketing purposes.
        </p>

        <h2 className="text-lg font-semibold">4. How long we keep it</h2>
        <ul className="list-disc space-y-1 pr-6">
          <li>
            <strong>Open browsing sessions</strong> (no order placed) expire
            after 60 minutes and are deleted automatically along with their
            uploaded image.
          </li>
          <li>
            <strong>Unmatched WhatsApp messages</strong> expire after 15
            minutes and are deleted.
          </li>
          <li>
            <strong>Orders</strong> (and their images) are kept while the
            order is active and afterwards as needed for accounting and
            customer-support purposes, up to the period required by Israeli
            tax law (typically 7 years).
          </li>
        </ul>

        <h2 className="text-lg font-semibold">5. Your rights</h2>
        <p>
          Subject to applicable law, you may ask us to access, correct, or
          delete the personal data we hold about you, and to restrict or
          object to certain uses. To exercise any of these rights, contact us
          at <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>.
          We will respond within 30 days. Note that we may need to keep data
          required to fulfill an active order or to comply with a legal
          obligation even after a deletion request.
        </p>

        <h2 className="text-lg font-semibold">6. Security</h2>
        <p>
          We use HTTPS for all traffic, store images in a private bucket
          accessed via short-lived signed URLs, and limit access to
          production credentials to a small number of people. No system is
          perfectly secure; if you believe your account has been compromised,
          please contact us.
        </p>

        <h2 className="text-lg font-semibold">7. Children</h2>
        <p>
          The service is not intended for children under 18. We do not
          knowingly collect personal data from children. If you believe a
          child has submitted data to us, contact us and we will delete it.
        </p>

        <h2 className="text-lg font-semibold">8. International transfers</h2>
        <p>
          Some of our processors are based outside Israel (UK, EU, US). When
          we transfer data internationally we rely on contractual safeguards
          that those processors offer (such as standard contractual clauses).
        </p>

        <h2 className="text-lg font-semibold">9. Changes</h2>
        <p>
          We may update this policy from time to time. The &quot;Last
          updated&quot; date at the top reflects the most recent change.
        </p>

        <h2 className="text-lg font-semibold">10. Contact</h2>
        <p>
          Privacy questions or requests: <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <hr className="my-10 border-zinc-200 dark:border-zinc-800" />
      <p className="text-xs text-zinc-500">
        See also the <Link href="/legal/terms" className="underline">Terms of Service</Link>.
      </p>
    </main>
  );
}
