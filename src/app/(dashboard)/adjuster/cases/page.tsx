/**
 * Cases List Page
 * 
 * Placeholder for cases list page
 */

'use client';

import { useRouter } from 'next/navigation';

export default function CasesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#800020] text-white p-4">
        <h1 className="text-xl font-bold">My Cases</h1>
      </div>
      
      <div className="p-4">
        <button
          onClick={() => router.push('/adjuster/cases/new')}
          className="w-full px-4 py-3 bg-[#800020] text-white rounded-lg font-medium hover:bg-[#600018]"
        >
          + Create New Case
        </button>
        
        <div className="mt-8 text-center text-gray-500">
          <p>No cases yet. Create your first case!</p>
        </div>
      </div>
    </div>
  );
}
