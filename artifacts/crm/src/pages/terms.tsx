import LegalLayout from "@/components/LegalLayout";

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" effectiveDate="28 May 2026">
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Agreement to Terms</h2>
        <p>By accessing or using Marwo ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, you may not use the Service. These Terms apply to all users, including business owners, administrators, and staff members who access the Service through a company account.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Description of Service</h2>
        <p>Marwo is a cloud-based field service management and customer relationship management (CRM) platform designed for small and medium-sized businesses operating in the UAE and wider GCC region. The Service includes tools for managing customers, invoices, quotations, work orders, tasks, assets, contracts, technicians, and related business operations.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Account Registration</h2>
        <p>To use the Service, you must create an account and provide accurate, complete information. You are responsible for:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Maintaining the confidentiality of your account credentials.</li>
          <li>All activity that occurs under your account.</li>
          <li>Notifying us immediately of any unauthorised use of your account.</li>
          <li>Ensuring that all users added to your company workspace comply with these Terms.</li>
        </ul>
        <p className="mt-2">You must be at least 18 years old and have the legal authority to enter into this agreement on behalf of your business.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Subscription and Payments</h2>
        <p>The Service is offered on a subscription basis. Subscription fees are charged monthly in advance. Payments are processed securely by <strong>Paddle</strong>, our authorised merchant of record. By subscribing, you authorise Paddle to charge your payment method on a recurring basis.</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>All prices are listed in UAE Dirhams (AED) unless otherwise stated.</li>
          <li>Taxes (including VAT where applicable) may be added at checkout.</li>
          <li>Paddle is the merchant of record for all transactions. Their terms and privacy policy apply to payment processing.</li>
          <li>We reserve the right to change pricing with at least 30 days' notice.</li>
          <li>Failure to pay may result in suspension or termination of your account.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Free Trial</h2>
        <p>New accounts may be eligible for a 14-day free trial. No credit card is required to start a trial. At the end of the trial period, you must subscribe to a paid plan to continue using the Service. We reserve the right to modify or discontinue the free trial offer at any time.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Acceptable Use</h2>
        <p>You agree not to use the Service to:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Violate any applicable laws or regulations, including UAE federal laws and regulations.</li>
          <li>Upload or transmit any unlawful, harmful, or offensive content.</li>
          <li>Attempt to gain unauthorised access to the Service or its infrastructure.</li>
          <li>Reverse-engineer, decompile, or attempt to extract the source code of the Service.</li>
          <li>Use automated tools to scrape, crawl, or extract data from the Service.</li>
          <li>Resell or sublicense the Service to third parties without written permission.</li>
          <li>Interfere with or disrupt the integrity or performance of the Service.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Data Ownership and Responsibility</h2>
        <p>You retain full ownership of all data you enter into Marwo ("Your Data"). You are solely responsible for the accuracy, legality, and appropriateness of Your Data. By using the Service, you grant Marwo a limited licence to store, process, and transmit Your Data solely for the purpose of providing the Service.</p>
        <p className="mt-2">We do not sell Your Data to third parties. Your Data is stored in Google Firebase infrastructure. See our Privacy Policy for full details.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Intellectual Property</h2>
        <p>All intellectual property rights in the Service — including the software, design, logos, trademarks, and documentation — are owned by or licensed to Marwo. Nothing in these Terms transfers any intellectual property rights to you. You may not copy, reproduce, or create derivative works from any part of the Service without prior written consent.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Termination</h2>
        <p>You may cancel your subscription at any time from the billing settings in your account. Cancellation takes effect at the end of the current billing period. We may suspend or terminate your account immediately if you breach these Terms, fail to pay, or if we are required to do so by law.</p>
        <p className="mt-2">Upon termination, you may request an export of Your Data within 30 days. After that period, we may delete Your Data in accordance with our data retention policy.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Disclaimer of Warranties</h2>
        <p>The Service is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not warrant that the Service will be uninterrupted, error-free, or completely secure. Your use of the Service is at your own risk.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Limitation of Liability</h2>
        <p>To the fullest extent permitted by applicable law, Marwo shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or relating to your use of the Service, including loss of data, revenue, or profits. Our total liability to you shall not exceed the amount you paid to us in the three months preceding the claim.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">12. Governing Law</h2>
        <p>These Terms are governed by and construed in accordance with the laws of the United Arab Emirates. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts of the UAE.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">13. Changes to Terms</h2>
        <p>We may update these Terms from time to time. If we make material changes, we will notify you by email or by a prominent notice in the Service at least 14 days before the changes take effect. Continued use of the Service after changes constitutes acceptance of the new Terms.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">14. Contact Us</h2>
        <p>If you have questions about these Terms, please contact us at <a href="mailto:support@marwo.app" className="text-blue-600 hover:underline">support@marwo.app</a>.</p>
      </section>
    </LegalLayout>
  );
}
