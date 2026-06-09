import { PickupConfirmationDesk } from '@/components/pickups/pickup-confirmation-desk';

export default function ManagerPickupsPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-gray-900">Pickup Confirmations</h1>
          <p className="mt-2 text-gray-600">
            Validate pickup codes, release assets to winning vendors, and close the transaction trail.
          </p>
        </header>

        <PickupConfirmationDesk />
      </div>
    </main>
  );
}
