/**
 * ConfirmationModal Component - Usage Examples
 * 
 * This file demonstrates various use cases for the ConfirmationModal component
 */

'use client';

import { useState } from 'react';
import { ConfirmationModal } from './confirmation-modal';
import { useToast } from './toast';

export function ConfirmationModalExamples() {
  const toast = useToast();
  const [showDangerModal, setShowDangerModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Example 1: Danger action (delete, end auction, etc.)
  const handleDangerAction = async () => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsLoading(false);
    setShowDangerModal(false);
    toast.success('Action Completed', 'The dangerous action was executed successfully.');
  };

  // Example 2: Warning action (irreversible changes)
  const handleWarningAction = async () => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsLoading(false);
    setShowWarningModal(false);
    toast.warning('Changes Applied', 'Your changes have been saved.');
  };

  // Example 3: Info action (confirmation needed)
  const handleInfoAction = () => {
    setShowInfoModal(false);
    toast.info('Information Noted', 'Your preference has been recorded.');
  };

  // Example 4: Success action (positive confirmation)
  const handleSuccessAction = () => {
    setShowSuccessModal(false);
    toast.success('Approved!', 'The item has been approved successfully.');
  };

  return (
    <div className="p-8 space-y-4 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">ConfirmationModal Examples</h1>

      {/* Example 1: Danger Modal */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">1. Danger Action</h2>
        <p className="text-gray-600 mb-4">
          Use for destructive actions like deleting data or ending auctions early.
        </p>
        <button
          onClick={() => setShowDangerModal(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Delete Item
        </button>
        
        <ConfirmationModal
          isOpen={showDangerModal}
          onClose={() => setShowDangerModal(false)}
          onConfirm={handleDangerAction}
          title="Delete Item?"
          message="Are you sure you want to delete this item? This action cannot be undone and all associated data will be permanently removed."
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
          isLoading={isLoading}
        />
      </div>

      {/* Example 2: Warning Modal */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">2. Warning Action</h2>
        <p className="text-gray-600 mb-4">
          Use for actions that require caution but aren't destructive.
        </p>
        <button
          onClick={() => setShowWarningModal(true)}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          Apply Changes
        </button>
        
        <ConfirmationModal
          isOpen={showWarningModal}
          onClose={() => setShowWarningModal(false)}
          onConfirm={handleWarningAction}
          title="Apply Changes?"
          message="This will update the configuration for all users. Make sure you've reviewed the changes carefully."
          confirmText="Apply"
          cancelText="Cancel"
          type="warning"
          isLoading={isLoading}
        />
      </div>

      {/* Example 3: Info Modal */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">3. Info Action</h2>
        <p className="text-gray-600 mb-4">
          Use for informational confirmations or preference changes.
        </p>
        <button
          onClick={() => setShowInfoModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Update Preferences
        </button>
        
        <ConfirmationModal
          isOpen={showInfoModal}
          onClose={() => setShowInfoModal(false)}
          onConfirm={handleInfoAction}
          title="Update Preferences?"
          message="Would you like to receive email notifications for new auctions?"
          confirmText="Yes, Enable"
          cancelText="No Thanks"
          type="info"
        />
      </div>

      {/* Example 4: Success Modal */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">4. Success Action</h2>
        <p className="text-gray-600 mb-4">
          Use for positive confirmations or approvals.
        </p>
        <button
          onClick={() => setShowSuccessModal(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Approve Request
        </button>
        
        <ConfirmationModal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          onConfirm={handleSuccessAction}
          title="Approve Request?"
          message="This will approve the vendor's KYC application and grant them full access to the platform."
          confirmText="Approve"
          cancelText="Review Again"
          type="success"
        />
      </div>

      {/* Code Examples */}
      <div className="bg-gray-50 p-6 rounded-lg mt-8">
        <h2 className="text-xl font-semibold mb-4">Code Example</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { useToast } from '@/components/ui/toast';

function MyComponent() {
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await performAction();
      setShowModal(false);
      toast.success('Success!', 'Action completed');
    } catch (error) {
      toast.error('Error', 'Action failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button onClick={() => setShowModal(true)}>
        Trigger Action
      </button>
      
      <ConfirmationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleConfirm}
        title="Confirm Action"
        message="Are you sure?"
        type="danger"
        isLoading={isLoading}
      />
    </>
  );
}`}
        </pre>
      </div>
    </div>
  );
}
