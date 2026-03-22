/**
 * Error Tracking Utility
 * 
 * Captures and reports:
 * - Unhandled JavaScript errors
 * - Unhandled promise rejections
 * - API request failures
 * 
 * Includes user context (role, browser, device) in error reports.
 */

export interface ErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  userRole?: string;
  route: string;
  browser: string;
  device: string;
  timestamp: number;
  errorType: 'javascript' | 'promise' | 'api' | 'boundary';
  severity: 'low' | 'medium' | 'high' | 'critical';
  additionalContext?: Record<string, any>;
}

interface ErrorTrackerConfig {
  userRole?: string;
  onError?: (report: ErrorReport) => void;
  enableConsoleLogging?: boolean;
}

interface IErrorTracker {
  captureError: (error: {
    message: string;
    stack?: string;
    componentStack?: string;
    errorType: ErrorReport['errorType'];
    severity: ErrorReport['severity'];
    additionalContext?: Record<string, any>;
  }) => ErrorReport;
  captureAPIError: (
    url: string,
    method: string,
    status: number,
    statusText: string,
    responseBody?: any
  ) => ErrorReport;
  captureComponentError: (
    error: Error,
    componentStack: string,
    severity?: ErrorReport['severity']
  ) => ErrorReport;
  getErrors: () => ErrorReport[];
  clearErrors: () => void;
  updateConfig: (config: Partial<ErrorTrackerConfig>) => void;
  setUserRole: (role: string) => void;
}

class ErrorTracker implements IErrorTracker {
  private config: ErrorTrackerConfig = {
    enableConsoleLogging: true,
  };
  private errorQueue: ErrorReport[] = [];
  private maxQueueSize = 50;

  constructor(config?: ErrorTrackerConfig) {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (typeof window !== 'undefined') {
      this.initializeListeners();
    }
  }

  private initializeListeners() {
    // Capture unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.captureError({
        message: event.message,
        stack: event.error?.stack,
        errorType: 'javascript',
        severity: 'high',
        additionalContext: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        errorType: 'promise',
        severity: 'high',
        additionalContext: {
          reason: event.reason,
        },
      });
    });
  }

  private getBrowserInfo(): string {
    if (typeof navigator === 'undefined') return 'unknown';

    const ua = navigator.userAgent;
    let browser = 'unknown';

    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';
    else if (ua.includes('Opera')) browser = 'Opera';

    return browser;
  }

  private getDeviceInfo(): string {
    if (typeof navigator === 'undefined') return 'unknown';

    const ua = navigator.userAgent;
    
    if (/mobile/i.test(ua)) return 'mobile';
    if (/tablet|ipad/i.test(ua)) return 'tablet';
    return 'desktop';
  }

  /**
   * Capture and report an error
   */
  public captureError(error: {
    message: string;
    stack?: string;
    componentStack?: string;
    errorType: ErrorReport['errorType'];
    severity: ErrorReport['severity'];
    additionalContext?: Record<string, any>;
  }) {
    const report: ErrorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: error.componentStack,
      userRole: this.config.userRole,
      route: typeof window !== 'undefined' ? window.location.pathname : '',
      browser: this.getBrowserInfo(),
      device: this.getDeviceInfo(),
      timestamp: Date.now(),
      errorType: error.errorType,
      severity: error.severity,
      additionalContext: error.additionalContext,
    };

    // Add to queue
    this.errorQueue.push(report);
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift(); // Remove oldest error
    }

    // Log to console in development
    if (this.config.enableConsoleLogging && process.env.NODE_ENV === 'development') {
      console.error('🚨 Error Captured:', report);
    }

    // Call custom error handler
    if (this.config.onError) {
      this.config.onError(report);
    }

    // TODO: Send to error tracking service
    // Example: Sentry.captureException(report);
    
    return report;
  }

  /**
   * Capture API request failure
   */
  public captureAPIError(
    url: string,
    method: string,
    status: number,
    statusText: string,
    responseBody?: any
  ) {
    return this.captureError({
      message: `API request failed: ${method} ${url}`,
      errorType: 'api',
      severity: status >= 500 ? 'critical' : 'medium',
      additionalContext: {
        url,
        method,
        status,
        statusText,
        responseBody,
      },
    });
  }

  /**
   * Capture error from React Error Boundary
   */
  public captureComponentError(
    error: Error,
    componentStack: string,
    severity: ErrorReport['severity'] = 'high'
  ) {
    return this.captureError({
      message: error.message,
      stack: error.stack,
      componentStack,
      errorType: 'boundary',
      severity,
    });
  }

  /**
   * Get all captured errors
   */
  public getErrors(): ErrorReport[] {
    return [...this.errorQueue];
  }

  /**
   * Clear error queue
   */
  public clearErrors() {
    this.errorQueue = [];
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ErrorTrackerConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set user role for error context
   */
  public setUserRole(role: string) {
    this.config.userRole = role;
  }
}

// Singleton instance
let trackerInstance: ErrorTracker | null = null;

export function getErrorTracker(config?: ErrorTrackerConfig): IErrorTracker {
  if (typeof window === 'undefined') {
    // Return a no-op instance for SSR
    return {
      captureError: () => ({} as ErrorReport),
      captureAPIError: () => ({} as ErrorReport),
      captureComponentError: () => ({} as ErrorReport),
      getErrors: () => [],
      clearErrors: () => {},
      updateConfig: () => {},
      setUserRole: () => {},
    };
  }

  if (!trackerInstance) {
    trackerInstance = new ErrorTracker(config);
  } else if (config) {
    trackerInstance.updateConfig(config);
  }

  return trackerInstance;
}

/**
 * Hook to use error tracking in React components
 */
export function useErrorTracking(userRole?: string) {
  if (typeof window === 'undefined') return null;

  const tracker = getErrorTracker();

  if (userRole) {
    tracker.setUserRole(userRole);
  }

  return tracker;
}

/**
 * Fetch wrapper with automatic error tracking
 */
export async function fetchWithErrorTracking(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const tracker = getErrorTracker();
  const method = options?.method || 'GET';

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      let responseBody;
      try {
        responseBody = await response.clone().json();
      } catch {
        responseBody = await response.clone().text();
      }

      tracker.captureAPIError(
        url,
        method,
        response.status,
        response.statusText,
        responseBody
      );
    }

    return response;
  } catch (error) {
    tracker.captureAPIError(
      url,
      method,
      0,
      'Network Error',
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}
