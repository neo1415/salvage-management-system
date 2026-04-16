import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Audit Trail | Reports',
  description: 'System audit logs and compliance tracking',
};

export default function AuditTrailPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Audit Trail</h1>
        <p className="text-gray-600 mt-2">
          View system activity logs, user actions, and compliance audit records
        </p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">
          ⚠️ This report is under development. Audit trail data will be available soon.
        </p>
      </div>
    </div>
  );
}
