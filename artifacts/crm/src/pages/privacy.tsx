import LegalLayout from "@/components/LegalLayout";

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" effectiveDate="28 May 2026">
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Introduction</h2>
        <p>Marwo ("we", "us", or "our") is committed to protecting your personal data. This Privacy Policy explains how we collect, use, store, and share information when you use our field service management platform. By using Marwo, you agree to the practices described in this policy.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Information We Collect</h2>
        <p className="font-medium text-gray-700 mb-1">2.1 Account Information</p>
        <p>When you create an account, we collect your name, email address, company name, and password (stored as a secure hash via Firebase Authentication).</p>

        <p className="font-medium text-gray-700 mt-3 mb-1">2.2 Business Data You Enter</p>
        <p>All data you add to Marwo — including customer records, invoices, work orders, assets, contracts, and technician profiles — is stored in Google Firestore and is associated with your company account. You own this data.</p>

        <p className="font-medium text-gray-700 mt-3 mb-1">2.3 Usage and Technical Data</p>
        <p>We may collect technical data such as browser type, device information, IP address, and pages visited within the Service. This data is used for security, debugging, and improving the Service.</p>

        <p className="font-medium text-gray-700 mt-3 mb-1">2.4 Payment Information</p>
        <p>We do not store your payment card details. All payments are processed by <strong>Paddle</strong>, our merchant of record. Paddle collects and handles payment data in accordance with their own privacy policy and PCI-DSS standards. You can review Paddle's privacy policy at <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">paddle.com/legal/privacy</a>.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">3. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Provide, maintain, and improve the Service.</li>
          <li>Authenticate users and manage access to company data.</li>
          <li>Process payments and manage subscriptions (via Paddle).</li>
          <li>Send transactional emails such as invoices, receipts, and account notifications.</li>
          <li>Respond to customer support requests.</li>
          <li>Monitor for fraudulent or abusive activity.</li>
          <li>Comply with legal obligations.</li>
        </ul>
        <p className="mt-2">We do not sell your personal information to third parties and do not use it for advertising purposes.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Data Storage and Security</h2>
        <p>Your data is stored in <strong>Google Firebase (Firestore and Firebase Authentication)</strong>, which is hosted on Google Cloud infrastructure. Google applies industry-standard security controls including encryption at rest and in transit.</p>
        <p className="mt-2">Data is isolated at the company level — each company's data is logically separated and access is controlled through Firebase security rules tied to your authenticated user account. No other company can access your data.</p>
        <p className="mt-2">While we implement reasonable security measures, no system is completely secure. You are responsible for maintaining the security of your account credentials.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Data Sharing</h2>
        <p>We share your information only in the following circumstances:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong>Service providers:</strong> Google (Firebase/Cloud infrastructure), Paddle (payment processing). These providers process data on our behalf under appropriate data protection agreements.</li>
          <li><strong>Legal requirements:</strong> We may disclose data if required by UAE law, court order, or governmental authority.</li>
          <li><strong>Business transfers:</strong> In the event of a merger, acquisition, or sale of assets, your data may be transferred as part of that transaction. You will be notified in advance.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Data Retention</h2>
        <p>We retain your account and business data for as long as your account is active. If you cancel your subscription, your data is retained for 30 days to allow you to export it, after which it may be permanently deleted. You may request immediate deletion of your account and data by contacting us at <a href="mailto:support@marwo.app" className="text-blue-600 hover:underline">support@marwo.app</a>.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Your Rights</h2>
        <p>Depending on your location, you may have the right to:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your data ("right to be forgotten").</li>
          <li>Request a portable copy of your data.</li>
          <li>Withdraw consent where processing is based on consent.</li>
        </ul>
        <p className="mt-2">To exercise any of these rights, contact us at <a href="mailto:support@marwo.app" className="text-blue-600 hover:underline">support@marwo.app</a>. We will respond within 30 days.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Cookies</h2>
        <p>Marwo uses minimal cookies and browser storage to keep you signed in (via Firebase Auth session tokens). We do not use third-party advertising or tracking cookies. You can clear cookies through your browser settings, but this will sign you out of the Service.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Children's Privacy</h2>
        <p>The Service is not directed at individuals under the age of 18. We do not knowingly collect personal information from minors. If you believe a minor has provided us with personal data, please contact us and we will take steps to delete it.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. We will notify you of material changes by email or by a notice in the Service at least 14 days before the change takes effect. The "effective date" at the top of this page indicates when the policy was last updated.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Contact Us</h2>
        <p>If you have any questions, concerns, or requests regarding this Privacy Policy, please contact us at:</p>
        <address className="mt-2 not-italic text-gray-600">
          <strong>Marwo</strong><br />
          Email: <a href="mailto:support@marwo.app" className="text-blue-600 hover:underline">support@marwo.app</a><br />
          United Arab Emirates
        </address>
      </section>
    </LegalLayout>
  );
}
