import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { UnifiedVoiceField } from '@/components/ui/unified-voice-field';
import { ModernVoiceControls } from '@/components/ui/modern-voice-controls';

describe('Voice Note Integration Tests', () => {
  describe('UnifiedVoiceField', () => {
    it('should render with default props', () => {
      render(
        <UnifiedVoiceField
          value=""
          onChange={vi.fn()}
        />
      );
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('placeholder', 'Voice notes will appear here...');
    });

    it('should display character count when enabled', () => {
      render(
        <UnifiedVoiceField
          value="Test content"
          onChange={vi.fn()}
          showCharacterCount={true}
        />
      );
      
      expect(screen.getByText('12/5,000')).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      render(
        <UnifiedVoiceField
          value=""
          onChange={vi.fn()}
          aria-label="Voice notes text area"
        />
      );
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('aria-label', 'Voice notes text area');
    });
  });

  describe('ModernVoiceControls', () => {
    const mockProps = {
      isRecording: false,
      onStartRecording: vi.fn(),
      onStopRecording: vi.fn(),
      disabled: false,
    };

    it('should render recording button', () => {
      render(<ModernVoiceControls {...mockProps} />);
      
      const button = screen.getByRole('button', { name: /start voice recording/i });
      expect(button).toBeInTheDocument();
    });

    it('should show recording state when recording', () => {
      render(<ModernVoiceControls {...mockProps} isRecording={true} />);
      
      const button = screen.getByRole('button', { name: /stop voice recording/i });
      expect(button).toBeInTheDocument();
      expect(screen.getByText('RECORDING')).toBeInTheDocument();
    });

    it('should display keyboard shortcuts hint', () => {
      render(<ModernVoiceControls {...mockProps} />);
      
      expect(screen.getByText('Space')).toBeInTheDocument();
      expect(screen.getByText('Esc')).toBeInTheDocument();
      expect(screen.getByText('Ctrl')).toBeInTheDocument();
      expect(screen.getByText('Enter')).toBeInTheDocument();
    });
  });

  describe('Voice Note Integration', () => {
    it('should work together in a form context', () => {
      const mockOnChange = vi.fn();
      const mockOnStart = vi.fn();
      const mockOnStop = vi.fn();

      render(
        <div>
          <UnifiedVoiceField
            value="Previous voice note content"
            onChange={mockOnChange}
          />
          <ModernVoiceControls
            isRecording={false}
            onStartRecording={mockOnStart}
            onStopRecording={mockOnStop}
          />
        </div>
      );

      // Check that both components are rendered
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start voice recording/i })).toBeInTheDocument();
      
      // Check that the voice field has the expected content
      expect(screen.getByDisplayValue('Previous voice note content')).toBeInTheDocument();
    });
  });
});