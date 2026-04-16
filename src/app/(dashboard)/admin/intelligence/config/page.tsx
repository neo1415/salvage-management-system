/**
 * Algorithm Configuration Page
 * 
 * Admin page for managing intelligence algorithm parameters
 * Task: 11.4.1
 */

import { Suspense } from 'react';
import { Metadata } from 'next';
import { AlgorithmConfigContent } from '@/components/intelligence/admin/config/algorithm-config-content';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Algorithm Configuration | Intelligence Admin',
  description: 'Configure AI marketplace intelligence algorithm parameters',
};

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AlgorithmConfigPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Algorithm Configuration</h1>
        <p className="text-muted-foreground mt-2">
          Adjust intelligence algorithm parameters to optimize prediction accuracy and recommendation effectiveness
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <AlgorithmConfigContent />
      </Suspense>
    </div>
  );
}
