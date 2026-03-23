/**
 * Web Speech API Compatibility Verification
 * 
 * Ensures all existing Web Speech API functionality is preserved
 * during the voice note UI modernization process
 */

export interface CompatibilityTestResult {
  feature: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

export interface VoiceCompatibilityReport {
  overall: 'compatible' | 'partial' | 'incompatible';
  tests: CompatibilityTestResult[];
  recommendations: string[];
}

/**
 * Web Speech API Compatibility Tester
 */
export class WebSpeechCompatibilityTester {
  private results: CompatibilityTestResult[] = [];

  /**
   * Run all compatibility tests
   */
  async runAllTests(): Promise<VoiceCompatibilityReport> {
    this.results = [];

    // Test basic API availability
    this.testAPIAvailability();
    
    // Test constructor access
    this.testConstructorAccess();
    
    // Test recognition instance creation
    await this.testRecognitionCreation();
    
    // Test property configuration
    this.testPropertyConfiguration();
    
    // Test event handler assignment
    this.testEventHandlers();
    
    // Test method availability
    this.testMethods();
    
    // Test browser-specific features
    this.testBrowserSpecificFeatures();

    return this.generateReport();
  }

  /**
   * Test basic API availability
   */
  private testAPIAvailability(): void {
    const hasWebkitSpeechRecognition = 'webkitSpeechRecognition' in window;
    const hasSpeechRecognition = 'SpeechRecognition' in window;
    const hasAnyAPI = hasWebkitSpeechRecognition || hasSpeechRecognition;

    this.results.push({
      feature: 'API Availability',
      status: hasAnyAPI ? 'pass' : 'fail',
      message: hasAnyAPI 
        ? 'Web Speech API is available'
        : 'Web Speech API is not available in this browser',
      details: {
        webkitSpeechRecognition: hasWebkitSpeechRecognition,
        SpeechRecognition: hasSpeechRecognition,
      },
    });
  }

