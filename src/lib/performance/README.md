# Performance Monitoring and Error Tracking

This directory contains utilities for monitoring application performance and tracking errors.

## Performance Monitoring

### Features

- **Core Web Vitals**: Automatically captures FCP, LCP, FID, CLS, and TTI
- **Threshold Warnings**: Logs warnings when metrics exceed acceptable thresholds
- **Device Context**: Includes device type, browser, and connection information
- **User Context**: Can include user role for better analysis

### Usage

#### Basic Usage

```typescript
import { getPerformanceMonitor } from '@/lib/performance';

// Get the performance monitor instance
const monitor = getPerformanceMonitor();

// Get current metrics
const metrics = monitor.getMetrics();
console.log(metrics);

// Report metrics (with optional user context)
monitor.report({ userRole: 'vendor' });
```

#### React Hook

```typescript
import { usePerformanceMonitoring } from '@/lib/performance';

function MyComponent() {
  // Automatically reports metrics on page load
  usePerformanceMonitoring('vendor');
  
  return <div>My Component</div>;
}
```

### Thresholds

The following thresholds trigger warnings:

- **LCP**: > 2500ms
- **CLS**: > 0.1
- **FID**: > 100ms
- **FCP**: > 1800ms
- **TTI**: > 3800ms

## Error Tracking

### Features

- **Automatic Capture**: Captures unhandled errors and promise rejections
- **API Error Tracking**: Track failed API requests
- **Component Errors**: Capture errors from React Error Boundaries
- **User Context**: Include user role, browser, device in error reports
- **Error Queue**: Maintains a queue of recent errors (max 50)

### Usage

#### Basic Usage

```typescript
import { getErrorTracker } from '@/lib/performance';

// Get the error tracker instance
const tracker = getErrorTracker();

// Set user role
tracker.setUserRole('vendor');

// Manually capture an error
tracker.captureError({
  message: 'Something went wrong',
  errorType: 'javascript',
  severity: 'high',
  additionalContext: { foo: 'bar' },
});

// Capture API error
tracker.captureAPIError(
  '/api/cases',
  'POST',
  500,
  'Internal Server Error',
  { error: 'Database connection failed' }
);
```

#### React Hook

```typescript
import { useErrorTracking } from '@/lib/performance';

function MyComponent() {
  const tracker = useErrorTracking('vendor');
  
  const handleAction = async () => {
    try {
      // Your code
    } catch (error) {
      tracker?.captureError({
        message: error.message,
        errorType: 'javascript',
        severity: 'medium',
      });
    }
  };
  
  return <button onClick={handleAction}>Do Something</button>;
}
```

#### Fetch Wrapper

```typescript
import { fetchWithErrorTracking } from '@/lib/performance';

// Automatically tracks API errors
const response = await fetchWithErrorTracking('/api/cases', {
  method: 'POST',
  body: JSON.stringify(data),
});
```

## Error Boundaries

Error boundaries catch JavaScript errors in React components and display user-friendly error messages.

### Usage

#### Basic Error Boundary

```typescript
import { ErrorBoundary } from '@/components/ui/error-boundary';

function MyApp() {
  return (
    <ErrorBoundary>
      <MyComponent />
    </ErrorBoundary>
  );
}
```

#### Dashboard Error Boundary

```typescript
import { DashboardErrorBoundary } from '@/components/ui/error-boundary';

function VendorDashboard() {
  return (
    <DashboardErrorBoundary role="vendor">
      <VendorDashboardContent />
    </DashboardErrorBoundary>
  );
}
```

#### Custom Fallback

```typescript
import { ErrorBoundary } from '@/components/ui/error-boundary';

function MyApp() {
  return (
    <ErrorBoundary
      fallback={
        <div>
          <h1>Oops! Something went wrong</h1>
          <button onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      }
    >
      <MyComponent />
    </ErrorBoundary>
  );
}
```

### Error Boundary Features

- **User-Friendly UI**: Displays a professional error message
- **Recovery Actions**: Provides "Try Again", "Reload Page", and "Go to Home" buttons
- **Error Details**: Shows error details in development mode
- **Automatic Tracking**: Automatically reports errors to error tracker
- **Custom Handlers**: Supports custom error handlers

## Integration with Analytics

To integrate with your analytics service (e.g., Sentry, LogRocket, DataDog):

### Performance Monitoring

Edit `src/lib/performance/monitor.ts`:

```typescript
public report(additionalContext?: { userRole?: string }) {
  const metrics = this.getMetrics();
  
  // Send to your analytics service
  analytics.track('performance_metrics', metrics);
  
  return metrics;
}
```

### Error Tracking

Edit `src/lib/performance/error-tracker.ts`:

```typescript
public captureError(error: {...}) {
  const report: ErrorReport = {...};
  
  // Send to your error tracking service
  Sentry.captureException(report);
  
  return report;
}
```

## Best Practices

1. **Set User Role Early**: Set the user role as soon as authentication completes
2. **Use Error Boundaries**: Wrap all major components with error boundaries
3. **Monitor Thresholds**: Pay attention to performance warnings in console
4. **Review Error Queue**: Periodically check `tracker.getErrors()` for patterns
5. **Test Error States**: Test error boundaries by throwing errors in development

## Testing

### Test Error Boundary

```typescript
function TestErrorBoundary() {
  const [shouldError, setShouldError] = useState(false);
  
  if (shouldError) {
    throw new Error('Test error');
  }
  
  return (
    <button onClick={() => setShouldError(true)}>
      Trigger Error
    </button>
  );
}

// Wrap with error boundary
<ErrorBoundary>
  <TestErrorBoundary />
</ErrorBoundary>
```

### Test Performance Monitoring

```typescript
import { getPerformanceMonitor } from '@/lib/performance';

// In browser console
const monitor = getPerformanceMonitor();
console.log(monitor.getMetrics());
```

### Test Error Tracking

```typescript
import { getErrorTracker } from '@/lib/performance';

// In browser console
const tracker = getErrorTracker();
tracker.captureError({
  message: 'Test error',
  errorType: 'javascript',
  severity: 'low',
});
console.log(tracker.getErrors());
```
