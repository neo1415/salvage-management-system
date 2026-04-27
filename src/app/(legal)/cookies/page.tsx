import { Metadata } from 'next/link';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cookie Policy | NEM Insurance',
  description: 'Cookie Policy for NEM Insurance Salvage Auction Platform',
};

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg p-8 md:p-12">
          <div className="mb-8 pb-6 border-b border-gray-200">
            <h1 className="text-4xl font-bold text-burgundy-900 mb-2">Cookie Policy</h1>
            <p className="text-gray-600">Last Updated: April 27, 2026</p>
          </div>

          <div className="prose prose-burgundy max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">1. What Are Cookies?</h2>
              <p className="text-gray-700 mb-4">
                Cookies are small text files stored on your device when you visit our Platform. They help us provide you with 
                a better experience by remembering your preferences and understanding how you use our services.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">2. Cookies We Use</h2>
              
              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">2.1 Essential Cookies (Always Active)</h3>
              <p className="text-gray-700 mb-4">These cookies are necessary for the Platform to function:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
                <li><strong>Authentication:</strong> Keep you logged in</li>
                <li><strong>Security:</strong> Protect against fraud and attacks</li>
                <li><strong>Session Management:</strong> Remember your actions during a session</li>
              </ul>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">2.2 Functional Cookies</h3>
              <p className="text-gray-700 mb-4">These cookies enhance functionality:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
                <li><strong>Preferences:</strong> Remember your settings and choices</li>
                <li><strong>Language:</strong> Store your language preference</li>
                <li><strong>Cookie Consent:</strong> Remember your cookie preferences</li>
              </ul>

              <h3 className="text-xl font-semibold text-burgundy-800 mb-3 mt-6">2.3 Analytics Cookies</h3>
              <p className="text-gray-700 mb-4">These cookies help us understand how you use the Platform:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Usage Analytics:</strong> Track page views and user journeys</li>
                <li><strong>Performance:</strong> Monitor Platform performance</li>
                <li><strong>Error Tracking:</strong> Identify and fix technical issues</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">3. Cookie Duration</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Session Cookies:</strong> Deleted when you close your browser</li>
                <li><strong>Persistent Cookies:</strong> Remain for a set period (up to 1 year)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">4. Managing Cookies</h2>
              <p className="text-gray-700 mb-4">You can control cookies through:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
                <li><strong>Browser Settings:</strong> Most browsers allow you to refuse or delete cookies</li>
                <li><strong>Cookie Banner:</strong> Manage preferences via our cookie consent banner</li>
              </ul>
              
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Disabling essential cookies may affect Platform functionality.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">5. Third-Party Cookies</h2>
              <p className="text-gray-700 mb-4">We use services that may set their own cookies:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Paystack:</strong> Payment processing</li>
                <li><strong>Google Cloud:</strong> Analytics and AI services</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-burgundy-900 mb-4">6. Contact Us</h2>
              <p className="text-gray-700">
                For questions about cookies, contact us at: <a href="mailto:privacy@neminsurance.com" className="text-burgundy-700 hover:text-burgundy-900 underline">privacy@neminsurance.com</a>
              </p>
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
