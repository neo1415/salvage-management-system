/**
 * Enhanced Voice Error Handling and Recovery System
 * 
 * Comprehensive error handling for voice recognition with contextual messages,
 * graceful degradation, and automatic recovery mechanisms.
 */

export interface VoiceError {
  type: VoiceErrorType;
  code: string;
  message: string;
  userMessage: string;
  recoverable: boolean;
  retryAction?: () => void;
  fallbackAction?: () => void;
  metadata?: Record<string, any>;
}

export type VoiceErrorType = 
  | 'permission-denied'
  | 'not-supported'
  | 'network-error'
  | 'no-speech'
  | 'audio-capture'
  | 'service-unavailable'
  | 'timeout'
  | 'unknown';

export interface VoiceErrorHandlerOptions {
  maxRetries?: number;
  retryDelay?: number;
  enableFallback?: boolean;
  onError?: (error: VoiceError) => void;
  onRecovery?: () => void;
}

/**
 * Voice Error Definitions
 */
export const VOICE_ERRORS: Record<VoiceErrorType, Omit<VoiceError, 'retryAction' | 'fallbackAction' | 'metadata'>> = {
  'permission-denied': {
    type: 'permission-denied',
    code: 'PERMISSION_DENIED',
    message: 'Microphone access denied by user',
    userMessage: 'Microphone access is required for voice notes. Please enable microphone permissions in your browser settings.',
    recoverable: true,
  },
  'not-supported': {
    type: 'not-supported',
    code: 'NOT_SUPPORTED',
    message: 'Speech recognition not supported in this browser',
    userMessage: 'Voice recording is not supported in this browser. Please use manual text input or try a different browser.',
    recoverable: false,
  },
  'network-error': {
    type: 'network-error',
    code: 'NETWORK_ERROR',
    message: 'Network connection required for speech recognition',
    userMessage: 'Network error occurred. Voice notes will be processed when connection is restored.',
    recoverable: true,
  },
  'no-speech': {
    type: 'no-speech',
    code: 'NO_SPEECH',
    message: 'No speech detected during recording',
    userMessage: 'No speech detected. Please try speaking more clearly or check your microphone.',
    recoverable: true,
  },
  'audio-capture': {
    type: 'audio-capture',
    code: 'AUDIO_CAPTURE',
    message: 'Audio capture failed',
    userMessage: 'Unable to access your microphone. Please check your microphone connection and try again.',
    recoverable: true,
  },
  'service-unavailable': {
    type: 'service-unavailable',
    code: 'SERVICE_UNAVAILABLE',
    message: 'Speech recognition service unavailable',
    userMessage: 'Voice recognition service is temporarily unavailable. Please try again later or use manual text input.',
    recoverable: true,
  },
  'timeout': {
    type: 'timeout',
    code: 'TIMEOUT',
    message: 'Speech recognition timeout',
    userMessage: 'Recording timed out. Please try again with shorter recordings.',
    recoverable: true,
  },
  'unknown': {
    type: 'unknown',
    code: 'UNKNOWN_ERROR',
    message: 'Unknown error occurred',
    userMessage: 'An unexpected error occurred. Please try again or use manual text input.',
    recoverable: true,
  },
};

/**
 * Voice Error Handler Class
 */
export class VoiceErrorHandler {
  private retryCount = 0;
  private options: Required<VoiceErrorHandlerOptions>;

  constructor(options: VoiceErrorHandlerOptions = {}) {
    this.options = {
      maxRetries: 3,
      retryDelay: 1000,
      enableFallback: true,
      onError: () => {},
      onRecovery: () => {},
      ...options,
    };
  }

  /**
   * Handle a voice error with automatic recovery
   */
  async handleError(
    errorType: VoiceErrorType,
    originalError?: Error,
    retryAction?: () => Promise<void>,
    fallbackAction?: () => void
  ): Promise<VoiceError> {
    const baseError = VOICE_ERRORS[errorType];
    const error: VoiceError = {
      ...baseError,
      retryAction: retryAction ? () => this.retry(retryAction) : undefined,
      fallbackAction,
      metadata: {
        originalError: originalError?.message,
        retryCount: this.retryCount,
        timestamp: new Date().toISOString(),
      },
    };

    // Call error callback
    this.options.onError(error);

    // Attempt automatic recovery for recoverable errors
    if (error.recoverable && this.retryCount < this.options.maxRetries) {
      if (retryAction) {
        await this.retry(retryAction);
      }
    }

    return error;
  }

  /**
   * Retry with exponential backoff
   */
  private async retry(action: () => Promise<void>): Promise<void> {
    this.retryCount++;
    const delay = this.options.retryDelay * Math.pow(2, this.retryCount - 1);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      await action();
      this.retryCount = 0; // Reset on success
      this.options.onRecovery();
    } catch (error) {
      if (this.retryCount >= this.options.maxRetries) {
        throw error;
      }
      // Will be handled by the next error handling cycle
    }
  }

  /**
   * Reset retry count
   */
  reset(): void {
    this.retryCount = 0;
  }

  /**
   * Get current retry count
   */
  getRetryCount(): number {
    return this.retryCount;
  }
}

/**
 * Browser Compatibility Checker
 */
