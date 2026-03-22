'use client';

/**
 * Digital Signature Pad Component
 * 
 * Canvas-based signature capture with touch and mouse support.
 * Mobile responsive with clear/redo functionality.
 */

import { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface DigitalSignaturePadProps {
  onSignatureChange: (signatureData: string | null) => void;
  width?: number;
  height?: number;
  className?: string;
}

export function DigitalSignaturePad({
  onSignatureChange,
  width = 600,
  height = 200,
  className = '',
}: DigitalSignaturePadProps) {
  const signaturePadRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ width, height });

  // Handle responsive canvas sizing
  useEffect(() => {
    const handleResize = () => {
      const container = document.getElementById('signature-container');
      if (container) {
        const containerWidth = container.clientWidth;
        const newWidth = Math.min(containerWidth - 40, width);
        const newHeight = Math.round((newWidth / width) * height);
        setCanvasSize({ width: newWidth, height: newHeight });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [width, height]);

  const handleEnd = () => {
    if (signaturePadRef.current) {
      const isEmpty = signaturePadRef.current.isEmpty();
      setIsEmpty(isEmpty);

      if (!isEmpty) {
        const signatureData = signaturePadRef.current.toDataURL('image/png');
        onSignatureChange(signatureData);
      } else {
        onSignatureChange(null);
      }
    }
  };

  const handleClear = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      setIsEmpty(true);
      onSignatureChange(null);
    }
  };

  return (
    <div id="signature-container" className={`space-y-4 ${className}`}>
      <div className="relative">
        <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
          <SignatureCanvas
            ref={signaturePadRef}
            canvasProps={{
              width: canvasSize.width,
              height: canvasSize.height,
              className: 'signature-canvas',
              style: { touchAction: 'none' },
            }}
            backgroundColor="white"
            penColor="black"
            minWidth={1}
            maxWidth={3}
            onEnd={handleEnd}
          />
        </div>

        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-sm md:text-base">
              Sign here with your finger or mouse
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={handleClear}
          disabled={isEmpty}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Clear Signature
        </button>

        <p className="text-xs text-gray-500">
          {isEmpty ? 'No signature' : 'Signature captured'}
        </p>
      </div>

      <style jsx global>{`
        .signature-canvas {
          cursor: crosshair;
        }
      `}</style>
    </div>
  );
}
