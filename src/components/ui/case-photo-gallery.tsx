'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function isValidCasePhotoUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url.trim()) return false;
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:');
}

type CasePhotoGalleryProps = {
  photos: string[] | null | undefined;
  title?: string;
  className?: string;
  emptyLabel?: string;
};

function preloadImage(url: string) {
  if (typeof window === 'undefined') return;
  const img = new window.Image();
  img.src = url;
}

export function CasePhotoGallery({
  photos,
  title = 'Photos',
  className,
  emptyLabel = 'No images available',
}: CasePhotoGalleryProps) {
  const validPhotos = useMemo(
    () => (photos ?? []).filter(isValidCasePhotoUrl),
    [photos]
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [validPhotos]);

  useEffect(() => {
    if (validPhotos.length === 0) return;
    const clamped = Math.min(index, validPhotos.length - 1);
    if (clamped !== index) setIndex(clamped);
    if (validPhotos[clamped + 1]) preloadImage(validPhotos[clamped + 1]);
    if (validPhotos[clamped - 1]) preloadImage(validPhotos[clamped - 1]);
  }, [index, validPhotos]);

  const goPrev = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((current) => Math.min(validPhotos.length - 1, current + 1));
  }, [validPhotos.length]);

  if (validPhotos.length === 0) {
    return (
      <div className={cn('bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden', className)}>
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="flex items-center justify-center aspect-[4/3] max-h-[min(70vh,520px)] bg-gray-50 text-gray-500">
          <div className="text-center px-4">
            <ImageIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">{emptyLabel}</p>
          </div>
        </div>
      </div>
    );
  }

  const currentSrc = validPhotos[index];

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden', className)}>
      {title ? (
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
      ) : null}

      <div className="relative w-full aspect-[4/3] max-h-[min(70vh,520px)] bg-gray-100">
        <Image
          key={currentSrc}
          src={currentSrc}
          alt={`${title} ${index + 1}`}
          fill
          priority={index === 0}
          unoptimized
          className="object-contain"
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 66vw, 800px"
        />

        {validPhotos.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              disabled={index === 0}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70 disabled:opacity-30"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={index === validPhotos.length - 1}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70 disabled:opacity-30"
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <span className="rounded-full bg-black/55 px-3 py-1 text-sm text-white backdrop-blur-sm">
                {index + 1} / {validPhotos.length}
              </span>
            </div>
          </>
        )}
      </div>

      {validPhotos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto p-3 border-t border-gray-100">
          {validPhotos.map((photo, photoIndex) => (
            <button
              key={`${photo}-${photoIndex}`}
              type="button"
              onClick={() => setIndex(photoIndex)}
              className={cn(
                'relative flex-shrink-0 h-16 w-16 rounded-lg overflow-hidden border-2 transition-all',
                photoIndex === index
                  ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-focus-ring)]'
                  : 'border-gray-200 hover:border-gray-300'
              )}
              aria-label={`View photo ${photoIndex + 1}`}
            >
              <Image
                src={photo}
                alt={`Thumbnail ${photoIndex + 1}`}
                width={64}
                height={64}
                unoptimized
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
