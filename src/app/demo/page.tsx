'use client';

import Link from 'next/link';
import { ExternalLink, CheckCircle2, Clock, Users, FileText, Shield, Truck, DollarSign } from 'lucide-react';

/**
 * TEMPORARY DEMO PAGE
 * 
 * This page provides quick access to all completed UI pages for client demos.
 * 
 * ⚠️ WARNING: This is a TEMPORARY page for demonstration purposes only.
 * It will be replaced when the proper navigation/dashboard is implemented.
 * 
 * See tasks.md for the actual navigation implementation tasks.
 */

interface DemoLink {
  title: string;
  description: string;
  path: string;
  status: 'complete' | 'in-progress' | 'pending';
  icon: React.ReactNode;
  category: string;
}

export default function DemoPage() {
  const demoLinks: DemoLink[] = [
    // Landing & Auth
    {
      title: 'Landing Page',
      description: 'Public-facing homepage with hero, features, and CTAs',
      path: '/',
      status: 'complete',
      icon: <FileText className="w-6 h-6" />,
      category: 'Public Pages',
    },
    {
      title: 'Registration',
      description: 'Vendor registration with email/phone and OAuth options',
      path: '/register',
      status: 'complete',
      icon: <Users className="w-6 h-6" />,
      category: 'Authentication',
    },
    {
      title: 'Login',
      description: 'Login with credentials or OAuth (Google/Facebook)',
      path: '/login',
      status: 'complete',
      icon: <Shield className="w-6 h-6" />,
      category: 'Authentication',
    },
    {
      title: 'OTP Verification',
      description: 'Phone number verification with 6-digit OTP',
      path: '/verify-otp?phone=%2B2348012345678',
      status: 'complete',
      icon: <CheckCircle2 className="w-6 h-6" />,
      category: 'Authentication',
    },

    // Vendor KYC
    {
      title: 'Tier 1 KYC (BVN)',
      description: 'Basic vendor verification with BVN',
      path: '/vendor/kyc/tier1',
      status: 'complete',
      icon: <Shield className="w-6 h-6" />,
      category: 'Vendor KYC',
    },
    {
      title: 'Tier 2 KYC (Full)',
      description: 'Advanced verification with NIN, bank account, and documents',
      path: '/vendor/kyc/tier2',
      status: 'complete',
      icon: <Shield className="w-6 h-6" />,
      category: 'Vendor KYC',
    },

    // Vendor Dashboard
    {
      title: 'Vendor Dashboard',
      description: 'Main vendor dashboard with stats and quick actions (mock data)',
      path: '/vendor/dashboard',
      status: 'complete',
      icon: <DollarSign className="w-6 h-6" />,
      category: 'Vendor',
    },

    // Manager Pages
    {
      title: 'Vendor Approval Queue',
      description: 'Manager page to approve/reject Tier 2 vendor applications',
      path: '/manager/vendors',
      status: 'complete',
      icon: <Users className="w-6 h-6" />,
      category: 'Manager',
    },
    {
      title: 'Case Approval Queue',
      description: 'Manager page to approve/reject salvage cases',
      path: '/manager/approvals',
      status: 'complete',
      icon: <CheckCircle2 className="w-6 h-6" />,
      category: 'Manager',
    },

    // Adjuster Pages
    {
      title: 'Create Salvage Case',
      description: 'Mobile-optimized case creation with photo upload and AI assessment',
      path: '/adjuster/cases/new',
      status: 'complete',
      icon: <Truck className="w-6 h-6" />,
      category: 'Adjuster',
    },
    {
      title: 'Cases List',
      description: 'View all salvage cases',
      path: '/adjuster/cases',
      status: 'complete',
      icon: <FileText className="w-6 h-6" />,
      category: 'Adjuster',
    },
  ];

  const categories = Array.from(new Set(demoLinks.map(link => link.category)));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'pending':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'in-progress':
        return <Clock className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-[#800020] text-white py-8 px-4 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#FFD700] rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#800020]" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Salvage Management System</h1>
                <p className="text-gray-200 text-sm">UI Demo - Client Showcase</p>
              </div>
            </div>
            
            {/* Logout Button */}
            <button
              onClick={async () => {
                if (confirm('Logout and clear all session data?')) {
                  try {
                    const { signOut } = await import('next-auth/react');
                    await fetch('/api/auth/logout', { method: 'POST' });
                    await signOut({ redirect: false });
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = '/login';
                  } catch (error) {
                    console.error('Logout error:', error);
                    window.location.href = '/login';
                  }
                }
              }}
              className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
          
          {/* Warning Banner */}
          <div className="mt-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-sm text-yellow-100">
              ⚠️ <strong>Temporary Demo Page:</strong> This page is for demonstration purposes only. 
              It will be replaced with proper navigation when the dashboard is implemented.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {demoLinks.filter(l => l.status === 'complete').length}
                </p>
                <p className="text-sm text-gray-600">Completed Pages</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
                <p className="text-sm text-gray-600">Categories</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">3</p>
                <p className="text-sm text-gray-600">User Roles</p>
              </div>
            </div>
          </div>
        </div>

        {/* Links by Category */}
        {categories.map((category) => (
          <div key={category} className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-1 h-8 bg-[#800020] rounded"></div>
              {category}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {demoLinks
                .filter((link) => link.category === category)
                .map((link) => (
                  <Link
                    key={link.path}
                    href={link.path}
                    className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border-2 border-transparent hover:border-[#800020]"
                  >
                    <div className="p-6">
                      {/* Icon & Status */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-[#800020]/10 rounded-lg flex items-center justify-center text-[#800020] group-hover:bg-[#800020] group-hover:text-white transition-colors">
                          {link.icon}
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${getStatusColor(
                            link.status
                          )}`}
                        >
                          {getStatusIcon(link.status)}
                          {link.status}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-[#800020] transition-colors">
                        {link.title}
                      </h3>

                      {/* Description */}
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {link.description}
                      </p>

                      {/* Link */}
                      <div className="flex items-center gap-2 text-[#800020] font-medium text-sm group-hover:gap-3 transition-all">
                        <span>View Page</span>
                        <ExternalLink className="w-4 h-4" />
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        ))}

        {/* Footer Note */}
        <div className="mt-12 bg-white rounded-xl shadow-md p-6 border-l-4 border-[#800020]">
          <h3 className="text-lg font-bold text-gray-900 mb-2">📝 Implementation Notes</h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• All pages are mobile-responsive and follow the design system</li>
            <li>• Authentication flow is fully functional with NextAuth v5</li>
            <li>• Some pages use mock data until backend APIs are implemented</li>
            <li>• Proper navigation will be implemented as per tasks.md</li>
            <li>• This demo page will be removed once the main dashboard is complete</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
