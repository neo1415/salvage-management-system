'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, AlertCircle } from 'lucide-react';

export default function TeamPerformancePage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Performance Report</h1>
          <p className="text-muted-foreground mt-2">
            Cross-functional team collaboration and performance metrics
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <CardTitle>Coming Soon</CardTitle>
          </div>
          <CardDescription>
            Team performance metrics will be available in a future update
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Team Performance Metrics</p>
            <p className="text-sm text-muted-foreground max-w-md">
              This report will track team collaboration, cross-functional efficiency, and collective
              performance metrics across departments.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
