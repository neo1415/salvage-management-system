import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | NEM Insurance Salvage Auction Platform',
  description: 'Terms of Service for NEM Insurance Salvage Auction Platform',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg p-8 md:p-12">
          {/* Header */}
          <div className="mb-8 pb-6 border-b border-gray-200">
            <h1 className="text-4xl font-bold text-burgundy-900 mb-2">Terms of Service</h1>
            <p className="text-gray-600">Last Updated: April 27, 2026</p>
            <p className="text-sm text-gray-500 mt-2">
              Effective Date: April 27, 2026 | Version 1.0
            </p>
          </div>

          {/* Quick Navigation */}
          <div className="bg-burgundy-50 rounded-lg p-6 mb-8">
            <h2 className="font-bold text-burgundy-900 mb-3">Quick Navigation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <a href="#acceptance" className="text-burgundy-700 hover:text-burgundy-900">1. Acceptance of Terms</a>
              <a href="#definitions" className="text-burgundy-700 hover:text-burgundy-900">2. Definitions</a>
              <a href="#eligibility" className="text-burgundy-700 hover:text-burgundy-900">3. Eligibility</a>
              <a href="#registration" className="text-burgundy-700 hover:text-burgundy-900">4. Registration & Account</a>
              <a href="#auction-rules" className="text-burgundy-700 hover:text-burgundy-900">5. Auction Rules</a>
              <a href="#payment" className="text-burgundy-700 hover:text-burgundy-900">6. Payment Terms</a>
              <a href="#warranties" className="text-burgundy-700 hover:text-burgundy-900">7. Warranties & Disclaimers</a>
              <a href="#liability" className="text-burgundy-700 hover:text-burgundy-900">8. Limitation of Liability</a>
              <a href="#indemnification" className="text-burgundy-700 hover:text-burgundy-900">9. Indemnification</a>
              <a href="#termination" className="text-burgundy-700 hover:text-burgundy-900">10. Termination</a>
              <a href="#dispute" className="text-burgundy-700 hover:text-burgundy-900">11. Dispute Resolution</a>
              <a href="#governing-law" className="text-burgundy-700 hover:text-burgundy-900">12. Governing Law</a>
              <a href="#data-protection" className="text-burgundy-700 hover:text-burgundy-900">13. Data Protection</a>
              <a href="#changes" className="text-burgundy-700 hover:text-burgundy-900">14. Changes to Terms</a>
              <a href="#contact" className="text-burgundy-700 hover:text-burgundy-900">15. Contact Information</a>
            </div>
          </div>

          {/* Content */}
          <div className="prose prose-burgundy max-w-none">
            {/* Section 1 */}
            <section id="acceptance" className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-700 mb-4">
                By accessing or using the NEM Insurance Salvage Auction Platform ("Platform"), you ("User", "you", or "your") 
                agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not access 
                or use the Platform.
              </p>
              <p className="text-gray-700 mb-4">
                These Terms constitute a legally binding agreement between you and NEM Insurance Plc ("NEM Insurance", "we", 
                "us", or "our"), a company incorporated under the laws of the Federal Republic of Nigeria with registration 
                number RC 1234567 and registered office at 199 Ikorodu Road, Obanikoro, Lagos, Nigeria.
              </p>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> By clicking "I Accept", registering an account, placing a bid, or using any 
                  feature of the Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms.
                </p>
              </div>
            </section>

            {/* Section 2 */}
            <section id="definitions" className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">2. Definitions</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="font-semibold text-gray-900">"Platform"</dt>
                  <dd className="text-gray-700 ml-4">means the NEM Insurance Salvage Auction Platform, including all websites, mobile applications, APIs, and related services.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-900">"Salvage Asset"</dt>
                  <dd className="text-gray-700 ml-4">means any vehicle, machinery, or other property listed for auction on the Platform following an insurance claim settlement.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-900">"Vendor"</dt>
                  <dd className="text-gray-700 ml-4">means a registered user who participates in auctions by placing bids on Salvage Assets.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-900">"Winning Bid"</dt>
                  <dd className="text-gray-700 ml-4">means the highest valid bid placed before an auction closes, subject to reserve price requirements.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-900">"AI Assessment"</dt>
                  <dd className="text-gray-700 ml-4">means automated damage detection and valuation estimates generated by artificial intelligence algorithms.</dd>
                </div>
              </dl>
            </section>

            {/* Section 3 */}
            <section id="eligibility" className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">3. Eligibility</h2>
              <p className="text-gray-700 mb-4">To use the Platform, you must:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Be at least 18 years of age</li>
                <li>Have the legal capacity to enter into binding contracts under Nigerian law</li>
                <li>Not be prohibited from using the Platform under any applicable laws</li>
                <li>Provide accurate and complete registration information</li>
                <li>Complete Tier 1 KYC verification (BVN, NIN, or Driver's License)</li>
                <li>For transactions exceeding ₦500,000, complete Tier 2 KYC verification (Dojah biometric verification)</li>
              </ul>
              <div className="bg-red-50 border-l-4 border-red-400 p-4 my-4">
                <p className="text-sm text-red-800">
                  <strong>Prohibition:</strong> You may not use the Platform if you have been previously suspended or banned, 
                  or if you are acting on behalf of a suspended or banned entity.
                </p>
              </div>
            </section>

            {/* Section 4 */}
            <section id="registration" className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">4. Registration & Account Security</h2>
              
              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">4.1 Account Creation</h3>
              <p className="text-gray-700 mb-4">
                You must create an account to participate in auctions. You agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain and promptly update your account information</li>
                <li>Keep your password secure and confidential</li>
                <li>Notify us immediately of any unauthorized access to your account</li>
                <li>Accept responsibility for all activities that occur under your account</li>
              </ul>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">4.2 KYC Verification</h3>
              <p className="text-gray-700 mb-4">
                In compliance with Nigerian data protection and anti-money laundering regulations, we require:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Tier 1 KYC:</strong> Bank Verification Number (BVN), National Identification Number (NIN), or Driver's License verification</li>
                <li><strong>Tier 2 KYC:</strong> Biometric verification via Dojah for transactions exceeding ₦500,000</li>
                <li>Annual KYC renewal to maintain account active status</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section id="auction-rules" className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">5. Auction Rules & Bidding</h2>
              
              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">5.1 Binding Bids</h3>
              <div className="bg-burgundy-50 border-l-4 border-burgundy-600 p-4 my-4">
                <p className="text-burgundy-900 font-semibold">
                  ALL BIDS ARE FINAL AND LEGALLY BINDING. By placing a bid, you enter into a binding contract to purchase 
                  the Salvage Asset if you are the winning bidder.
                </p>
              </div>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">5.2 Auction Deposit System</h3>
              <p className="text-gray-700 mb-4">
                To participate in auctions, you must:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
                <li>Maintain a minimum wallet balance as specified by the Platform</li>
                <li>Have sufficient funds frozen as a deposit before placing bids</li>
                <li>Understand that deposits are automatically frozen and released based on auction outcomes</li>
                <li>Accept that winning bid deposits are applied toward the purchase price</li>
                <li>Acknowledge that deposits may be forfeited for non-payment or non-compliance</li>
              </ul>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">5.3 Auction Process</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Auction Duration:</strong> Each auction has a specified start and end time</li>
                <li><strong>Bid Increments:</strong> Minimum bid increments are set by the Platform</li>
                <li><strong>Reserve Price:</strong> Auctions may have undisclosed reserve prices</li>
                <li><strong>Early Closure:</strong> NEM Insurance reserves the right to close auctions early</li>
                <li><strong>Cancellation:</strong> NEM Insurance may cancel auctions at any time without liability</li>
              </ul>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">5.4 Prohibited Conduct</h3>
              <p className="text-gray-700 mb-4">You may not:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Engage in shill bidding or bid manipulation</li>
                <li>Collude with other bidders</li>
                <li>Use automated bidding bots or scripts</li>
                <li>Create multiple accounts to circumvent bidding limits</li>
                <li>Interfere with the auction process in any manner</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section id="payment" className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">6. Payment Terms</h2>
              
              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">6.1 Payment Obligation</h3>
              <p className="text-gray-700 mb-4">
                If you are the winning bidder, you must:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
                <li>Pay the full purchase price within the specified payment deadline (typically 48-72 hours)</li>
                <li>Pay via approved payment methods (Paystack, wallet balance)</li>
                <li>Pay all applicable fees, taxes, and charges</li>
                <li>Complete payment before asset pickup</li>
              </ul>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">6.2 Fees</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Registration Fee:</strong> One-time vendor registration fee (amount set by Platform)</li>
                <li><strong>Transaction Fees:</strong> Payment processing fees charged by Paystack</li>
                <li><strong>Late Payment Fees:</strong> Penalties for missed payment deadlines</li>
              </ul>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">6.3 No Refunds</h3>
              <div className="bg-red-50 border-l-4 border-red-400 p-4 my-4">
                <p className="text-red-900 font-semibold">
                  ALL SALES ARE FINAL. No refunds, returns, or exchanges are permitted under any circumstances.
                </p>
              </div>
            </section>

            {/* Section 7 */}
            <section id="warranties" className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">7. Warranties & Disclaimers</h2>
              
              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">7.1 "AS-IS, WHERE-IS" Sale</h3>
              <div className="bg-yellow-50 border-2 border-yellow-400 p-6 my-4">
                <p className="text-yellow-900 font-bold text-lg mb-3">
                  ALL SALVAGE ASSETS ARE SOLD "AS-IS, WHERE-IS" WITH ALL FAULTS.
                </p>
                <p className="text-yellow-800 mb-2">
                  NEM Insurance makes NO WARRANTIES, EXPRESS OR IMPLIED, including but not limited to:
                </p>
                <ul className="list-disc pl-6 space-y-1 text-yellow-800">
                  <li>Merchantability</li>
                  <li>Fitness for a particular purpose</li>
                  <li>Title or ownership</li>
                  <li>Condition or quality</li>
                  <li>Operability or functionality</li>
                  <li>Accuracy of descriptions or photographs</li>
                </ul>
              </div>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">7.2 AI Assessment Disclaimer</h3>
              <p className="text-gray-700 mb-4">
                AI-generated damage assessments and valuations are:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Estimates Only:</strong> Not guarantees of actual condition or value</li>
                <li><strong>Not Inspections:</strong> Do not replace professional physical inspections</li>
                <li><strong>Subject to Error:</strong> May contain inaccuracies or omissions</li>
                <li><strong>Not Warranties:</strong> Do not constitute any warranty or representation</li>
              </ul>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">7.3 Platform Availability</h3>
              <p className="text-gray-700 mb-4">
                We do not warrant that:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>The Platform will be uninterrupted, secure, or error-free</li>
                <li>Defects will be corrected</li>
                <li>The Platform is free of viruses or harmful components</li>
                <li>Results obtained from the Platform will be accurate or reliable</li>
              </ul>
            </section>

            {/* Section 8 */}
            <section id="liability" className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">8. Limitation of Liability</h2>
              
              <div className="bg-burgundy-50 border-2 border-burgundy-600 p-6 my-4">
                <p className="text-burgundy-900 font-bold text-lg mb-3">
                  MAXIMUM LIABILITY CAP
                </p>
                <p className="text-burgundy-800 mb-2">
                  TO THE MAXIMUM EXTENT PERMITTED BY NIGERIAN LAW, NEM INSURANCE'S TOTAL LIABILITY TO YOU FOR ANY CLAIMS 
                  ARISING FROM OR RELATED TO THE PLATFORM SHALL NOT EXCEED THE LESSER OF:
                </p>
                <ul className="list-disc pl-6 space-y-1 text-burgundy-800">
                  <li>₦50,000 (Fifty Thousand Naira), OR</li>
                  <li>The total amount you paid to NEM Insurance in the 12 months preceding the claim</li>
                </ul>
              </div>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">8.1 Exclusion of Damages</h3>
              <p className="text-gray-700 mb-4">
                NEM Insurance shall not be liable for:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Indirect, incidental, special, consequential, or punitive damages</li>
                <li>Loss of profits, revenue, data, or business opportunities</li>
                <li>Personal injury or property damage (except as required by law)</li>
                <li>Damages arising from third-party services (Paystack, Dojah, Google Cloud)</li>
                <li>Damages resulting from unauthorized access to your account</li>
                <li>Damages caused by your violation of these Terms</li>
              </ul>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">8.2 Third-Party Services</h3>
              <p className="text-gray-700 mb-4">
                The Platform integrates with third-party services including Paystack (payments), Dojah (KYC verification), 
                and Google Cloud (AI services). NEM Insurance is not responsible for:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Service interruptions or failures by third-party providers</li>
                <li>Data breaches or security incidents at third-party providers</li>
                <li>Errors or inaccuracies in third-party data or services</li>
                <li>Changes to third-party terms or pricing</li>
              </ul>
            </section>

            {/* Section 9 */}
            <section id="indemnification" className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">9. Indemnification</h2>
              <p className="text-gray-700 mb-4">
                You agree to indemnify, defend, and hold harmless NEM Insurance, its affiliates, officers, directors, 
                employees, agents, and licensors from and against any claims, liabilities, damages, losses, costs, or 
                expenses (including reasonable attorneys' fees) arising from or related to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Your use of the Platform</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any applicable laws or regulations</li>
                <li>Your violation of any third-party rights</li>
                <li>Your bidding, purchase, or use of Salvage Assets</li>
                <li>Your provision of false or misleading information</li>
                <li>Your fraudulent or illegal conduct</li>
              </ul>
            </section>

            {/* Section 10 */}
            <section id="termination" className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">10. Termination</h2>
              
              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">10.1 Termination by You</h3>
              <p className="text-gray-700 mb-4">
                You may terminate your account at any time by contacting support. Upon termination:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>You remain liable for all outstanding obligations</li>
                <li>Wallet balances will be refunded (minus applicable fees)</li>
                <li>Active bids will be cancelled (subject to penalties)</li>
              </ul>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">10.2 Termination by NEM Insurance</h3>
              <p className="text-gray-700 mb-4">
                We may suspend or terminate your account immediately without notice if:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>You violate these Terms</li>
                <li>You engage in fraudulent or illegal activity</li>
                <li>You fail to pay amounts owed</li>
                <li>Your account is inactive for 12 consecutive months</li>
                <li>We are required to do so by law or court order</li>
              </ul>
            </section>

            {/* Section 11 */}
            <section id="dispute" className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">11. Dispute Resolution</h2>
              
              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">11.1 Informal Resolution</h3>
              <p className="text-gray-700 mb-4">
                Before initiating formal proceedings, you agree to contact us at legal@neminsurance.com to attempt to 
                resolve the dispute informally.
              </p>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">11.2 Arbitration</h3>
              <p className="text-gray-700 mb-4">
                If informal resolution fails, disputes shall be resolved through binding arbitration under the Arbitration 
                and Mediation Act 2023 of Nigeria, administered by the Lagos Court of Arbitration.
              </p>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">11.3 Class Action Waiver</h3>
              <p className="text-gray-700 mb-4">
                You agree that disputes will be resolved on an individual basis only. You waive any right to participate 
                in class actions or class-wide arbitration.
              </p>
            </section>

            {/* Section 12 */}
            <section id="governing-law" className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">12. Governing Law & Jurisdiction</h2>
              <p className="text-gray-700 mb-4">
                These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria, 
                without regard to conflict of law principles.
              </p>
              <p className="text-gray-700 mb-4">
                Subject to the arbitration provisions above, you agree to submit to the exclusive jurisdiction of the courts 
                located in Lagos State, Nigeria.
              </p>
            </section>

            {/* Section 13 */}
            <section id="data-protection" className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">13. Data Protection & Privacy</h2>
              <p className="text-gray-700 mb-4">
                Your use of the Platform is subject to our <Link href="/privacy" className="text-burgundy-700 hover:text-burgundy-900 underline">Privacy Policy</Link>, 
                which is incorporated into these Terms by reference.
              </p>
              <p className="text-gray-700 mb-4">
                We comply with the Nigeria Data Protection Act 2023 (NDPA 2023) and the Nigeria Data Protection Regulation (NDPR). 
                For more information, see our <Link href="/ndpr" className="text-burgundy-700 hover:text-burgundy-900 underline">NDPR Compliance Statement</Link>.
              </p>
            </section>

            {/* Section 14 */}
            <section id="changes" className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">14. Changes to Terms</h2>
              <p className="text-gray-700 mb-4">
                We reserve the right to modify these Terms at any time. Changes will be effective:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
                <li>Immediately upon posting for non-material changes</li>
                <li>30 days after notice for material changes</li>
              </ul>
              <p className="text-gray-700 mb-4">
                Your continued use of the Platform after changes constitutes acceptance of the modified Terms.
              </p>
            </section>

            {/* Section 15 */}
            <section id="contact" className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">15. Contact Information</h2>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-700 mb-2"><strong>NEM Insurance Plc</strong></p>
                <p className="text-gray-700 mb-2">199 Ikorodu Road, Obanikoro</p>
                <p className="text-gray-700 mb-2">Lagos, Nigeria</p>
                <p className="text-gray-700 mb-2">Email: legal@neminsurance.com</p>
                <p className="text-gray-700 mb-2">Phone: +234 (0) 1 234 5678</p>
                <p className="text-gray-700">Data Protection Officer: dpo@neminsurance.com</p>
              </div>
            </section>

            {/* Acknowledgment */}
            <div className="bg-burgundy-900 text-white rounded-lg p-6 mt-8">
              <h3 className="text-xl font-bold mb-3">Acknowledgment</h3>
              <p className="mb-2">
                BY USING THE PLATFORM, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS OF SERVICE.
              </p>
              <p className="text-sm text-gray-300">
                If you do not agree to these Terms, you must immediately cease using the Platform.
              </p>
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
