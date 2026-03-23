/**
 * Voice Performance Hook
 * 
 * Performance optimization hook for voice components
 * Ensures 60fps interactions and efficient memory usage
 */

'use client';

import { useEffect, useRef, useCallback, useMemo } from 'react';
import {
  VoicePerformanceMonitor,
  AudioProcessingOptimizer,
  VirtualizedTextRenderer,
  DebouncedStateManager,
  createThrottledCallback,
  DEFAULT_VOICE_PERFORMANCE_CONFIG,
  type PerformanceMetrics,
  type VoicePerformanceOptions,
} from '../lib/performance/voice-performance';

interface UseVoicePerformanceOptions extends Partial<VoicePerformanceOptions> {
  enableVirtualization?: boolean;
  enableAudioOptimization?: boolean;
  debounceDelay?: number;
}

interface UseVoicePerformanceReturn {
  // Performance monitoring
  performanceMonitor: VoicePerformanceMonitor;
  metrics: PerformanceMetrics;
  isOptimal: boolean;
  
  // Optimized callbacks
  throttledCallback: <T extends (...args: any[]) => any>(callback: T, delay?: number) => T;
  debouncedStateUpdate: <T>(callback: (state: T) => void, delay?: number) => DebouncedStateManager<T>;
  
  // Text virtualization
  virtualizeText: (content: string, container: HTMLElement) => string;
  
  // Audio optimization
  audioOptimizer: AudioProcessingOptimizer | null;
  
  // Memory management
  cleanup: () => void;
}

/**
 * Hook for voice component performance optimization
 */
export function useVoicePerformance(
  options: UseVoicePerformanceOptions = {}
): UseVoicePerformanceReturn {
  const {
    enableVirtualization = true,
    enableAudioOptimization = true,
    debounceDelay = 100,
    ...performanceOptions
  } = options;

  const config = useMemo(() => ({
    ...DEFAULT_VOICE_PERFORMANCE_CONFIG,
    ...performanceOptions,
  }), [performanceOptions]);

  // Performance monitor
  const performanceMonitorRef = useRef<VoicePerformanceMonitor | null>(null);
  const audioOptimizerRef = useRef<AudioProcessingOptimizer | null>(null);
  const textRendererRef = useRef<VirtualizedTextRenderer | null>(null);
  const metricsRef = useRef<PerformanceMetrics>({
    initializationTime: 0,
    memoryUsage: 0,
    frameRate: 0,
    audioProcessingLatency: 0,
    transcriptionLatency: 0,
  });

  /**
   * Initialize performance monitoring
   */
  useEffect(() => {
    if (!performanceMonitorRef.current) {
      performanceMonitorRef.current = new VoicePerformanceMonitor(config);
      performanceMonitorRef.current.startMonitoring();
    }

    if (enableAudioOptimization && !audioOptimizerRef.current) {
      audioOptimizerRef.current = new AudioProcessingOptimizer(config.audioBufferSize);
      audioOptimizerRef.current.initialize().catch(console.warn);
    }

    // Record initialization completion
    const initTimer = setTimeout(() => {
      performanceMonitorRef.current?.recordInitialization();
    }, 0);

    return () => {
      clearTimeout(initTimer);
      performanceMonitorRef.current?.stopMonitoring();
      audioOptimizerRef.current?.cleanup();
    };
  }, [config, enableAudioOptimization]);

  /**
   * Update metrics periodically
   */
  useEffect(() => {
    const updateMetrics = () => {
      if (performanceMonitorRef.current) {
        metricsRef.current = performanceMonitorRef.current.getMetrics();
      }
    };

    const intervalId = setInterval(updateMetrics, 1000);
    updateMetrics(); // Initial update

    return () => clearInterval(intervalId);
  }, []);

  /**
   * Create throttled callback with performance optimization
   */
  const throttledCallback = useCallback(<T extends (...args: any[]) => any>(
    callback: T,
    delay: number = 16 // ~60fps
  ): T => {
    return createThrottledCallback(callback, delay, {
      leading: true,
      trailing: true,
    });
  }, []);

  /**
   * Create debounced state manager
   */
  const debouncedStateUpdate = useCallback(<T>(
    callback: (state: T) => void,
    delay: number = debounceDelay
  ): DebouncedStateManager<T> => {
    return new DebouncedStateManager(callback, delay);
  }, [debounceDelay]);

  /**
   * Virtualize text content for large texts
   */
  const virtualizeText = useCallback((content: string, container: HTMLElement): string => {
    if (!enableVirtualization || content.length < 10000) {
      return content; // No need to virtualize small content
    }

    if (!textRendererRef.current) {
      textRendererRef.current = new VirtualizedTextRenderer(container);
    }

    const containerRect = container.getBoundingClientRect();
    return textRendererRef.current.renderVirtualizedContent(
      content,
      container.scrollTop,
      containerRect.height
    );
  }, [enableVirtualization]);

  /**
   * Cleanup all resources
   */
  const cleanup = useCallback(() => {
    performanceMonitorRef.current?.stopMonitoring();
    audioOptimizerRef.current?.cleanup();
    performanceMonitorRef.current = null;
    audioOptimizerRef.current = null;
    textRendererRef.current = null;
  }, []);

  /**
   * Check if performance is optimal
   */
  const isOptimal = useMemo(() => {
    return performanceMonitorRef.current?.isPerformanceOptimal() ?? false;
  }, [metricsRef.current]);

  return {
    performanceMonitor: performanceMonitorRef.current!,
    metrics: metricsRef.current,
    isOptimal,
    throttledCallback,
    debouncedStateUpdate,
    virtualizeText,
    audioOptimizer: audioOptimizerRef.current,
    cleanup,
  };
}

