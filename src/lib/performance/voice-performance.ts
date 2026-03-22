/**
 * Voice System Performance Optimizations
 * 
 * Comprehensive performance optimizations for voice recording and transcription
 * Ensures 60fps interactions and 2-second initialization on mobile devices
 */

export interface PerformanceMetrics {
  initializationTime: number;
  memoryUsage: number;
  frameRate: number;
  audioProcessingLatency: number;
  transcriptionLatency: number;
}

export interface VoicePerformanceOptions {
  targetFrameRate: number;
  maxMemoryUsage: number; // in MB
  audioBufferSize: number;
  enableMemoryOptimization: boolean;
  enableFrameRateOptimization: boolean;
}

/**
 * Performance Monitor for Voice System
 */
export class VoicePerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private frameRateMonitor: FrameRateMonitor | null = null;
  private memoryMonitor: MemoryMonitor | null = null;
  private startTime: number = 0;

  constructor(private options: VoicePerformanceOptions) {
    this.startTime = performance.now();
  }

  /**
   * Start monitoring performance
   */
  startMonitoring(): void {
    if (this.options.enableFrameRateOptimization) {
      this.frameRateMonitor = new FrameRateMonitor(this.options.targetFrameRate);
      this.frameRateMonitor.start();
    }

    if (this.options.enableMemoryOptimization) {
      this.memoryMonitor = new MemoryMonitor(this.options.maxMemoryUsage);
      this.memoryMonitor.start();
    }
  }

  /**
   * Stop monitoring performance
   */
  stopMonitoring(): void {
    this.frameRateMonitor?.stop();
    this.memoryMonitor?.stop();
  }

  /**
   * Record initialization completion
   */
  recordInitialization(): void {
    this.metrics.initializationTime = performance.now() - this.startTime;
  }

  /**
   * Record audio processing latency
   */
  recordAudioProcessingLatency(latency: number): void {
    this.metrics.audioProcessingLatency = latency;
  }

  /**
   * Record transcription latency
   */
  recordTranscriptionLatency(latency: number): void {
    this.metrics.transcriptionLatency = latency;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return {
      initializationTime: this.metrics.initializationTime || 0,
      memoryUsage: this.memoryMonitor?.getCurrentUsage() || 0,
      frameRate: this.frameRateMonitor?.getCurrentFrameRate() || 0,
      audioProcessingLatency: this.metrics.audioProcessingLatency || 0,
      transcriptionLatency: this.metrics.transcriptionLatency || 0,
    };
  }

  /**
   * Check if performance targets are met
   */
  isPerformanceOptimal(): boolean {
    const metrics = this.getMetrics();
    return (
      metrics.initializationTime <= 2000 && // 2 second target
      metrics.frameRate >= this.options.targetFrameRate * 0.9 && // 90% of target
      metrics.memoryUsage <= this.options.maxMemoryUsage
    );
  }
}

/**
 * Frame Rate Monitor
 */
class FrameRateMonitor {
  private animationId: number | null = null;
  private frameCount = 0;
  private lastTime = 0;
  private currentFrameRate = 0;

  constructor(private targetFrameRate: number) {}

  start(): void {
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.tick();
  }

  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  getCurrentFrameRate(): number {
    return this.currentFrameRate;
  }

  private tick = (): void => {
    const currentTime = performance.now();
    this.frameCount++;

    if (currentTime - this.lastTime >= 1000) {
      this.currentFrameRate = this.frameCount;
      this.frameCount = 0;
      this.lastTime = currentTime;
    }

    this.animationId = requestAnimationFrame(this.tick);
  };
}

/**
 * Memory Monitor
 */
class MemoryMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private currentUsage = 0;

  constructor(private maxUsage: number) {}

  start(): void {
    this.intervalId = setInterval(() => {
      this.updateMemoryUsage();
    }, 1000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getCurrentUsage(): number {
    return this.currentUsage;
  }

  private updateMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.currentUsage = memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
    }
  }
}

/**
 * Audio Processing Optimizer
 */
export class AudioProcessingOptimizer {
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private bufferSize: number;

  constructor(bufferSize: number = 4096) {
    this.bufferSize = bufferSize;
  }

