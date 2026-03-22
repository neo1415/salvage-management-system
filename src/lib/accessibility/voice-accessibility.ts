/**
 * Voice Note Accessibility Utilities
 * 
 * Comprehensive accessibility support for voice note components
 * Ensures WCAG 2.1 AA compliance and enhanced screen reader support
 */

export interface AccessibilityAnnouncement {
  message: string;
  priority: 'polite' | 'assertive';
  delay?: number;
}

export interface VoiceAccessibilityState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  transcriptionText: string;
  error?: string;
}

/**
 * ARIA Labels for Voice Components
 */
export const VOICE_ARIA_LABELS = {
  recordButton: {
    idle: 'Start voice recording',
    recording: 'Stop voice recording, currently recording',
    paused: 'Resume voice recording, currently paused',
    processing: 'Processing voice recording, please wait',
    disabled: 'Voice recording disabled',
  },
  pauseButton: {
    pause: 'Pause recording',
    resume: 'Resume recording',
  },
  textArea: {
    label: 'Voice notes text area',
    description: 'Combined text from all voice recordings. You can edit this text directly or add new recordings using the voice controls.',
  },
  transcriptionOverlay: {
    label: 'Live transcription',
    description: 'Real-time transcription of your voice recording',
  },
  audioVisualizer: {
    label: 'Audio level indicator',
    description: 'Visual representation of current audio input level',
  },
} as const;

/**
 * Screen Reader Announcements
 */
export const VOICE_ANNOUNCEMENTS = {
  recordingStarted: 'Recording started. Speak clearly into your microphone.',
  recordingStopped: 'Recording stopped.',
  recordingPaused: 'Recording paused. Press Space to resume.',
  recordingResumed: 'Recording resumed.',
  transcriptionComplete: (text: string) => `Transcription complete: ${text}`,
  transcriptionError: 'Transcription failed. You can try recording again or type manually.',
  permissionDenied: 'Microphone access denied. Please enable microphone permissions to use voice recording.',
  browserNotSupported: 'Voice recording is not supported in this browser. Please use manual text input.',
  networkError: 'Network error occurred. Voice notes will be processed when connection is restored.',
  characterLimitWarning: 'Approaching character limit.',
  characterLimitReached: 'Character limit reached. Cannot add more text.',
} as const;

/**
 * Keyboard Shortcuts Configuration
 */
export const VOICE_KEYBOARD_SHORTCUTS = {
  startStop: {
    key: 'Space',
    description: 'Start or stop voice recording',
    global: false, // Only when button is focused
  },
  stopGlobal: {
    key: 'Escape',
    description: 'Stop recording (works globally when recording)',
    global: true,
  },
  newRecording: {
    key: 'Ctrl+Enter',
    description: 'Start new recording',
    global: true,
  },
  pauseResume: {
    key: 'Ctrl+Space',
    description: 'Pause or resume recording',
    global: false,
  },
} as const;

/**
 * Accessibility Announcement Manager
 */
class AccessibilityAnnouncementManager {
  private announcements: AccessibilityAnnouncement[] = [];
  private currentElement: HTMLElement | null = null;

  /**
   * Initialize the announcement system
   */
  initialize() {
    if (typeof document === 'undefined') return;

    // Create or get existing live region
    let liveRegion = document.getElementById('voice-accessibility-announcements');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'voice-accessibility-announcements';
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
    }
    this.currentElement = liveRegion;
  }

  /**
   * Announce a message to screen readers
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite', delay: number = 0) {
    if (!this.currentElement) {
      this.initialize();
    }

    const announcement: AccessibilityAnnouncement = { message, priority, delay };
    this.announcements.push(announcement);

    // Process announcement after delay
    setTimeout(() => {
      this.processAnnouncement(announcement);
    }, delay);
  }

  /**
   * Process and deliver announcement
   */
  private processAnnouncement(announcement: AccessibilityAnnouncement) {
    if (!this.currentElement) return;

    // Update aria-live attribute based on priority
    this.currentElement.setAttribute('aria-live', announcement.priority);
    
    // Clear previous content and set new message
    this.currentElement.textContent = '';
    setTimeout(() => {
      if (this.currentElement) {
        this.currentElement.textContent = announcement.message;
      }
    }, 100);

    // Clear message after 5 seconds to prevent accumulation
    setTimeout(() => {
      if (this.currentElement && this.currentElement.textContent === announcement.message) {
        this.currentElement.textContent = '';
      }
    }, 5000);
  }

  /**
   * Clear all pending announcements
   */
  clear() {
    this.announcements = [];
    if (this.currentElement) {
      this.currentElement.textContent = '';
    }
  }
}

// Global announcement manager instance
export const voiceAnnouncementManager = new AccessibilityAnnouncementManager();

/**
 * Generate accessibility attributes for voice components
 */