/**
 * Hook for optimized animation frame handling
 */
export function useOptimizedAnimationFrame(
  callback: (timestamp: number) => void,
  enabled: boolean = true
): {
  start: () => void;
  stop: () => void;
  isRunning: boolean;
} {
  const animationIdRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);
  const isRunningRef = useRef(false);

  // Update callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const animationLoop = useCallback((timestamp: number) => {
    if (isRunningRef.current) {
      callbackRef.current(timestamp);
      animationIdRef.current = requestAnimationFrame(animationLoop);
    }
  }, []);

  const start = useCallback(() => {
    if (!isRunningRef.current && enabled) {
      isRunningRef.current = true;
      animationIdRef.current = requestAnimationFrame(animationLoop);
    }
  }, [animationLoop, enabled]);

  const stop = useCallback(() => {
    if (isRunningRef.current) {
      isRunningRef.current = false;
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    start,
    stop,
    isRunning: isRunningRef.current,
  };
}

/**
 * Hook for memory-efficient state management
 */
export function useMemoryEfficientState<T>(
  initialState: T,
  options: {
    maxHistorySize?: number;
    enableGarbageCollection?: boolean;
    gcInterval?: number;
  } = {}
): [T, (newState: T | ((prevState: T) => T)) => void, () => void] {
  const {
    maxHistorySize = 10,
    enableGarbageCollection = true,
    gcInterval = 30000, // 30 seconds
  } = options;

  const stateRef = useRef<T>(initialState);
  const historyRef = useRef<T[]>([initialState]);
  const gcTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setState = useCallback((newState: T | ((prevState: T) => T)) => {
    const nextState = typeof newState === 'function' 
      ? (newState as (prevState: T) => T)(stateRef.current)
      : newState;

    stateRef.current = nextState;
    
    // Manage history size
    historyRef.current.push(nextState);
    if (historyRef.current.length > maxHistorySize) {
      historyRef.current = historyRef.current.slice(-maxHistorySize);
    }
  }, [maxHistorySize]);

  const forceGarbageCollection = useCallback(() => {
    // Clear old history
    historyRef.current = [stateRef.current];
    
    // Force garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }, []);

  // Automatic garbage collection
  useEffect(() => {
    if (enableGarbageCollection) {
      gcTimeoutRef.current = setInterval(forceGarbageCollection, gcInterval);
    }

    return () => {
      if (gcTimeoutRef.current) {
        clearInterval(gcTimeoutRef.current);
      }
    };
  }, [enableGarbageCollection, gcInterval, forceGarbageCollection]);

  return [stateRef.current, setState, forceGarbageCollection];
}

/**
 * Hook for optimized event listeners
 */
export function useOptimizedEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  options: {
    throttle?: number;
    debounce?: number;
    passive?: boolean;
    capture?: boolean;
  } = {}
): void {
  const {
    throttle,
    debounce,
    passive = true,
    capture = false,
  } = options;

  const handlerRef = useRef(handler);
  const optimizedHandlerRef = useRef<(event: WindowEventMap[K]) => void>();

  // Update handler ref
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // Create optimized handler
  useEffect(() => {
    let optimizedHandler = (event: WindowEventMap[K]) => handlerRef.current(event);

    if (throttle) {
      optimizedHandler = createThrottledCallback(optimizedHandler, throttle);
    }

    if (debounce) {
      let timeoutId: NodeJS.Timeout;
      const debouncedHandler = (event: WindowEventMap[K]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => optimizedHandler(event), debounce);
      };
      optimizedHandler = debouncedHandler;
    }

    optimizedHandlerRef.current = optimizedHandler;
  }, [throttle, debounce]);

  // Add/remove event listener
  useEffect(() => {
    const handler = optimizedHandlerRef.current;
    if (!handler) return;

    const eventOptions = { passive, capture };
    window.addEventListener(eventName, handler, eventOptions);

    return () => {
      window.removeEventListener(eventName, handler, eventOptions);
    };
  }, [eventName, passive, capture]);
}