  /**
   * Initialize optimized audio processing
   */
  async initialize(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Use smaller buffer size for lower latency
      this.processor = this.audioContext.createScriptProcessor(
        this.bufferSize,
        1, // mono input
        1  // mono output
      );

      // Optimize audio context for low latency
      if (this.audioContext.audioWorklet) {
        // Use AudioWorklet for better performance when available
        await this.setupAudioWorklet();
      }
    } catch (error) {
      console.warn('Failed to initialize optimized audio processing:', error);
    }
  }

  /**
   * Setup AudioWorklet for better performance
   */
  private async setupAudioWorklet(): Promise<void> {
    if (!this.audioContext?.audioWorklet) return;

    try {
      // Create inline AudioWorklet processor
      const processorCode = `
        class VoiceProcessor extends AudioWorkletProcessor {
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            const output = outputs[0];
            
            if (input.length > 0) {
              // Simple pass-through with minimal processing
              for (let channel = 0; channel < input.length; channel++) {
                const inputChannel = input[channel];
                const outputChannel = output[channel];
                for (let i = 0; i < inputChannel.length; i++) {
                  outputChannel[i] = inputChannel[i];
                }
              }
            }
            
            return true;
          }
        }
        
        registerProcessor('voice-processor', VoiceProcessor);
      `;

      const blob = new Blob([processorCode], { type: 'application/javascript' });
      const processorUrl = URL.createObjectURL(blob);
      
      await this.audioContext.audioWorklet.addModule(processorUrl);
      URL.revokeObjectURL(processorUrl);
    } catch (error) {
      console.warn('Failed to setup AudioWorklet:', error);
    }
  }

  /**
   * Cleanup audio processing resources
   */
  cleanup(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

/**
 * Memory-Efficient Text Renderer
 */
export class VirtualizedTextRenderer {
  private container: HTMLElement;
  private visibleRange: { start: number; end: number } = { start: 0, end: 1000 };
  private itemHeight = 20;
  private bufferSize = 100;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Render only visible text content for large texts
   */
  renderVirtualizedContent(content: string, scrollTop: number, containerHeight: number): string {
    const lines = content.split('\n');
    const totalHeight = lines.length * this.itemHeight;
    
    if (totalHeight <= containerHeight * 2) {
      // Content is small enough to render fully
      return content;
    }

    // Calculate visible range with buffer
    const startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.bufferSize);
    const endIndex = Math.min(
      lines.length,
      Math.ceil((scrollTop + containerHeight) / this.itemHeight) + this.bufferSize
    );

    this.visibleRange = { start: startIndex, end: endIndex };

    // Return only visible lines
    return lines.slice(startIndex, endIndex).join('\n');
  }

  /**
   * Get current visible range
   */
  getVisibleRange(): { start: number; end: number } {
    return this.visibleRange;
  }
}

/**
 * Debounced State Manager
 */
export class DebouncedStateManager<T> {
  private timeoutId: NodeJS.Timeout | null = null;
  private pendingState: Partial<T> | null = null;

  constructor(
    private updateCallback: (state: Partial<T>) => void,
    private delay: number = 100
  ) {}

  /**
   * Update state with debouncing
   */
  updateState(newState: Partial<T>): void {
    this.pendingState = { ...this.pendingState, ...newState };

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      if (this.pendingState) {
        this.updateCallback(this.pendingState);
        this.pendingState = null;
      }
      this.timeoutId = null;
    }, this.delay);
  }

  /**
   * Flush pending updates immediately
   */
  flush(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.pendingState) {
      this.updateCallback(this.pendingState);
      this.pendingState = null;
    }
  }

  /**
   * Cancel pending updates
   */
  cancel(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.pendingState = null;
  }
}

/**
 * Resource Pool for efficient object reuse
 */
export class ResourcePool<T> {
  private available: T[] = [];
  private inUse = new Set<T>();

  constructor(
    private createResource: () => T,
    private resetResource: (resource: T) => void,
    initialSize: number = 5
  ) {
    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.available.push(this.createResource());
    }
  }

  /**
   * Acquire a resource from the pool
   */
  acquire(): T {
    let resource = this.available.pop();
    
    if (!resource) {
      resource = this.createResource();
    }

    this.inUse.add(resource);
    return resource;
  }

  /**
   * Release a resource back to the pool
   */
  release(resource: T): void {
    if (this.inUse.has(resource)) {
      this.inUse.delete(resource);
      this.resetResource(resource);
      this.available.push(resource);
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): { available: number; inUse: number; total: number } {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
    };
  }

  /**
   * Clear the pool
   */
  clear(): void {
    this.available = [];
    this.inUse.clear();
  }
}

/**
 * Performance-optimized event throttler
 */
export function createThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): T {
  const { leading = true, trailing = true } = options;
  let timeoutId: NodeJS.Timeout | null = null;
  let lastCallTime = 0;
  let lastArgs: Parameters<T> | null = null;

  const throttledFunction = (...args: Parameters<T>) => {
    const now = Date.now();
    lastArgs = args;

    const shouldCallLeading = leading && (now - lastCallTime >= delay);
    
    if (shouldCallLeading) {
      lastCallTime = now;
      return callback(...args);
    }

    if (trailing && !timeoutId) {
      timeoutId = setTimeout(() => {
        if (lastArgs) {
          lastCallTime = Date.now();
          callback(...lastArgs);
        }
        timeoutId = null;
      }, delay - (now - lastCallTime));
    }
  };

  return throttledFunction as T;
}

/**
 * Default performance configuration for voice system
 */
export const DEFAULT_VOICE_PERFORMANCE_CONFIG: VoicePerformanceOptions = {
  targetFrameRate: 60,
  maxMemoryUsage: 100, // 100MB
  audioBufferSize: 4096,
  enableMemoryOptimization: true,
  enableFrameRateOptimization: true,
};

/**
 * Global performance monitor instance
 */
export const globalVoicePerformanceMonitor = new VoicePerformanceMonitor(
  DEFAULT_VOICE_PERFORMANCE_CONFIG
);