import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'NDPR Compliance | NEM Insurance Salvage Auction Platform',
  description: 'Nigeria Data Protection Regulation (NDPR) Compliance Statement',
};

export default function NDPRCompliancePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg p-8 md:p-12">
          {/* Header */}
          <div className="mb-8 pb-6 border-b border-gray-200">
            <h1 className="text-4xl font-bold text-burgundy-900 mb-2">NDPR Compliance Statement</h1>
            <p className="text-gray-600">Last Updated: April 27, 2026</p>
            <p className="text-sm text-gray-500 mt-2">
              Nigeria Data Protection Act 2023 (NDPA 2023) & Nigeria Data Protection Regulation (NDPR) Compliant
            </p>
          </div>

          {/* Compliance Badge */}
          <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                ✓
              </div>
              <div>
                <h2 className="text-2xl font-bold text-green-900 mb-1">Fully Compliant</h2>
                <p className="text-green-800">
                  NEM Insurance Salvage Auction Platform is fully compliant with NDPA 2023 and NDPR requirements
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="prose prose-burgundy max-w-none">
            {/* Section 1 */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">1. Our Commitment to Data Protection</h2>
              <p className="text-gray-700 mb-4">
                NEM Insurance Plc ("we", "us", or "our") is committed to protecting the privacy and personal data of all 
                users of our Salvage Auction Platform. We comply with:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Nigeria Data Protection Act 2023 (NDPA 2023)</strong> - The primary data protection law in Nigeria</li>
                <li><strong>Nigeria Data Protection Regulation (NDPR)</strong> - Issued by the Nigeria Data Protection Commission (NDPC)</li>
                <li><strong>NITDA Guidelines</strong> - National Information Technology Development Agency guidelines</li>
                <li><strong>Insurance Industry Regulations</strong> - NAICOM data protection requirements</li>
              </ul>
            </section>

            {/* Section 2 */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">2. Data Protection Principles</h2>
              <p className="text-gray-700 mb-4">
                We adhere to the following data protection principles as required by NDPA 2023:
              </p>
              
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-burgundy-800 mb-2">2.1 Lawfulness, Fairness, and Transparency</h3>
                  <p className="text-gray-700 text-sm">
                    We process personal data lawfully, fairly, and in a transparent manner. We clearly communicate how 
                    we collect, use, and protect your data.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-burgundy-800 mb-2">2.2 Purpose Limitation</h3>
                  <p className="text-gray-700 text-sm">
                    We collect personal data for specified, explicit, and legitimate purposes only. We do not process 
                    data in a manner incompatible with those purposes.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-burgundy-800 mb-2">2.3 Data Minimization</h3>
                  <p className="text-gray-700 text-sm">
                    We collect only the personal data that is adequate, relevant, and limited to what is necessary for 
                    the purposes for which it is processed.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-burgundy-800 mb-2">2.4 Accuracy</h3>
                  <p className="text-gray-700 text-sm">
                    We take reasonable steps to ensure personal data is accurate and kept up to date. Inaccurate data 
                    is erased or rectified without delay.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-burgundy-800 mb-2">2.5 Storage Limitation</h3>
                  <p className="text-gray-700 text-sm">
                    We retain personal data only for as long as necessary for the purposes for which it was collected, 
                    or as required by law (7 years for financial records, 5 years for KYC data).
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-burgundy-800 mb-2">2.6 Integrity and Confidentiality</h3>
                  <p className="text-gray-700 text-sm">
                    We implement appropriate technical and organizational measures to ensure data security, including 
                    protection against unauthorized or unlawful processing and accidental loss, destruction, or damage.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-burgundy-800 mb-2">2.7 Accountability</h3>
                  <p className="text-gray-700 text-sm">
                    We are responsible for and can demonstrate compliance with all data protection principles through 
                    documentation, policies, and regular audits.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">3. Legal Basis for Processing</h2>
              <p className="text-gray-700 mb-4">
                We process personal data based on the following lawful grounds under NDPA 2023:
              </p>
              
              <ul className="list-disc pl-6 space-y-3 text-gray-700">
                <li>
                  <strong>Consent:</strong> You provide explicit consent when creating an account and accepting our Terms of Service
                </li>
                <li>
                  <strong>Contract Performance:</strong> Processing is necessary to perform our contract with you (auction participation, payments)
                </li>
                <li>
                  <strong>Legal Obligation:</strong> Processing is required to comply with Nigerian laws (KYC/AML, tax reporting, insurance regulations)
                </li>
                <li>
                  <strong>Legitimate Interests:</strong> Processing is necessary for our legitimate business interests (fraud prevention, platform improvement)
                </li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">4. Data Subject Rights</h2>
              <p className="text-gray-700 mb-4">
                Under NDPA 2023, you have the following rights regarding your personal data:
              </p>
              
              <div className="bg-burgundy-50 border-l-4 border-burgundy-600 p-6 mb-4">
                <h3 className="font-bold text-burgundy-900 mb-3">Your Rights:</h3>
                <ul className="space-y-2 text-burgundy-800">
                  <li>✓ <strong>Right to Access:</strong> Request copies of your personal data</li>
                  <li>✓ <strong>Right to Rectification:</strong> Correct inaccurate or incomplete data</li>
                  <li>✓ <strong>Right to Erasure:</strong> Request deletion of your data (subject to legal obligations)</li>
                  <li>✓ <strong>Right to Restrict Processing:</strong> Limit how we use your data</li>
                  <li>✓ <strong>Right to Data Portability:</strong> Receive your data in a structured, machine-readable format</li>
                  <li>✓ <strong>Right to Object:</strong> Object to processing based on legitimate interests</li>
                  <li>✓ <strong>Right to Withdraw Consent:</strong> Withdraw consent at any time (where consent is the legal basis)</li>
                  <li>✓ <strong>Right to Lodge a Complaint:</strong> File a complaint with the Nigeria Data Protection Commission (NDPC)</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <p className="text-sm text-yellow-800">
                  <strong>How to Exercise Your Rights:</strong> Contact our Data Protection Officer at 
                  <a href="mailto:dpo@neminsurance.com" className="underline ml-1">dpo@neminsurance.com</a>. 
                  We will respond within 30 days as required by NDPA 2023.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">5. Data Security Measures</h2>
              <p className="text-gray-700 mb-4">
                We implement comprehensive technical and organizational security measures:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-burgundy-800 mb-2">Technical Measures</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• TLS/SSL encryption in transit</li>
                    <li>• AES-256 encryption at rest</li>
                    <li>• Multi-factor authentication</li>
                    <li>• Regular security audits</li>
                    <li>• Intrusion detection systems</li>
                    <li>• Automated backup systems</li>
                  </ul>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-burgundy-800 mb-2">Organizational Measures</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Access control policies</li>
                    <li>• Employee training programs</li>
                    <li>• Data protection impact assessments</li>
                    <li>• Incident response procedures</li>
                    <li>• Vendor security assessments</li>
                    <li>• Regular compliance audits</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 6 */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">6. Data Breach Notification</h2>
              <p className="text-gray-700 mb-4">
                In compliance with NDPA 2023 Section 41, we have established procedures for data breach management:
              </p>
              
              <div className="bg-red-50 border-l-4 border-red-400 p-4">
                <h3 className="font-semibold text-red-900 mb-2">72-Hour Notification Requirement</h3>
                <p className="text-sm text-red-800 mb-2">
                  In the event of a personal data breach, we will:
                </p>
                <ul className="text-sm text-red-800 space-y-1">
                  <li>1. Notify the Nigeria Data Protection Commission (NDPC) within 72 hours</li>
                  <li>2. Notify affected data subjects without undue delay</li>
                  <li>3. Provide details of the breach, its likely consequences, and remedial measures</li>
                  <li>4. Document all breaches in our breach register</li>
                </ul>
              </div>
            </section>

            {/* Section 7 */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">7. International Data Transfers</h2>
              <p className="text-gray-700 mb-4">
                Some of our service providers process data outside Nigeria. We ensure adequate protection through:
              </p>
              
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Standard Contractual Clauses:</strong> Approved by NDPC for international transfers</li>
                <li><strong>Adequacy Decisions:</strong> Transfers to countries with adequate data protection laws</li>
                <li><strong>Binding Corporate Rules:</strong> For transfers within multinational organizations</li>
                <li><strong>Explicit Consent:</strong> Where required for specific transfers</li>
              </ul>

              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mt-4">
                <p className="text-sm text-blue-800">
                  <strong>Our International Partners:</strong> Google Cloud (USA - adequacy decision), 
                  Paystack (Nigeria), Dojah (Nigeria), Vercel (USA - standard contractual clauses)
                </p>
              </div>
            </section>

            {/* Section 8 */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">8. Data Protection Officer (DPO)</h2>
              <p className="text-gray-700 mb-4">
                As required by NDPA 2023, we have appointed a Data Protection Officer responsible for:
              </p>
              
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
                <li>Monitoring compliance with NDPA 2023 and NDPR</li>
                <li>Advising on data protection impact assessments</li>
                <li>Serving as the point of contact for data subjects and NDPC</li>
                <li>Conducting regular data protection audits</li>
                <li>Providing data protection training to staff</li>
              </ul>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-bold text-burgundy-900 mb-3">Contact Our DPO:</h3>
                <p className="text-gray-700 mb-2"><strong>Email:</strong> dpo@neminsurance.com</p>
                <p className="text-gray-700 mb-2"><strong>Phone:</strong> +234 (0) 1 234 5678</p>
                <p className="text-gray-700"><strong>Address:</strong> 199 Ikorodu Road, Obanikoro, Lagos, Nigeria</p>
              </div>
            </section>

            {/* Section 9 */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">9. Third-Party Data Processors</h2>
              <p className="text-gray-700 mb-4">
                We engage the following third-party processors, all of whom are contractually bound to NDPA 2023 requirements:
              </p>
              
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200">
                  <thead className="bg-burgundy-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-burgundy-900 border-b">Processor</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-burgundy-900 border-b">Purpose</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-burgundy-900 border-b">Location</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-gray-700">
                    <tr className="border-b">
                      <td className="px-4 py-3">Paystack</td>
                      <td className="px-4 py-3">Payment processing</td>
                      <td className="px-4 py-3">Nigeria</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-3">Dojah</td>
                      <td className="px-4 py-3">KYC verification</td>
                      <td className="px-4 py-3">Nigeria</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-3">Google Cloud</td>
                      <td className="px-4 py-3">AI services, hosting</td>
                      <td className="px-4 py-3">USA (adequacy)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">Vercel</td>
                      <td className="px-4 py-3">Platform hosting</td>
                      <td className="px-4 py-3">USA (SCC)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 10 */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">10. Compliance Monitoring & Audits</h2>
              <p className="text-gray-700 mb-4">
                We conduct regular compliance monitoring activities:
              </p>
              
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Quarterly Internal Audits:</strong> Review of data processing activities</li>
                <li><strong>Annual External Audits:</strong> Independent assessment by certified auditors</li>
                <li><strong>Data Protection Impact Assessments (DPIAs):</strong> For high-risk processing activities</li>
                <li><strong>Staff Training:</strong> Mandatory annual data protection training for all employees</li>
                <li><strong>Vendor Assessments:</strong> Regular review of third-party processor compliance</li>
              </ul>
            </section>

            {/* Section 11 */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">11. Filing a Complaint with NDPC</h2>
              <p className="text-gray-700 mb-4">
                If you believe we have not adequately addressed your data protection concerns, you have the right to 
                lodge a complaint with the Nigeria Data Protection Commission:
              </p>
              
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-bold text-burgundy-900 mb-3">Nigeria Data Protection Commission (NDPC)</h3>
                <p className="text-gray-700 mb-2"><strong>Website:</strong> <a href="https://ndpc.gov.ng" target="_blank" rel="noopener noreferrer" className="text-burgundy-700 hover:text-burgundy-900 underline">www.ndpc.gov.ng</a></p>
                <p className="text-gray-700 mb-2"><strong>Email:</strong> info@ndpc.gov.ng</p>
                <p className="text-gray-700 mb-2"><strong>Phone:</strong> +234 (0) 9 461 4000</p>
                <p className="text-gray-700"><strong>Address:</strong> National Information Technology Development Agency (NITDA) Complex, Abuja, Nigeria</p>
              </div>
            </section>

            {/* Section 12 */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">12. Updates to This Statement</h2>
              <p className="text-gray-700">
                We review and update this NDPR Compliance Statement annually or when there are material changes to our 
                data processing activities or applicable laws. The "Last Updated" date at the top of this page indicates 
                when this statement was last revised.
              </p>
            </section>

            {/* Certification Statement */}
            <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6 mt-8">
              <h3 className="text-xl font-bold text-green-900 mb-3">Compliance Certification</h3>
              <p className="text-green-800 mb-2">
                This NDPR Compliance Statement was prepared in accordance with the Nigeria Data Protection Act 2023 
                and the Nigeria Data Protection Regulation. NEM Insurance Plc certifies that:
              </p>
              <ul className="text-sm text-green-800 space-y-1 ml-4">
                <li>✓ We have implemented all required technical and organizational measures</li>
                <li>✓ We have appointed a qualified Data Protection Officer</li>
                <li>✓ We conduct regular data protection impact assessments</li>
                <li>✓ We maintain comprehensive records of processing activities</li>
                <li>✓ We have established procedures for data breach notification</li>
                <li>✓ We respect and facilitate the exercise of data subject rights</li>
              </ul>
              <p className="text-sm text-green-700 mt-4 italic">
                Signed: Data Protection Officer, NEM Insurance Plc | Date: April 27, 2026
              </p>
            </div>
          </div>

          {/* Related Documents */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="font-bold text-burgundy-900 mb-4">Related Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link 
                href="/privacy" 
                className="block bg-burgundy-50 hover:bg-burgundy-100 rounded-lg p-4 transition-colors"
              >
                <h4 className="font-semibold text-burgundy-900 mb-1">Privacy Policy</h4>
                <p className="text-sm text-gray-600">How we collect and use your data</p>
              </Link>
              <Link 
                href="/terms" 
                className="block bg-burgundy-50 hover:bg-burgundy-100 rounded-lg p-4 transition-colors"
              >
                <h4 className="font-semibold text-burgundy-900 mb-1">Terms of Service</h4>
                <p className="text-sm text-gray-600">Platform usage terms and conditions</p>
              </Link>
              <Link 
                href="/cookies" 
                className="block bg-burgundy-50 hover:bg-burgundy-100 rounded-lg p-4 transition-colors"
              >
                <h4 className="font-semibold text-burgundy-900 mb-1">Cookie Policy</h4>
                <p className="text-sm text-gray-600">How we use cookies and tracking</p>
              </Link>
            </div>
          </div>

          {/* Back to Home */}
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