  /**
   * Test constructor access
   */
  private testConstructorAccess(): void {
    try {
      const SpeechRecognitionConstructor = 
        (window as any).webkitSpeechRecognition || 
        (window as any).SpeechRecognition;

      if (SpeechRecognitionConstructor) {
        this.results.push({
          feature: 'Constructor Access',
          status: 'pass',
          message: 'Speech recognition constructor is accessible',
          details: {
            constructorName: SpeechRecognitionConstructor.name,
          },
        });
      } else {
        this.results.push({
          feature: 'Constructor Access',
          status: 'fail',
          message: 'Speech recognition constructor is not accessible',
        });
      }
    } catch (error) {
      this.results.push({
        feature: 'Constructor Access',
        status: 'fail',
        message: 'Error accessing speech recognition constructor',
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  /**
   * Test recognition instance creation
   */
  private async testRecognitionCreation(): Promise<void> {
    try {
      const SpeechRecognitionConstructor = 
        (window as any).webkitSpeechRecognition || 
        (window as any).SpeechRecognition;

      if (!SpeechRecognitionConstructor) {
        this.results.push({
          feature: 'Recognition Creation',
          status: 'fail',
          message: 'Cannot create recognition instance - constructor not available',
        });
        return;
      }

      const recognition = new SpeechRecognitionConstructor();
      
      if (recognition) {
        this.results.push({
          feature: 'Recognition Creation',
          status: 'pass',
          message: 'Speech recognition instance created successfully',
          details: {
            instanceType: recognition.constructor.name,
          },
        });
      } else {
        this.results.push({
          feature: 'Recognition Creation',
          status: 'fail',
          message: 'Failed to create speech recognition instance',
        });
      }
    } catch (error) {
      this.results.push({
        feature: 'Recognition Creation',
        status: 'fail',
        message: 'Error creating speech recognition instance',
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  /**
   * Test property configuration
   */
  private testPropertyConfiguration(): void {
    try {
      const SpeechRecognitionConstructor = 
        (window as any).webkitSpeechRecognition || 
        (window as any).SpeechRecognition;

      if (!SpeechRecognitionConstructor) {
        this.results.push({
          feature: 'Property Configuration',
          status: 'fail',
          message: 'Cannot test properties - constructor not available',
        });
        return;
      }

      const recognition = new SpeechRecognitionConstructor();
      const properties = ['continuous', 'interimResults', 'lang'];
      const availableProperties: string[] = [];
      const missingProperties: string[] = [];

      properties.forEach(prop => {
        if (prop in recognition) {
          availableProperties.push(prop);
          // Test if property is writable
          try {
            const originalValue = (recognition as any)[prop];
            (recognition as any)[prop] = originalValue;
          } catch (error) {
            // Property might be read-only
          }
        } else {
          missingProperties.push(prop);
        }
      });

      this.results.push({
        feature: 'Property Configuration',
        status: missingProperties.length === 0 ? 'pass' : 'warning',
        message: missingProperties.length === 0 
          ? 'All required properties are available'
          : `Some properties are missing: ${missingProperties.join(', ')}`,
        details: {
          available: availableProperties,
          missing: missingProperties,
        },
      });
    } catch (error) {
      this.results.push({
        feature: 'Property Configuration',
        status: 'fail',
        message: 'Error testing property configuration',
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  /**
   * Test event handler assignment
   */
  private testEventHandlers(): void {
    try {
      const SpeechRecognitionConstructor = 
        (window as any).webkitSpeechRecognition || 
        (window as any).SpeechRecognition;

      if (!SpeechRecognitionConstructor) {
        this.results.push({
          feature: 'Event Handlers',
          status: 'fail',
          message: 'Cannot test event handlers - constructor not available',
        });
        return;
      }

      const recognition = new SpeechRecognitionConstructor();
      const eventHandlers = ['onresult', 'onerror', 'onstart', 'onend'];
      const availableHandlers: string[] = [];
      const missingHandlers: string[] = [];

      eventHandlers.forEach(handler => {
        if (handler in recognition) {
          availableHandlers.push(handler);
          // Test if handler can be assigned
          try {
            (recognition as any)[handler] = () => {};
            (recognition as any)[handler] = null;
          } catch (error) {
            // Handler might not be assignable
          }
        } else {
          missingHandlers.push(handler);
        }
      });

      this.results.push({
        feature: 'Event Handlers',
        status: missingHandlers.length === 0 ? 'pass' : 'warning',
        message: missingHandlers.length === 0 
          ? 'All event handlers are available'
          : `Some event handlers are missing: ${missingHandlers.join(', ')}`,
        details: {
          available: availableHandlers,
          missing: missingHandlers,
        },
      });
    } catch (error) {
      this.results.push({
        feature: 'Event Handlers',
        status: 'fail',
        message: 'Error testing event handlers',
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  /**
   * Test method availability
   */
  private testMethods(): void {
    try {
      const SpeechRecognitionConstructor = 
        (window as any).webkitSpeechRecognition || 
        (window as any).SpeechRecognition;

      if (!SpeechRecognitionConstructor) {
        this.results.push({
          feature: 'Methods',
          status: 'fail',
          message: 'Cannot test methods - constructor not available',
        });
        return;
      }

      const recognition = new SpeechRecognitionConstructor();
      const methods = ['start', 'stop', 'abort'];
      const availableMethods: string[] = [];
      const missingMethods: string[] = [];

      methods.forEach(method => {
        if (method in recognition && typeof (recognition as any)[method] === 'function') {
          availableMethods.push(method);
        } else {
          missingMethods.push(method);
        }
      });

      this.results.push({
        feature: 'Methods',
        status: missingMethods.length === 0 ? 'pass' : 'warning',
        message: missingMethods.length === 0 
          ? 'All required methods are available'
          : `Some methods are missing: ${missingMethods.join(', ')}`,
        details: {
          available: availableMethods,
          missing: missingMethods,
        },
      });
    } catch (error) {
      this.results.push({
        feature: 'Methods',
        status: 'fail',
        message: 'Error testing methods',
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  /**
   * Test browser-specific features
   */
  private testBrowserSpecificFeatures(): void {
    const userAgent = navigator.userAgent.toLowerCase();
    const browserInfo = {
      isChrome: userAgent.includes('chrome'),
      isFirefox: userAgent.includes('firefox'),
      isSafari: userAgent.includes('safari') && !userAgent.includes('chrome'),
      isEdge: userAgent.includes('edge'),
    };

    const features: string[] = [];
    const limitations: string[] = [];

    if (browserInfo.isChrome) {
      features.push('Excellent Web Speech API support');
      features.push('Continuous recognition');
      features.push('Interim results');
    } else if (browserInfo.isFirefox) {
      limitations.push('Limited Web Speech API support');
      limitations.push('May require additional configuration');
    } else if (browserInfo.isSafari) {
      limitations.push('Minimal Web Speech API support');
      limitations.push('iOS Safari has additional restrictions');
    } else if (browserInfo.isEdge) {
      features.push('Good Web Speech API support');
      limitations.push('Some features may be limited');
    }

    this.results.push({
      feature: 'Browser Compatibility',
      status: limitations.length === 0 ? 'pass' : 'warning',
      message: `Browser: ${this.getBrowserName(browserInfo)}`,
      details: {
        browser: browserInfo,
        features,
        limitations,
      },
    });
  }

  /**
   * Get browser name from browser info
   */
  private getBrowserName(browserInfo: any): string {
    if (browserInfo.isChrome) return 'Chrome';
    if (browserInfo.isFirefox) return 'Firefox';
    if (browserInfo.isSafari) return 'Safari';
    if (browserInfo.isEdge) return 'Edge';
    return 'Unknown';
  }

  /**
   * Generate compatibility report
   */
  private generateReport(): VoiceCompatibilityReport {
    const passCount = this.results.filter(r => r.status === 'pass').length;
    const failCount = this.results.filter(r => r.status === 'fail').length;
    const warningCount = this.results.filter(r => r.status === 'warning').length;

    let overall: 'compatible' | 'partial' | 'incompatible';
    const recommendations: string[] = [];

    if (failCount === 0) {
      overall = warningCount === 0 ? 'compatible' : 'partial';
    } else if (passCount > failCount) {
      overall = 'partial';
    } else {
      overall = 'incompatible';
    }

    // Generate recommendations based on results
    if (failCount > 0) {
      recommendations.push('Consider providing fallback options for unsupported features');
    }
    
    if (warningCount > 0) {
      recommendations.push('Test thoroughly on target browsers and devices');
    }

    const browserResult = this.results.find(r => r.feature === 'Browser Compatibility');
    if (browserResult?.details?.limitations?.length > 0) {
      recommendations.push('Consider browser-specific optimizations or alternatives');
    }

    if (overall !== 'compatible') {
      recommendations.push('Implement graceful degradation for unsupported browsers');
      recommendations.push('Provide manual text input as a reliable fallback');
    }

    return {
      overall,
      tests: this.results,
      recommendations,
    };
  }
}

/**
 * Quick compatibility check function
 */
export async function checkWebSpeechCompatibility(): Promise<VoiceCompatibilityReport> {
  const tester = new WebSpeechCompatibilityTester();
  return await tester.runAllTests();
}

/**
 * Verify existing functionality is preserved
 */
export function verifyExistingFunctionality(): {
  webSpeechAPI: boolean;
  reactHookForm: boolean;
  zodValidation: boolean;
  offlineSupport: boolean;
  cameraUpload: boolean;
  gpsIntegration: boolean;
} {
  return {
    // Check Web Speech API
    webSpeechAPI: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
    
    // Check React Hook Form (would be available if imported)
    reactHookForm: typeof window !== 'undefined' && 'useForm' in (globalThis as any),
    
    // Check Zod validation (would be available if imported)
    zodValidation: typeof window !== 'undefined' && 'z' in (globalThis as any),
    
    // Check offline support (IndexedDB)
    offlineSupport: 'indexedDB' in window,
    
    // Check camera upload (MediaDevices)
    cameraUpload: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
    
    // Check GPS integration (Geolocation)
    gpsIntegration: 'geolocation' in navigator,
  };
}

/**
 * Test voice recording functionality
 */
export async function testVoiceRecording(): Promise<{
  canStart: boolean;
  canStop: boolean;
  canReceiveResults: boolean;
  canHandleErrors: boolean;
  error?: string;
}> {
  try {
    const SpeechRecognitionConstructor = 
      (window as any).webkitSpeechRecognition || 
      (window as any).SpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      return {
        canStart: false,
        canStop: false,
        canReceiveResults: false,
        canHandleErrors: false,
        error: 'Speech recognition not available',
      };
    }

    const recognition = new SpeechRecognitionConstructor();
    let canStart = false;
    let canStop = false;
    let canReceiveResults = false;
    let canHandleErrors = false;

    // Test start method
    try {
      recognition.start();
      canStart = true;
      recognition.stop(); // Stop immediately
      canStop = true;
    } catch (error) {
      // Expected if microphone permission is not granted
    }

    // Test result handler
    try {
      recognition.onresult = () => {};
      canReceiveResults = true;
    } catch (error) {
      // Should not happen
    }

    // Test error handler
    try {
      recognition.onerror = () => {};
      canHandleErrors = true;
    } catch (error) {
      // Should not happen
    }

    return {
      canStart,
      canStop,
      canReceiveResults,
      canHandleErrors,
    };
  } catch (error) {
    return {
      canStart: false,
      canStop: false,
      canReceiveResults: false,
      canHandleErrors: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}