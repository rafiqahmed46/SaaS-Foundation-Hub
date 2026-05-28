import LegalLayout from "@/components/LegalLayout";

export default function RefundPage() {
  return (
    <LegalLayout title="Refund Policy" effectiveDate="28 May 2026">
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Overview</h2>
        <p>We want you to be completely satisfied with Marwo. This Refund Policy explains when and how you can receive a refund for your subscription. All payments are processed by <strong>Paddle</strong>, our merchant of record, and refunds are issued through Paddle in accordance with this policy.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Free Trial</h2>
        <p>All new accounts are eligible for a <strong>14-day free trial</strong>. No payment method is required during the trial period. If you choose not to subscribe after the trial, your account will simply become inactive — no charge will be made and no refund request is necessary.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">3. 7-Day Money-Back Guarantee</h2>
        <p>If you subscribe to a paid plan and are not satisfied with the Service, you may request a full refund within <strong>7 days</strong> of your first payment. To qualify:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Your refund request must be submitted within 7 calendar days of the initial charge.</li>
          <li>This applies to first-time subscribers only. Renewals are not covered by the money-back guarantee.</li>
          <li>The refund covers the full subscription amount charged, excluding any taxes collected by Paddle where non-refundable under local law.</li>
        </ul>
        <p className="mt-2">To request a refund under this guarantee, email <a href="mailto:support@marwo.app" className="text-blue-600 hover:underline">support@marwo.app</a> with your account email and the subject line "Refund Request". We will process your request within 3–5 business days.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Subscription Renewals</h2>
        <p>Monthly subscription renewals are <strong>non-refundable</strong>. If you wish to cancel, you should do so before the next billing cycle begins. You will retain access to the Service until the end of the period you have already paid for. We do not issue pro-rated refunds for partial months.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Cancellation</h2>
        <p>You may cancel your subscription at any time from within the app (Settings → Billing) or by contacting Paddle's customer support. Cancellation stops future charges but does not issue a refund for the current billing period. Your account remains active until the end of the current period.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Exceptional Circumstances</h2>
        <p>We will consider refund requests outside of the standard policy in the following circumstances:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong>Service outage:</strong> If the Service experiences a significant outage (more than 72 continuous hours) that prevents you from using it, you may be eligible for a pro-rated credit or refund for the affected period.</li>
          <li><strong>Duplicate charge:</strong> If you are charged more than once for the same billing period due to a technical error, we will refund the duplicate charge in full.</li>
          <li><strong>Unauthorised charge:</strong> If you believe a charge was made without your authorisation, contact us immediately at <a href="mailto:support@marwo.app" className="text-blue-600 hover:underline">support@marwo.app</a>.</li>
        </ul>
        <p className="mt-2">Each request is reviewed on a case-by-case basis. We reserve the right to decline refund requests that do not meet the above criteria.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Refund Processing</h2>
        <p>Approved refunds are processed by <strong>Paddle</strong> and returned to the original payment method. Refund timing depends on your bank or card issuer and typically takes <strong>5–10 business days</strong> to appear on your statement after approval.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Changes to This Policy</h2>
        <p>We reserve the right to update this Refund Policy at any time. Changes will be communicated via email or an in-app notice at least 14 days before taking effect. Continued use of the Service after changes constitutes acceptance of the updated policy.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Contact Us</h2>
        <p>For all refund requests and billing questions, please contact us at:</p>
        <address className="mt-2 not-italic text-gray-600">
          <strong>Marwo Support</strong><br />
          Email: <a href="mailto:support@marwo.app" className="text-blue-600 hover:underline">support@marwo.app</a><br />
          Response time: within 1–2 business days
        </address>
        <p className="mt-3 text-gray-500 text-xs">For payment-related disputes processed by Paddle, you may also contact Paddle directly through their support portal.</p>
      </section>
    </LegalLayout>
  );
}
