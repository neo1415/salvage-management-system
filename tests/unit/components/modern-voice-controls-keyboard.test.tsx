import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { ModernVoiceControls } from '@/components/ui/modern-voice-controls';

describe('ModernVoiceControls Keyboard Accessibility', () => {
  const mockProps = {
    isRecording: false,
    onStartRecording: vi.fn(),
    onStopRecording: vi.fn(),
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Space key functionality', () => {
    it('should start recording when Space is pressed and button is focused', async () => {
      const user = userEvent.setup();
      render(<ModernVoiceControls {...mockProps} />);
      
      const button = screen.getByRole('button', { name: /start voice recording/i });
      button.focus();
      
      await user.keyboard(' ');
      
      expect(mockProps.onStartRecording).toHaveBeenCalledTimes(1);
    });

    it('should stop recording when Space is pressed while recording', async () => {
      const user = userEvent.setup();
      render(<ModernVoiceControls {...mockProps} isRecording={true} />);
      
      const button = screen.getByRole('button', { name: /stop voice recording/i });
      button.focus();
      
      await user.keyboard(' ');
      
      expect(mockProps.onStopRecording).toHaveBeenCalledTimes(1);
    });
  });

  describe('Escape key functionality', () => {
    it('should stop recording when Escape is pressed while recording', async () => {
      const user = userEvent.setup();
      render(<ModernVoiceControls {...mockProps} isRecording={true} />);
      
      await user.keyboard('{Escape}');
      
      expect(mockProps.onStopRecording).toHaveBeenCalledTimes(1);
    });

    it('should not trigger when Escape is pressed and not recording', async () => {
      const user = userEvent.setup();
      render(<ModernVoiceControls {...mockProps} />);
      
      await user.keyboard('{Escape}');
      
      expect(mockProps.onStartRecording).not.toHaveBeenCalled();
      expect(mockProps.onStopRecording).not.toHaveBeenCalled();
    });
  });

  describe('Ctrl+Enter functionality', () => {
    it('should start recording when Ctrl+Enter is pressed', async () => {
      const user = userEvent.setup();
      render(<ModernVoiceControls {...mockProps} />);
      
      await user.keyboard('{Control>}{Enter}{/Control}');
      
      expect(mockProps.onStartRecording).toHaveBeenCalledTimes(1);
    });

    it('should not trigger when Ctrl+Enter is pressed while recording', async () => {
      const user = userEvent.setup();
      render(<ModernVoiceControls {...mockProps} isRecording={true} />);
      
      await user.keyboard('{Control>}{Enter}{/Control}');
      
      expect(mockProps.onStartRecording).not.toHaveBeenCalled();
    });
  });

  describe('Focus management', () => {
    it('should have proper tabindex for keyboard navigation', () => {
      render(<ModernVoiceControls {...mockProps} />);
      
      const button = screen.getByRole('button', { name: /start voice recording/i });
      expect(button).toHaveAttribute('tabIndex', '0');
    });

    it('should show enhanced focus styles when focused via keyboard', async () => {
      const user = userEvent.setup();
      render(<ModernVoiceControls {...mockProps} />);
      
      const button = screen.getByRole('button', { name: /start voice recording/i });
      
      await user.tab();
      expect(button).toHaveFocus();
    });

    it('should have proper ARIA labels for accessibility', () => {
      render(<ModernVoiceControls {...mockProps} />);
      
      const button = screen.getByRole('button', { name: /start voice recording/i });
      expect(button).toHaveAttribute('aria-label', 'Start voice recording');
      expect(button).toHaveAttribute('aria-describedby', 'voice-shortcuts-hint');
    });
  });

  describe('Screen reader announcements', () => {
    it('should announce recording state changes', () => {
      const { rerender } = render(<ModernVoiceControls {...mockProps} />);
      
      // Check initial state
      expect(screen.getByRole('status')).toBeInTheDocument();
      
      // Check recording state
      rerender(<ModernVoiceControls {...mockProps} isRecording={true} />);
      expect(screen.getByText(/recording in progress/i)).toBeInTheDocument();
    });
  });

  describe('Keyboard shortcuts hint', () => {
    it('should display keyboard shortcuts information', () => {
      render(<ModernVoiceControls {...mockProps} />);
      
      expect(screen.getByText('Space')).toBeInTheDocument();
      expect(screen.getByText('Esc')).toBeInTheDocument();
      expect(screen.getByText('Ctrl')).toBeInTheDocument();
      expect(screen.getByText('Enter')).toBeInTheDocument();
    });
  });
});