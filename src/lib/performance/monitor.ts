/**
 * Performance Monitoring Utility
 * 
 * Captures Core Web Vitals and custom performance metrics:
 * - FCP (First Contentful Paint)
 * - LCP (Largest Contentful Paint)
 * - FID (First Input Delay)
 * - CLS (Cumulative Layout Shift)
 * - TTI (Time to Interactive)
 * 
 * Logs warnings when metrics exceed thresholds.
 */

export interface PerformanceMetrics {
  // Core Web Vitals
  fcp?: number;
  lcp?: number;
  fid?: number;
  cls?: number;
  tti?: number;
  
  // Custom metrics
  pageLoadTime?: number;
  navigationTime?: number;
  
  // Context
  route: string;
  userRole?: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  connectionType?: string;
  timestamp: number;
}

// Performance thresholds
const THRESHOLDS = {
  LCP: 2500, // milliseconds
  CLS: 0.1,  // score
  FID: 100,  // milliseconds
  FCP: 1800, // milliseconds
  TTI: 3800, // milliseconds
};

class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private observers: PerformanceObserver[] = [];

  constructor() {
    if (typeof window === 'undefined') return;
    
    this.initializeObservers();
    this.captureNavigationTiming();
  }

  private initializeObservers() {
    // Observe paint timing (FCP)
    if ('PerformanceObserver' in window) {
      try {
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              this.metrics.fcp = entry.startTime;
              this.checkThreshold('FCP', entry.startTime, THRESHOLDS.FCP);
            }
          }
        });
        paintObserver.observe({ entryTypes: ['paint'] });
        this.observers.push(paintObserver);
      } catch (e) {
        console.warn('Paint observer not supported:', e);
      }

      // Observe LCP
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          this.metrics.lcp = lastEntry.renderTime || lastEntry.loadTime;
          this.checkThreshold('LCP', this.metrics.lcp, THRESHOLDS.LCP);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (e) {
        console.warn('LCP observer not supported:', e);
      }

      // Observe FID
      try {
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const fidEntry = entry as any;
            this.metrics.fid = fidEntry.processingStart - fidEntry.startTime;
            this.checkThreshold('FID', this.metrics.fid, THRESHOLDS.FID);
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      } catch (e) {
        console.warn('FID observer not supported:', e);
      }

      // Observe CLS
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutShift = entry as any;
            if (!layoutShift.hadRecentInput) {
              clsValue += layoutShift.value;
              this.metrics.cls = clsValue;
              this.checkThreshold('CLS', clsValue, THRESHOLDS.CLS);
            }
          }
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch (e) {
        console.warn('CLS observer not supported:', e);
      }
    }
  }

  private captureNavigationTiming() {
    if (typeof window === 'undefined') return;

    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (navigation) {
          this.metrics.pageLoadTime = navigation.loadEventEnd - navigation.fetchStart;
          this.metrics.navigationTime = navigation.domContentLoadedEventEnd - navigation.fetchStart;
          
          // Estimate TTI (simplified)
          this.metrics.tti = navigation.domInteractive - navigation.fetchStart;
          this.checkThreshold('TTI', this.metrics.tti, THRESHOLDS.TTI);
        }
      }, 0);
    });
  }

  private checkThreshold(metric: string, value: number | undefined, threshold: number) {
    if (value !== undefined && value > threshold) {
      console.warn(
        `⚠️ Performance Warning: ${metric} exceeded threshold`,
        `\n  Value: ${value.toFixed(2)}`,
        `\n  Threshold: ${threshold}`,
        `\n  Route: ${window.location.pathname}`
      );
    }
  }

  private getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    if (typeof window === 'undefined') return 'desktop';
    
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  private getConnectionType(): string {
    if (typeof navigator === 'undefined') return 'unknown';
    
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    return connection?.effectiveType || 'unknown';
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      route: typeof window !== 'undefined' ? window.location.pathname : '',
      deviceType: this.getDeviceType(),
      connectionType: this.getConnectionType(),
      timestamp: Date.now(),
    } as PerformanceMetrics;
  }

  /**
   * Report metrics to analytics service
   * This is a placeholder - integrate with your analytics service
   */
  public report(additionalContext?: { userRole?: string }) {
    const metrics = this.getMetrics();
    
    if (additionalContext?.userRole) {
      metrics.userRole = additionalContext.userRole;
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Performance Metrics:', metrics);
    }

    // TODO: Send to analytics service
    // Example: analytics.track('performance_metrics', metrics);
    
    return metrics;
  }

  /**
   * Clean up observers
   */
  public disconnect() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Singleton instance
let monitorInstance: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (typeof window === 'undefined') {
    // Return a no-op instance for SSR
    return {
      getMetrics: () => ({
        route: '',
        deviceType: 'desktop',
        timestamp: Date.now(),
      } as PerformanceMetrics),
      report: () => ({} as PerformanceMetrics),
      disconnect: () => {},
    } as PerformanceMonitor;
  }

  if (!monitorInstance) {
    monitorInstance = new PerformanceMonitor();
  }

  return monitorInstance;
}

/**
 * Hook to use performance monitoring in React components
 */
export function usePerformanceMonitoring(userRole?: string) {
  if (typeof window === 'undefined') return;

  const monitor = getPerformanceMonitor();

  // Report metrics on component mount
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      setTimeout(() => {
        monitor.report({ userRole });
      }, 1000);
    });
  }

  return monitor;
}
