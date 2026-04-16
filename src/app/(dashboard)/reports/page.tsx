'use client';

/**
 * Reports Hub - Main Landing Page
 * Task 33: Reports Hub & Navigation
 * 
 * Central hub for accessing all reports with search, favorites, and recent reports
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  TrendingUp, 
  DollarSign, 
  Users, 
  FileText, 
  BarChart3,
  Clock,
  Star,
  ChevronRight,
  Shield,
  Briefcase,
  PieChart
} from 'lucide-react';
import { ROLE_PERMISSIONS } from '@/features/reports/types';

interface ReportCategory {
  id: string;
  name: string;
  description: string;
  icon: any;
  reports: ReportItem[];
  requiredPermission: keyof typeof ROLE_PERMISSIONS[keyof typeof ROLE_PERMISSIONS];
}

interface ReportItem {
  id: string;
  name: string;
  description: string;
  path: string;
  icon: any;
}

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: 'financial',
    name: 'Financial Reports',
    description: 'Revenue, payments, spending, and profitability analysis',
    icon: DollarSign,
    requiredPermission: 'canViewFinancial',
    reports: [
      {
        id: 'revenue-analysis',
        name: 'Revenue Analysis',
        description: 'Total revenue, recovery rates, and trends',
        path: '/reports/financial/revenue-analysis',
        icon: TrendingUp,
      },
      {
        id: 'payment-analytics',
        name: 'Payment Analytics',
        description: 'Payment processing times and success rates',
        path: '/reports/financial/payment-analytics',
        icon: DollarSign,
      },
      {
        id: 'vendor-spending',
        name: 'Vendor Spending',
        description: 'Top spenders and spending patterns',
        path: '/reports/financial/vendor-spending',
        icon: Briefcase,
      },
      {
        id: 'profitability',
        name: 'Profitability',
        description: 'Profit margins and ROI analysis',
        path: '/reports/financial/profitability',
        icon: PieChart,
      },
    ],
  },
  {
    id: 'operational',
    name: 'Operational Reports',
    description: 'Case processing, auctions, documents, and vendor performance',
    icon: BarChart3,
    requiredPermission: 'canViewOperational',
    reports: [
      {
        id: 'case-processing',
        name: 'Case Processing',
        description: 'Processing times and bottlenecks',
        path: '/reports/operational/case-processing',
        icon: FileText,
      },
      {
        id: 'auction-performance',
        name: 'Auction Performance',
        description: 'Success rates and bidding patterns',
        path: '/reports/operational/auction-performance',
        icon: BarChart3,
      },
      {
        id: 'document-management',
        name: 'Document Management',
        description: 'Document completion and signing rates',
        path: '/reports/operational/document-management',
        icon: FileText,
      },
      {
        id: 'vendor-performance',
        name: 'Vendor Performance',
        description: 'Rankings, win rates, and compliance',
        path: '/reports/operational/vendor-performance',
        icon: Users,
      },
    ],
  },
  {
    id: 'user-performance',
    name: 'User Performance',
    description: 'Individual and team performance metrics',
    icon: Users,
    requiredPermission: 'canViewUserPerformance',
    reports: [
      {
        id: 'my-performance',
        name: 'My Performance',
        description: 'Your personal performance metrics',
        path: '/reports/user-performance/my-performance',
        icon: Users,
      },
      {
        id: 'team-performance',
        name: 'Team Performance',
        description: 'Team metrics and comparisons',
        path: '/reports/user-performance/team-performance',
        icon: Users,
      },
    ],
  },
  {
    id: 'compliance',
    name: 'Compliance & Audit',
    description: 'Regulatory compliance and audit trails',
    icon: Shield,
    requiredPermission: 'canViewCompliance',
    reports: [
      {
        id: 'audit-trail',
        name: 'Audit Trail',
        description: 'User activity and system changes',
        path: '/reports/compliance/audit-trail',
        icon: FileText,
      },
      {
        id: 'regulatory',
        name: 'Regulatory Compliance',
        description: 'Compliance status and metrics',
        path: '/reports/compliance/regulatory',
        icon: Shield,
      },
    ],
  },
  {
    id: 'executive',
    name: 'Executive Dashboards',
    description: 'KPIs and strategic insights',
    icon: PieChart,
    requiredPermission: 'canViewExecutive',
    reports: [
      {
        id: 'kpi-dashboard',
        name: 'KPI Dashboard',
        description: 'Key performance indicators',
        path: '/reports/executive/kpi-dashboard',
        icon: BarChart3,
      },
      {
        id: 'master-report',
        name: 'Master Report',
        description: 'Comprehensive system report',
        path: '/reports/executive/master-report',
        icon: FileText,
      },
    ],
  },
];

export default function ReportsHubPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  const userRole = session?.user?.role as keyof typeof ROLE_PERMISSIONS || 'vendor';
  const permissions = ROLE_PERMISSIONS[userRole];

  // Filter categories based on permissions
  const visibleCategories = REPORT_CATEGORIES.filter(
    (category) => permissions[category.requiredPermission]
  );

  // Filter reports based on search
  const filteredCategories = searchQuery
    ? visibleCategories.map((category) => ({
        ...category,
        reports: category.reports.filter(
          (report) =>
            report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            report.description.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter((category) => category.reports.length > 0)
    : visibleCategories;

  // Load recent reports and favorites
  useEffect(() => {
    // TODO: Fetch from API
    setRecentReports([]);
    setFavorites([]);
  }, []);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports Hub</h1>
        <p className="text-muted-foreground mt-2">
          Access all your reports, analytics, and insights in one place
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search reports..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Recent Reports */}
      {recentReports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentReports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => router.push(report.path)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <report.icon className="h-5 w-5 text-[#800020]" />
                    <div className="text-left">
                      <p className="font-medium">{report.name}</p>
                      <p className="text-sm text-gray-600">{report.generatedAt}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Categories */}
      <div className="space-y-6">
        {filteredCategories.map((category) => (
          <Card key={category.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <category.icon className="h-5 w-5 text-[#800020]" />
                {category.name}
              </CardTitle>
              <CardDescription>{category.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {category.reports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => router.push(report.path)}
                    className="flex items-start gap-3 p-4 border rounded-lg hover:border-[#800020] hover:bg-[#800020]/5 transition-all text-left"
                  >
                    <report.icon className="h-5 w-5 text-[#800020] flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{report.name}</p>
                      <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No Results */}
      {searchQuery && filteredCategories.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900">No reports found</p>
            <p className="text-gray-600 mt-2">
              Try adjusting your search query
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
