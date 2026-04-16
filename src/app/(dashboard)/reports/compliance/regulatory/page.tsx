import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Regulatory Compliance | Reports',
  description: 'Regulatory compliance and reporting',
};

export default function RegulatoryCompliancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Regulatory Compliance</h1>
        <p className="text-gray-600 mt-2">
          Monitor regulatory compliance, reporting requirements, and policy adherence
        </p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">
          ⚠️ This report is under development. Regulatory compliance data will be available soon.
        </p>
      </div>
    </div>
  );
}
