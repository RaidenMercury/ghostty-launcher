import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const [mounted, setMounted] = useState(false);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const idx = Math.max(0, Math.min(initialIndex, images.length - 1));
      setCurrentIndex(idx);
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

  // Center active thumbnail in carousel whenever currentIndex changes
  useEffect(() => {
    if (!isOpen || images.length <= 1) return;
    const rafId = requestAnimationFrame(() => {
      const container = carouselRef.current;
      const activeItem = itemRefs.current[currentIndex];
      if (container && activeItem) {
        const containerRect = container.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();
        if (containerRect.width > 0) {
          const targetScroll =
            container.scrollLeft +
            (itemRect.left - containerRect.left) -
            (containerRect.width - itemRect.width) / 2;

          container.scrollTo({
            left: Math.max(0, targetScroll),
            behavior: 'smooth',
          });
        }
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [currentIndex, isOpen, images.length]);

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

  // Native keyboard navigation
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

  if (!mounted || typeof document === 'undefined') return null;

  const currentImg = images[currentIndex] || images[0];

  return createPortal(
    <AnimatePresence>
      {isOpen && images.length > 0 && currentImg && (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          {/* Layer 1: Island Blur Backdrop with 75% dark scrim */}
          <motion.div
            key="viewer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 pointer-events-auto island-backdrop bg-black/75 cursor-pointer"
          />

          {/* Layer 2: Floating Foreground Stage */}
          <motion.div
            key="viewer-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 flex flex-col items-center justify-between p-3 sm:p-5 pointer-events-none select-none"
          >
            {/* Top Controls Bar */}
            <div className="relative z-10 w-full max-w-5xl flex items-center justify-between gap-3 shrink-0 py-1.5 pointer-events-auto">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-white/[0.08] border border-white/10 text-ghost-200 tabular-nums shadow-lg">
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
                  className="btn-tactile p-2 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 text-ghost-300 hover:text-ghost-50 shadow-lg cursor-pointer transition-colors"
                  title={t.viewer_open_original}
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-tactile p-2 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 text-ghost-300 hover:text-ghost-50 shadow-lg cursor-pointer transition-colors"
                  title={t.viewer_close}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main Stage (Empty space is pointer-events-none so clicks hit Layer 1 backdrop) */}
            <div className="relative z-10 w-full flex-1 flex items-center justify-center min-h-0 my-2 pointer-events-none">
              {/* Prev Button */}
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrev();
                  }}
                  className="btn-tactile absolute left-2 sm:left-6 z-20 p-3 rounded-full bg-black/60 hover:bg-black/90 border border-white/15 text-ghost-200 hover:text-ghost-50 hover:scale-110 shadow-2xl transition-all cursor-pointer pointer-events-auto"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              {/* Active Image Container */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="relative max-h-full max-w-full flex flex-col items-center justify-center cursor-default pointer-events-auto"
              >
                <img
                  key={currentImg.url}
                  src={currentImg.url}
                  alt={currentImg.title || ''}
                  draggable={false}
                  className="max-h-[72vh] max-w-[88vw] object-contain rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.9)] border border-white/10 select-none"
                />

                {/* Caption / Description if present */}
                {(currentImg.title || currentImg.description) && (
                  <div className="mt-2.5 px-4 py-1.5 rounded-full bg-black/85 border border-white/10 text-center max-w-lg shadow-lg">
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
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNext();
                  }}
                  className="btn-tactile absolute right-2 sm:right-6 z-20 p-3 rounded-full bg-black/60 hover:bg-black/90 border border-white/15 text-ghost-200 hover:text-ghost-50 hover:scale-110 shadow-2xl transition-all cursor-pointer pointer-events-auto"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Thumbnail Carousel - Compact, elegant strip with auto-centering */}
            {images.length > 1 && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 w-full max-w-4xl flex items-center justify-center shrink-0 py-2 pointer-events-auto cursor-default"
              >
                <div
                  ref={carouselRef}
                  onWheel={(e) => {
                    if (carouselRef.current) {
                      carouselRef.current.scrollLeft += e.deltaY;
                    }
                  }}
                  className={`w-full flex items-center gap-2.5 overflow-x-auto py-2 px-8 sm:px-12 scroll-smooth scrollbar-none ${
                    images.length <= 5 ? 'justify-center' : 'justify-start'
                  }`}
                >
                  {images.map((img, idx) => {
                    const isActive = currentIndex === idx;
                    return (
                      <button
                        key={img.url + idx}
                        ref={(el) => {
                          itemRefs.current[idx] = el;
                        }}
                        type="button"
                        onClick={() => setCurrentIndex(idx)}
                        className={`relative w-20 h-14 sm:w-24 sm:h-16 rounded-lg overflow-hidden border transition-all duration-200 shrink-0 cursor-pointer select-none ${
                          isActive
                            ? 'ring-2 ring-[var(--accent)] border-transparent scale-105 shadow-xl opacity-100 z-10'
                            : 'border-white/15 opacity-40 hover:opacity-85 hover:scale-100'
                        }`}
                      >
                        <img
                          src={img.url}
                          alt=""
                          draggable={false}
                          loading="lazy"
                          className="w-full h-full object-cover select-none pointer-events-none"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