export class BrowserCompatibilityChecker {
  /**
   * Check if speech recognition is supported
   */
  static isSpeechRecognitionSupported(): boolean {
    return !!(
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      window.mozSpeechRecognition ||
      window.msSpeechRecognition
    );
  }

  /**
   * Check if media devices are supported
   */
  static isMediaDevicesSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Get speech recognition constructor
   */
  static getSpeechRecognitionConstructor(): typeof SpeechRecognition | null {
    return (
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      window.mozSpeechRecognition ||
      window.msSpeechRecognition ||
      null
    );
  }

  /**
   * Get browser-specific limitations and recommendations
   */
  static getBrowserInfo(): {
    name: string;
    limitations: string[];
    recommendations: string[];
  } {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('chrome')) {
      return {
        name: 'Chrome',
        limitations: [
          'Requires internet connection for speech recognition',
          'May have timeout limits for long recordings',
        ],
        recommendations: [
          'Ensure stable internet connection',
          'Keep recordings under 60 seconds',
        ],
      };
    }
    
    if (userAgent.includes('firefox')) {
      return {
        name: 'Firefox',
        limitations: [
          'Limited speech recognition support',
          'May require additional permissions',
        ],
        recommendations: [
          'Consider using Chrome for better voice support',
          'Enable media permissions in browser settings',
        ],
      };
    }
    
    if (userAgent.includes('safari')) {
      return {
        name: 'Safari',
        limitations: [
          'Limited speech recognition support',
          'iOS Safari has additional restrictions',
        ],
        recommendations: [
          'Use manual text input as primary method',
          'Consider Chrome or Firefox for voice features',
        ],
      };
    }
    
    return {
      name: 'Unknown',
      limitations: [
        'Speech recognition support may be limited',
      ],
      recommendations: [
        'Use Chrome for best voice recognition support',
        'Have manual text input as backup',
      ],
    };
  }
}

/**
 * Permission Manager
 */
export class PermissionManager {
  /**
   * Check microphone permission status
   */
  static async checkMicrophonePermission(): Promise<PermissionState> {
    if (!navigator.permissions) {
      return 'prompt'; // Assume prompt if permissions API not available
    }
    
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return permission.state;
    } catch (error) {
      return 'prompt';
    }
  }

  /**
   * Request microphone permission
   */
  static async requestMicrophonePermission(): Promise<boolean> {
    if (!BrowserCompatibilityChecker.isMediaDevicesSupported()) {
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately as we only needed permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get permission instructions for different browsers
   */
  static getPermissionInstructions(): {
    general: string[];
    chrome: string[];
    firefox: string[];
    safari: string[];
  } {
    return {
      general: [
        'Click the microphone icon in your browser\'s address bar',
        'Select "Allow" when prompted for microphone access',
        'Refresh the page if needed',
      ],
      chrome: [
        'Click the camera/microphone icon in the address bar',
        'Select "Always allow" for this site',
        'Or go to Settings > Privacy and security > Site Settings > Microphone',
      ],
      firefox: [
        'Click the microphone icon in the address bar',
        'Select "Allow" and check "Remember this decision"',
        'Or go to Preferences > Privacy & Security > Permissions',
      ],
      safari: [
        'Go to Safari > Preferences > Websites > Microphone',
        'Set this website to "Allow"',
        'Refresh the page',
      ],
    };
  }
}

/**
 * Network Status Monitor
 */
export class NetworkStatusMonitor {
  private listeners: Array<(online: boolean) => void> = [];

  constructor() {
    window.addEventListener('online', () => this.notifyListeners(true));
    window.addEventListener('offline', () => this.notifyListeners(false));
  }

  /**
   * Check if online
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Add listener for network status changes
   */
  addListener(callback: (online: boolean) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Remove listener
   */
  removeListener(callback: (online: boolean) => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(online: boolean): void {
    this.listeners.forEach(listener => listener(online));
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.listeners = [];
    window.removeEventListener('online', () => this.notifyListeners(true));
    window.removeEventListener('offline', () => this.notifyListeners(false));
  }
}

/**
 * Create a voice error from a native error
 */
export function createVoiceErrorFromNative(error: any): VoiceError {
  if (error?.error === 'not-allowed' || error?.name === 'NotAllowedError') {
    return { ...VOICE_ERRORS['permission-denied'] };
  }
  
  if (error?.error === 'no-speech') {
    return { ...VOICE_ERRORS['no-speech'] };
  }
  
  if (error?.error === 'audio-capture' || error?.name === 'NotReadableError') {
    return { ...VOICE_ERRORS['audio-capture'] };
  }
  
  if (error?.error === 'network') {
    return { ...VOICE_ERRORS['network-error'] };
  }
  
  if (error?.error === 'service-not-allowed') {
    return { ...VOICE_ERRORS['service-unavailable'] };
  }
  
  return { ...VOICE_ERRORS['unknown'] };
}

/**
 * Global error handler instance
 */
export const globalVoiceErrorHandler = new VoiceErrorHandler({
  maxRetries: 3,
  retryDelay: 1000,
  enableFallback: true,
});

/**
 * Global network monitor instance
 */
export const globalNetworkMonitor = new NetworkStatusMonitor();