export function getVoiceAccessibilityProps(
  componentType: 'recordButton' | 'pauseButton' | 'textArea' | 'transcriptionOverlay' | 'audioVisualizer',
  state: Partial<VoiceAccessibilityState> = {}
) {
  const { isRecording = false, isPaused = false, duration = 0, transcriptionText = '', error } = state;

  switch (componentType) {
    case 'recordButton':
      return {
        'aria-label': getRecordButtonLabel(isRecording, isPaused, error),
        'aria-describedby': 'voice-shortcuts-hint voice-status-description',
        'aria-pressed': isRecording,
        role: 'button',
        tabIndex: 0,
      };

    case 'pauseButton':
      return {
        'aria-label': isPaused ? VOICE_ARIA_LABELS.pauseButton.resume : VOICE_ARIA_LABELS.pauseButton.pause,
        role: 'button',
        tabIndex: 0,
      };

    case 'textArea':
      return {
        'aria-label': VOICE_ARIA_LABELS.textArea.label,
        'aria-describedby': 'voice-textarea-description',
        role: 'textbox',
        'aria-multiline': true,
      };

    case 'transcriptionOverlay':
      return {
        'aria-label': VOICE_ARIA_LABELS.transcriptionOverlay.label,
        'aria-describedby': 'transcription-description',
        'aria-live': 'polite',
        'aria-atomic': false,
        role: 'status',
      };

    case 'audioVisualizer':
      return {
        'aria-label': VOICE_ARIA_LABELS.audioVisualizer.label,
        'aria-describedby': 'audio-visualizer-description',
        role: 'img',
        'aria-hidden': 'true', // Decorative, audio level is announced separately
      };

    default:
      return {};
  }
}

/**
 * Get appropriate record button label based on state
 */
function getRecordButtonLabel(isRecording: boolean, isPaused: boolean, error?: string): string {
  if (error) return VOICE_ARIA_LABELS.recordButton.disabled;
  if (isRecording && isPaused) return VOICE_ARIA_LABELS.recordButton.paused;
  if (isRecording) return VOICE_ARIA_LABELS.recordButton.recording;
  return VOICE_ARIA_LABELS.recordButton.idle;
}

/**
 * Voice state change announcer
 */
export function announceVoiceStateChange(
  previousState: Partial<VoiceAccessibilityState>,
  currentState: Partial<VoiceAccessibilityState>
) {
  const { isRecording: wasRecording = false, isPaused: wasPaused = false } = previousState;
  const { isRecording = false, isPaused = false, transcriptionText = '', error } = currentState;

  // Recording started
  if (!wasRecording && isRecording) {
    voiceAnnouncementManager.announce(VOICE_ANNOUNCEMENTS.recordingStarted, 'assertive');
  }

  // Recording stopped
  if (wasRecording && !isRecording) {
    voiceAnnouncementManager.announce(VOICE_ANNOUNCEMENTS.recordingStopped, 'assertive');
  }

  // Recording paused
  if (isRecording && !wasPaused && isPaused) {
    voiceAnnouncementManager.announce(VOICE_ANNOUNCEMENTS.recordingPaused, 'assertive');
  }

  // Recording resumed
  if (isRecording && wasPaused && !isPaused) {
    voiceAnnouncementManager.announce(VOICE_ANNOUNCEMENTS.recordingResumed, 'assertive');
  }

  // Transcription completed
  if (transcriptionText && transcriptionText !== previousState.transcriptionText) {
    voiceAnnouncementManager.announce(
      VOICE_ANNOUNCEMENTS.transcriptionComplete(transcriptionText),
      'polite',
      500 // Small delay to avoid interrupting user
    );
  }

  // Error occurred
  if (error && error !== previousState.error) {
    voiceAnnouncementManager.announce(error, 'assertive');
  }
}

/**
 * Initialize accessibility features for voice components
 */
export function initializeVoiceAccessibility() {
  if (typeof document === 'undefined') return;

  // Initialize announcement manager
  voiceAnnouncementManager.initialize();

  // Add hidden descriptions for screen readers
  addHiddenDescriptions();

  // Set up keyboard event listeners for global shortcuts
  setupGlobalKeyboardShortcuts();
}

/**
 * Add hidden descriptions for screen readers
 */
function addHiddenDescriptions() {
  const descriptions = [
    {
      id: 'voice-status-description',
      text: 'Voice recording status and controls. Use keyboard shortcuts for quick access.',
    },
    {
      id: 'voice-textarea-description',
      text: VOICE_ARIA_LABELS.textArea.description,
    },
    {
      id: 'transcription-description',
      text: VOICE_ARIA_LABELS.transcriptionOverlay.description,
    },
    {
      id: 'audio-visualizer-description',
      text: VOICE_ARIA_LABELS.audioVisualizer.description,
    },
  ];

  descriptions.forEach(({ id, text }) => {
    if (!document.getElementById(id)) {
      const element = document.createElement('div');
      element.id = id;
      element.className = 'sr-only';
      element.textContent = text;
      document.body.appendChild(element);
    }
  });
}

/**
 * Set up global keyboard shortcuts
 */
function setupGlobalKeyboardShortcuts() {
  // This would be implemented by the components themselves
  // as they need access to their specific handlers
}

/**
 * Check if high contrast mode is enabled
 */
export function isHighContrastMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-contrast: high)').matches;
}

/**
 * Check if reduced motion is preferred
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get appropriate focus ring styles based on user preferences
 */
export function getFocusRingStyles(): string {
  const isHighContrast = isHighContrastMode();
  
  if (isHighContrast) {
    return 'focus:ring-4 focus:ring-black focus:ring-offset-4 focus:ring-offset-white';
  }
  
  return 'focus:ring-4 focus:ring-[#800020]/30 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900';
}

/**
 * Cleanup accessibility resources
 */
export function cleanupVoiceAccessibility() {
  voiceAnnouncementManager.clear();
  
  // Remove live region
  const liveRegion = document.getElementById('voice-accessibility-announcements');
  if (liveRegion) {
    liveRegion.remove();
  }
}