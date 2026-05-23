export type ThemeMode = 'light' | 'dark' | 'high-contrast' | 'auto';

export interface ModernTheme {
  colors: {
    primary: string;
    primaryHover: string;
    primaryActive: string;
    surface: string;
    text: {
      primary: string;
      secondary: string;
    };
    border: {
      default: string;
    };
    voice: {
      recording: string;
      processing: string;
      success: string;
      error: string;
      idle: string;
    };
  };
  borderRadius: {
    lg: string;
    full: string;
  };
  shadows: {
    lg: string;
  };
  animations: {
    duration: {
      normal: string;
      slow: string;
    };
    easing: {
      ease: string;
    };
  };
  typography: {
    fontFamily: {
      mono: string;
    };
    fontSize: {
      sm: string;
    };
    fontWeight: {
      medium: string;
    };
  };
  spacing: {
    scale: Record<number, string>;
  };
}

const baseTheme: ModernTheme = {
  colors: {
    primary: '#800020',
    primaryHover: '#9f1239',
    primaryActive: '#6b001b',
    surface: '#ffffff',
    text: {
      primary: '#111827',
      secondary: '#4b5563',
    },
    border: {
      default: '#d1d5db',
    },
    voice: {
      recording: '#dc2626',
      processing: '#f59e0b',
      success: '#059669',
      error: '#b91c1c',
      idle: '#f3f4f6',
    },
  },
  borderRadius: {
    lg: '0.5rem',
    full: '9999px',
  },
  shadows: {
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  },
  animations: {
    duration: {
      normal: '150ms',
      slow: '700ms',
    },
    easing: {
      ease: 'ease',
    },
  },
  typography: {
    fontFamily: {
      mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },
    fontSize: {
      sm: '0.875rem',
    },
    fontWeight: {
      medium: '500',
    },
  },
  spacing: {
    scale: {
      4: '1rem',
    },
  },
};

export function getTheme(_mode: ThemeMode = 'auto'): ModernTheme {
  return baseTheme;
}

export function generateCSSVariables(theme: ModernTheme): Record<string, string> {
  return {
    '--color-primary': theme.colors.primary,
    '--color-primary-hover': theme.colors.primaryHover,
    '--color-primary-active': theme.colors.primaryActive,
    '--color-surface': theme.colors.surface,
    '--color-text-primary': theme.colors.text.primary,
    '--color-text-secondary': theme.colors.text.secondary,
    '--color-border-default': theme.colors.border.default,
    '--color-voice-recording': theme.colors.voice.recording,
    '--color-voice-processing': theme.colors.voice.processing,
    '--color-voice-success': theme.colors.voice.success,
    '--color-voice-error': theme.colors.voice.error,
    '--color-voice-idle': theme.colors.voice.idle,
  };
}
