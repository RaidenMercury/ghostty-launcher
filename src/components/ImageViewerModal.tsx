import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

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
    const timer = setTimeout(() => {
      const container = carouselRef.current;
      const activeItem = itemRefs.current[currentIndex];
      if (container && activeItem) {
        const containerWidth = container.offsetWidth;
        const itemLeft = activeItem.offsetLeft;
        const itemWidth = activeItem.offsetWidth;
        const targetScrollLeft = itemLeft - containerWidth / 2 + itemWidth / 2;

        container.scrollTo({
          left: Math.max(0, targetScrollLeft),
          behavior: 'smooth',
        });
      }
    }, 50);

    return () => clearTimeout(timer);
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
          onClick={onClose}
          className="fixed inset-0 z-[70] flex flex-col items-center justify-between p-3 sm:p-5 select-none cursor-pointer bg-[#05060b]/94"
        >
          {/* Top Controls Bar */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-5xl flex items-center justify-between gap-3 shrink-0 py-1 cursor-default"
          >
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

          {/* Main Stage (Clicking empty background closes the viewer) */}
          <div
            onClick={onClose}
            className="relative z-10 w-full flex-1 flex items-center justify-center min-h-0 my-2 cursor-pointer"
          >
            {/* Prev Button */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                className="btn-tactile absolute left-2 sm:left-6 z-20 p-3 rounded-full bg-black/60 hover:bg-black/90 border border-white/15 text-ghost-200 hover:text-ghost-50 hover:scale-110 shadow-2xl transition-all cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Active Image (Clicking on image does not close modal) */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-full max-w-full flex flex-col items-center justify-center cursor-default"
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
                  className="max-h-[68vh] max-w-[88vw] object-contain rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.9)] border border-white/10"
                />
              </AnimatePresence>

              {/* Caption / Description if present */}
              {(currentImg.title || currentImg.description) && (
                <div className="mt-2.5 px-4 py-1.5 rounded-full bg-black/80 border border-white/10 text-center max-w-lg shadow-lg">
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
                className="btn-tactile absolute right-2 sm:right-6 z-20 p-3 rounded-full bg-black/60 hover:bg-black/90 border border-white/15 text-ghost-200 hover:text-ghost-50 hover:scale-110 shadow-2xl transition-all cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Thumbnail Carousel - Auto-centering on active item */}
          {images.length > 1 && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-5xl flex items-center justify-center shrink-0 py-2 cursor-default"
            >
              <div
                ref={carouselRef}
                onWheel={(e) => {
                  if (carouselRef.current) {
                    carouselRef.current.scrollLeft += e.deltaY;
                  }
                }}
                className="w-full flex items-center gap-3 overflow-x-auto py-2 px-6 scroll-smooth scrollbar-none"
                style={{
                  scrollSnapType: 'x mandatory',
                }}
              >
                {/* Generous left and right spacer to allow first & last items to center perfectly */}
                <div className="shrink-0 w-[35vw] max-w-[280px]" aria-hidden="true" />

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
                      className={`relative h-14 w-22 sm:h-16 sm:w-26 rounded-xl overflow-hidden border transition-all duration-200 shrink-0 cursor-pointer scroll-snap-align-center ${
                        isActive
                          ? 'ring-2 ring-[var(--accent)] border-transparent scale-110 shadow-2xl opacity-100 z-10'
                          : 'border-white/15 opacity-45 hover:opacity-85 hover:scale-102'
                      }`}
                      style={{
                        scrollSnapAlign: 'center',
                      }}
                    >
                      <img
                        src={img.url}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      {isActive && (
                        <div className="absolute inset-0 border-2 border-[var(--accent)] rounded-xl pointer-events-none" />
                      )}
                    </button>
                  );
                })}

                <div className="shrink-0 w-[35vw] max-w-[280px]" aria-hidden="true" />
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
