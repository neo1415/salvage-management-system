import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | NEM Insurance Salvage Auction Platform',
  description: 'Privacy Policy for NEM Insurance Salvage Auction Platform - NDPA 2023 Compliant',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg p-8 md:p-12">
          <div className="mb-8 pb-6 border-b border-gray-200">
            <h1 className="text-4xl font-bold text-burgundy-900 mb-2">Privacy Policy</h1>
            <p className="text-gray-600">Last Updated: April 27, 2026</p>
            <p className="text-sm text-gray-500 mt-2">NDPA 2023 Compliant | Version 1.0</p>
          </div>

          <div className="prose prose-burgundy max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">1. Introduction</h2>
              <p className="text-gray-700 mb-4">
                NEM Insurance Plc ("we", "us", or "our") is committed to protecting your personal data and respecting your privacy rights. 
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Salvage Auction Platform.
              </p>
              <p className="text-gray-700 mb-4">
                We comply with the Nigeria Data Protection Act 2023 (NDPA 2023) and the Nigeria Data Protection Regulation (NDPR). 
                This policy should be read together with our <Link href="/terms" className="text-burgundy-700 hover:text-burgundy-900 underline">Terms of Service</Link> and 
                our <Link href="/ndpr" className="text-burgundy-700 hover:text-burgundy-900 underline">NDPR Compliance Statement</Link>.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">2. Data Controller Information</h2>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-700 mb-2"><strong>Data Controller:</strong> NEM Insurance Plc</p>
                <p className="text-gray-700 mb-2"><strong>Address:</strong> 199 Ikorodu Road, Obanikoro, Lagos, Nigeria</p>
                <p className="text-gray-700 mb-2"><strong>Email:</strong> privacy@neminsurance.com</p>
                <p className="text-gray-700 mb-2"><strong>Data Protection Officer:</strong> dpo@neminsurance.com</p>
                <p className="text-gray-700">RC Number: 1234567</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">3. Personal Data We Collect</h2>
              
              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">3.1 Information You Provide</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
                <li><strong>Account Information:</strong> Name, email address, phone number, password</li>
                <li><strong>KYC Information:</strong> BVN, NIN, Driver's License number, biometric data (Tier 2)</li>
                <li><strong>Financial Information:</strong> Bank account details, payment card information (processed by Paystack)</li>
                <li><strong>Business Information:</strong> Company name, business registration number (for corporate accounts)</li>
                <li><strong>Communications:</strong> Messages, support tickets, feedback</li>
              </ul>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">3.2 Information Collected Automatically</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
                <li><strong>Device Information:</strong> IP address, browser type, device type, operating system</li>
                <li><strong>Usage Data:</strong> Pages visited, time spent, clicks, bids placed</li>
                <li><strong>Location Data:</strong> Approximate location based on IP address</li>
                <li><strong>Cookies:</strong> See our <Link href="/cookies" className="text-burgundy-700 hover:text-burgundy-900 underline">Cookie Policy</Link></li>
              </ul>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">3.3 Information from Third Parties</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Dojah:</strong> KYC verification results, biometric data</li>
                <li><strong>Paystack:</strong> Payment transaction data</li>
                <li><strong>Google Cloud:</strong> AI assessment data</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">4. How We Use Your Data</h2>
              <p className="text-gray-700 mb-4">We process your personal data for the following purposes:</p>
              
              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">4.1 Contract Performance</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
                <li>Creating and managing your account</li>
                <li>Processing bids and auction transactions</li>
                <li>Facilitating payments and refunds</li>
                <li>Generating auction documents</li>
              </ul>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">4.2 Legal Compliance</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
                <li>KYC/AML verification</li>
                <li>Fraud detection and prevention</li>
                <li>Responding to legal requests</li>
                <li>Tax reporting</li>
              </ul>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">4.3 Legitimate Interests</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Improving Platform functionality</li>
                <li>Analyzing usage patterns</li>
                <li>Sending service notifications</li>
                <li>Protecting against security threats</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">5. Data Sharing & Disclosure</h2>
              <p className="text-gray-700 mb-4">We share your data with:</p>
              
              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">5.1 Service Providers</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
                <li><strong>Paystack:</strong> Payment processing</li>
                <li><strong>Dojah:</strong> KYC verification</li>
                <li><strong>Google Cloud:</strong> AI services, hosting</li>
                <li><strong>Vercel:</strong> Platform hosting</li>
              </ul>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">5.2 Legal Requirements</h3>
              <p className="text-gray-700 mb-4">We may disclose your data to:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
                <li>Law enforcement agencies</li>
                <li>Regulatory authorities (NITDA, NAICOM)</li>
                <li>Courts and tribunals</li>
                <li>Tax authorities (FIRS)</li>
              </ul>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">5.3 Business Transfers</h3>
              <p className="text-gray-700">
                In the event of a merger, acquisition, or sale of assets, your data may be transferred to the acquiring entity.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">6. Your Rights Under NDPA 2023</h2>
              <p className="text-gray-700 mb-4">You have the following rights:</p>
              
              <ul className="list-disc pl-6 space-y-3 text-gray-700">
                <li><strong>Right to Access:</strong> Request copies of your personal data</li>
                <li><strong>Right to Rectification:</strong> Correct inaccurate or incomplete data</li>
                <li><strong>Right to Erasure:</strong> Request deletion of your data (subject to legal obligations)</li>
                <li><strong>Right to Restrict Processing:</strong> Limit how we use your data</li>
                <li><strong>Right to Data Portability:</strong> Receive your data in a structured format</li>
                <li><strong>Right to Object:</strong> Object to processing based on legitimate interests</li>
                <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time</li>
                <li><strong>Right to Lodge a Complaint:</strong> File a complaint with NITDA</li>
              </ul>

              <div className="bg-burgundy-50 border-l-4 border-burgundy-600 p-4 my-4">
                <p className="text-burgundy-900">
                  <strong>To exercise your rights:</strong> Email dpo@neminsurance.com with your request. 
                  We will respond within 30 days as required by NDPA 2023.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">7. Data Retention</h2>
              <p className="text-gray-700 mb-4">We retain your data for:</p>
              
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Account Data:</strong> Duration of account + 7 years (tax/legal requirements)</li>
                <li><strong>Transaction Data:</strong> 7 years (financial regulations)</li>
                <li><strong>KYC Data:</strong> 5 years after account closure (AML requirements)</li>
                <li><strong>Marketing Data:</strong> Until consent is withdrawn</li>
                <li><strong>Cookies:</strong> See our <Link href="/cookies" className="text-burgundy-700 hover:text-burgundy-900 underline">Cookie Policy</Link></li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">8. Data Security</h2>
              <p className="text-gray-700 mb-4">We implement appropriate technical and organizational measures:</p>
              
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Encryption in transit (TLS/SSL) and at rest</li>
                <li>Access controls and authentication</li>
                <li>Regular security audits</li>
                <li>Employee training on data protection</li>
                <li>Incident response procedures</li>
              </ul>

              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
                <p className="text-sm text-yellow-800">
                  <strong>Data Breach Notification:</strong> In the event of a data breach, we will notify affected users 
                  and NITDA within 72 hours as required by NDPA 2023.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">9. International Data Transfers</h2>
              <p className="text-gray-700 mb-4">
                Some of our service providers (Google Cloud, Vercel) may process data outside Nigeria. We ensure adequate 
                safeguards through:
              </p>
              
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Standard Contractual Clauses</li>
                <li>Adequacy decisions by NITDA</li>
                <li>Binding Corporate Rules</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">10. Children's Privacy</h2>
              <p className="text-gray-700">
                The Platform is not intended for users under 18 years of age. We do not knowingly collect data from children. 
                If you believe we have collected data from a child, please contact us immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">11. Changes to This Policy</h2>
              <p className="text-gray-700">
                We may update this Privacy Policy from time to time. Material changes will be notified via email or Platform 
                notification 30 days before taking effect.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">12. Contact Us</h2>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-700 mb-2"><strong>Privacy Inquiries:</strong> privacy@neminsurance.com</p>
                <p className="text-gray-700 mb-2"><strong>Data Protection Officer:</strong> dpo@neminsurance.com</p>
                <p className="text-gray-700 mb-2"><strong>Phone:</strong> +234 (0) 1 234 5678</p>
                <p className="text-gray-700"><strong>Address:</strong> 199 Ikorodu Road, Obanikoro, Lagos, Nigeria</p>
              </div>
            </section>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <Link 
              href="/" 
              className="inline-block bg-burgundy-700 hover:bg-burgundy-800 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
