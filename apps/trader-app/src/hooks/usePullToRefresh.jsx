import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * usePullToRefresh
 * 
 * A lightweight pull-to-refresh hook for touch devices.
 * 
 * Usage:
 *   const { containerRef, isRefreshing, pullProgress } = usePullToRefresh(onRefresh);
 *   <div ref={containerRef}>...</div>
 *
 * iOS Fix: Uses a raw non-passive touchmove listener (via useEffect) instead of
 * React synthetic events. This allows e.preventDefault() to suppress the native
 * iOS rubber-band scroll that would cause a double-bounce effect alongside our
 * custom translateY animation.
 *
 * @param {Function} onRefresh - async function called when pull threshold is reached
 * @param {Object}   options
 * @param {number}   options.threshold  - pull distance (px) to trigger refresh (default: 80)
 * @param {boolean}  options.enabled    - disable on desktop (default: true)
 */
export function usePullToRefresh(onRefresh, { threshold = 80, enabled = true } = {}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef(null);
  const startY = useRef(null);
  const isTouching = useRef(false);
  const isPulling = useRef(false); // tracks if we're in an active pull gesture
  const isRefreshingRef = useRef(false);

  const pullProgress = Math.min(pullDistance / threshold, 1);

  // Keep ref in sync so event handlers always see latest value
  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    const handleTouchStart = (e) => {
      if (isRefreshingRef.current) return;
      // Only activate when scrolled to top
      if (el.scrollTop > 0) return;
      startY.current = e.touches[0].clientY;
      isTouching.current = true;
      isPulling.current = false;
    };

    const handleTouchMove = (e) => {
      if (!isTouching.current || startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;

      if (dy < 0) {
        // Scrolling down — reset
        startY.current = null;
        isTouching.current = false;
        isPulling.current = false;
        setPullDistance(0);
        return;
      }

      // We are in a pull-down gesture — prevent iOS native rubber-band bounce
      // This stops the double-bounce (native + our translateY running simultaneously)
      if (dy > 5) {
        // Must call preventDefault on a non-passive listener
        e.preventDefault();
        isPulling.current = true;
      }

      // Apply resistance (square root feel)
      setPullDistance(Math.sqrt(dy) * 6);
    };

    const handleTouchEnd = async () => {
      if (!isTouching.current) return;
      isTouching.current = false;
      startY.current = null;
      isPulling.current = false;

      const currentDistance = pullDistance;
      if (currentDistance >= threshold) {
        setIsRefreshing(true);
        setPullDistance(0);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
        }
      } else {
        setPullDistance(0);
      }
    };

    // IMPORTANT: { passive: false } is required for e.preventDefault() to work on iOS
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false }); // non-passive!
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, threshold, onRefresh, pullDistance]);

  // containerProps for backwards compatibility with pages already using spread syntax
  const containerProps = {
    style: {
      transform: pullDistance > 0 ? `translateY(${Math.min(pullDistance, threshold)}px)` : undefined,
      transition: isTouching.current ? 'none' : 'transform 0.3s ease',
    },
  };

  return { containerRef, containerProps, isRefreshing, pullProgress };
}

/**
 * PullIndicator — the spinning/loading indicator shown during pull
 */
export function PullIndicator({ progress, pullProgress, isRefreshing }) {
  const actualProgress = progress !== undefined ? progress : (pullProgress !== undefined ? pullProgress : 0);
  if (actualProgress === 0 && !isRefreshing) return null;

  return (
    <div
      className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-10"
      style={{
        height: 48,
        transform: `translateY(${isRefreshing ? 0 : (actualProgress - 1) * 48}px)`,
        transition: isRefreshing ? 'none' : 'transform 0.3s ease',
      }}
    >
      <div
        className={`w-7 h-7 rounded-full border-2 border-gray-300 border-t-[#f06428] ${isRefreshing ? 'animate-spin' : ''}`}
        style={{
          transform: isRefreshing ? undefined : `rotate(${actualProgress * 360}deg)`,
        }}
      />
    </div>
  );
}
