import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Access Restricted</h1>
        <p className="mt-3 text-gray-600">
          Your account does not have permission to open this page.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-md bg-[#800020] px-4 py-2 text-sm font-medium text-white hover:bg-[#6b001b]"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
