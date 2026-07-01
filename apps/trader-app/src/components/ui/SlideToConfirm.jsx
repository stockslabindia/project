import { useState, useRef, useCallback } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { cn } from '../../utils/helpers';

/**
 * Slide-to-confirm interaction for order placement.
 * User drags the thumb from left to right to confirm.
 *
 * iOS/Android Fix: onTouchMove and onTouchEnd are on the TRACK (not just the thumb).
 * This ensures drag continues even if the user's finger moves off the thumb element,
 * which is very common on mobile when sliding quickly.
 */
export default function SlideToConfirm({ 
  onConfirm, 
  label = 'Slide to Confirm', 
  variant = 'success', // 'success' | 'danger'
  disabled = false,
  className = '' 
}) {
  const trackRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const startXRef = useRef(0);
  const thumbWidth = 44;
  const padding = 4;

  const getMaxX = useCallback(() => {
    if (!trackRef.current) return 200;
    return trackRef.current.offsetWidth - thumbWidth - padding * 2;
  }, []);

  const getPercentage = useCallback(() => {
    const maxX = getMaxX();
    return maxX > 0 ? Math.min(dragX / maxX, 1) : 0;
  }, [dragX, getMaxX]);

  const handleStart = useCallback((clientX) => {
    if (disabled || confirmed) return;
    setIsDragging(true);
    startXRef.current = clientX - dragX;
  }, [disabled, confirmed, dragX]);

  const handleMove = useCallback((clientX) => {
    if (!isDragging || disabled || confirmed) return;
    const maxX = getMaxX();
    const newX = Math.max(0, Math.min(clientX - startXRef.current, maxX));
    setDragX(newX);
  }, [isDragging, disabled, confirmed, getMaxX]);

  const handleEnd = useCallback(() => {
    if (!isDragging || disabled) return;
    setIsDragging(false);

    const percentage = getPercentage();
    if (percentage >= 0.85) {
      setConfirmed(true);
      setDragX(getMaxX());
      onConfirm?.();
      setTimeout(() => {
        setConfirmed(false);
        setDragX(0);
      }, 400);
    } else {
      setDragX(0);
    }
  }, [isDragging, disabled, getPercentage, getMaxX, onConfirm]);

  // ── Touch handlers on the TRACK (not just the thumb) ──────────────────────
  // This is the critical iOS/Android fix: if handlers are only on the thumb,
  // the drag silently stops the moment the finger strays off the small thumb element.
  // Attaching to the track keeps drag alive for the full swipe gesture.
  const onTrackTouchStart = (e) => {
    // Only start drag if touch begins on or near the thumb
    const thumbLeft = dragX + padding;
    const thumbRight = thumbLeft + thumbWidth;
    const touchX = e.touches[0].clientX - trackRef.current.getBoundingClientRect().left;
    if (touchX >= thumbLeft - 10 && touchX <= thumbRight + 10) {
      e.preventDefault(); // prevent scroll during slide
      handleStart(e.touches[0].clientX);
    }
  };
  const onTrackTouchMove = (e) => {
    if (!isDragging) return;
    e.preventDefault(); // prevent page scroll while sliding
    handleMove(e.touches[0].clientX);
  };
  const onTrackTouchEnd = () => handleEnd();

  // Mouse handlers (desktop)
  const onMouseDown = (e) => handleStart(e.clientX);
  const onMouseMove = (e) => { if (isDragging) handleMove(e.clientX); };
  const onMouseUp = () => handleEnd();
  const onMouseLeave = () => { if (isDragging) handleEnd(); };

  const percentage = getPercentage();
  const isGreen = variant === 'success';

  const bgColor = isGreen ? 'bg-emerald-50' : 'bg-red-50';
  const fillColor = isGreen ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
  const thumbBg = isGreen ? 'bg-emerald-500' : 'bg-red-500';
  const borderColor = isGreen ? 'border-emerald-200' : 'border-red-200';
  const labelColor = isGreen ? 'text-emerald-600' : 'text-red-500';

  return (
    <div
      ref={trackRef}
      className={cn(
        'slide-confirm-track border',
        bgColor,
        borderColor,
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
      // Track receives ALL touch events — thumb stays responsive even when finger drifts
      onTouchStart={onTrackTouchStart}
      onTouchMove={onTrackTouchMove}
      onTouchEnd={onTrackTouchEnd}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {/* Fill behind thumb */}
      <div
        className="slide-confirm-fill"
        style={{
          width: dragX + thumbWidth + padding,
          backgroundColor: fillColor,
        }}
      />

      {/* Label */}
      <div
        className={cn('slide-confirm-label', labelColor)}
        style={{ opacity: 1 - percentage * 1.5 }}
      >
        {label}
      </div>

      {/* Confirmed label */}
      {confirmed && (
        <div className={cn('slide-confirm-label', labelColor, 'font-bold')}>
          <Check size={18} className="mr-1.5" />
          Confirmed!
        </div>
      )}

      {/* Draggable Thumb — mouse-only handlers here; touch is handled by track above */}
      <div
        className={cn(
          'slide-confirm-thumb shadow-lg',
          thumbBg,
          isDragging && 'shadow-xl scale-105'
        )}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onMouseDown={onMouseDown}
      >
        {confirmed ? (
          <Check size={20} className="text-white" strokeWidth={3} />
        ) : (
          <ArrowRight size={20} className="text-white" strokeWidth={2.5} />
        )}
      </div>
    </div>
  );
}
