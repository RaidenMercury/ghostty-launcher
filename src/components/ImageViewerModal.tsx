import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api';
import { useI18n } from '../utils/i18n';

export interface GalleryImage {
  url: string;
  title?: string;
  description?: string;
}

interface ImageViewerModalProps {
  isOpen: boolean;
  images: GalleryImage[];
  initialIndex?: number;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  images,
  initialIndex = 0,
  onClose,
}) => {
  const { t } = useI18n();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
    }
  }, [isOpen, initialIndex, images.length]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  // Preload next and previous images for instant switching
  useEffect(() => {
    if (!isOpen || images.length <= 1) return;
    const nextIdx = (currentIndex + 1) % images.length;
    const prevIdx = (currentIndex - 1 + images.length) % images.length;
    if (images[nextIdx]?.url) {
      const imgNext = new Image();
      imgNext.src = images[nextIdx].url;
    }
    if (images[prevIdx]?.url) {
      const imgPrev = new Image();
      imgPrev.src = images[prevIdx].url;
    }
  }, [isOpen, currentIndex, images]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.stopPropagation();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.stopPropagation();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext]);

  const currentImg = images[currentIndex] || images[0];

  return (
    <AnimatePresence>
      {isOpen && images.length > 0 && currentImg && (
        <motion.div
          key="image-viewer-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[70] flex flex-col items-center justify-between p-4 sm:p-6 select-none"
        >
          {/* Backdrop Scrim */}
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
          />

          {/* Top Controls Bar */}
          <div className="relative z-10 w-full max-w-5xl flex items-center justify-between gap-3 shrink-0 py-1">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono px-3 py-1 rounded-full glass-control text-ghost-200 tabular-nums shadow-lg">
                {currentIndex + 1} {t.viewer_counter} {images.length}
              </span>
              {currentImg.title && (
                <span className="text-sm font-semibold text-ghost-50 truncate max-w-md hidden sm:inline drop-shadow">
                  {currentImg.title}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => api.openExternalUrl(currentImg.url)}
                className="btn-tactile p-2 rounded-full glass-control text-ghost-300 hover:text-ghost-50 shadow-lg cursor-pointer"
                title={t.viewer_open_original}
              >
                <ExternalLink className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-tactile p-2 rounded-full glass-control text-ghost-300 hover:text-ghost-50 shadow-lg cursor-pointer"
                title={t.viewer_close}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Stage (Image & Chevrons) */}
          <div className="relative z-10 w-full flex-1 flex items-center justify-center min-h-0 my-2">
            {/* Prev Button */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                className="btn-tactile absolute left-2 sm:left-6 z-20 p-3 rounded-full glass-control text-ghost-200 hover:text-ghost-50 hover:scale-110 shadow-2xl transition-all cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Active Image */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-full max-w-full flex flex-col items-center justify-center pointer-events-auto"
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentImg.url}
                  src={currentImg.url}
                  alt={currentImg.title || ''}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="max-h-[72vh] max-w-[88vw] object-contain rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.85)] border border-white/10"
                />
              </AnimatePresence>

              {/* Caption / Description if present */}
              {(currentImg.title || currentImg.description) && (
                <div className="mt-2.5 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-center max-w-lg">
                  {currentImg.title && (
                    <p className="text-xs font-semibold text-ghost-50 truncate">
                      {currentImg.title}
                    </p>
                  )}
                  {currentImg.description && (
                    <p className="text-[11px] text-ghost-300 truncate mt-0.5">
                      {currentImg.description}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Next Button */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={handleNext}
                className="btn-tactile absolute right-2 sm:right-6 z-20 p-3 rounded-full glass-control text-ghost-200 hover:text-ghost-50 hover:scale-110 shadow-2xl transition-all cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div className="relative z-10 w-full max-w-2xl flex items-center justify-center gap-2 overflow-x-auto py-2 shrink-0 px-2 scrollbar-none">
              {images.map((img, idx) => (
                <button
                  key={img.url + idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`relative h-12 w-16 sm:h-14 sm:w-20 rounded-lg overflow-hidden border transition-all shrink-0 cursor-pointer ${
                    currentIndex === idx
                      ? 'ring-2 ring-[var(--accent)] border-transparent scale-105 shadow-lg opacity-100'
                      : 'border-white/15 opacity-50 hover:opacity-90'
                  }`}
                >
                  <img
                    src={img.url}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
