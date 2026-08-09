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
  const startX = useRef(null);
  const isTouching = useRef(false);
  const isPulling = useRef(false); // tracks if we're in an active pull gesture
  const isRefreshingRef = useRef(false);
  const pullDistanceRef = useRef(0); // ref mirror so touchend sees latest value without stale closure
  const directionLocked = useRef(null); // 'pull' | 'scroll' | 'horizontal' | null

  const pullProgress = Math.min(pullDistance / threshold, 1);

  // Keep refs in sync so event handlers always see latest values
  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    /**
     * Find the actual scrollable child element within the container.
     * The outer container div usually has scrollTop=0 always; the inner
     * overflow-y-auto list is what actually scrolls. We check direct children
     * and one level deeper to find the real scrollable element.
     */
    const getScrollableChild = () => {
      const candidates = [...el.children];
      for (const child of candidates) {
        const style = window.getComputedStyle(child);
        const overflow = style.overflowY;
        if ((overflow === 'auto' || overflow === 'scroll') && child.scrollHeight > child.clientHeight) {
          return child;
        }
        // One level deeper
        for (const grandchild of [...child.children]) {
          const gs = window.getComputedStyle(grandchild);
          const go = gs.overflowY;
          if ((go === 'auto' || go === 'scroll') && grandchild.scrollHeight > grandchild.clientHeight) {
            return grandchild;
          }
        }
      }
      return el; // fallback to container itself
    };

    const handleTouchStart = (e) => {
      if (isRefreshingRef.current) return;

      // Check scrollTop of the ACTUAL scrollable child, not just the outer container.
      // The outer wrapper div has scrollTop=0 always; the inner list is what scrolls.
      const scrollable = getScrollableChild();
      if (scrollable.scrollTop > 0) return;

      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      isTouching.current = true;
      isPulling.current = false;
      directionLocked.current = null;
    };

    const handleTouchMove = (e) => {
      if (!isTouching.current || startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      const dx = Math.abs(e.touches[0].clientX - (startX.current || 0));

      // Determine gesture direction once we have enough movement to be sure
      if (directionLocked.current === null) {
        if (Math.abs(dy) < 3 && dx < 3) return; // too small to classify yet
        // Horizontal swipe dominates — not a pull gesture
        if (dx > Math.abs(dy)) {
          directionLocked.current = 'horizontal';
          isTouching.current = false;
          return;
        }
        // Downward = pull candidate; upward = normal scroll-up — both abort pull
        directionLocked.current = dy > 0 ? 'pull' : 'scroll';
      }

      // Locked as scroll or horizontal — bail, let the browser handle natively
      if (directionLocked.current !== 'pull') {
        isTouching.current = false;
        setPullDistance(0);
        return;
      }

      if (dy < 0) {
        // Moved upward after starting at top — safety net, reset
        startY.current = null;
        isTouching.current = false;
        isPulling.current = false;
        directionLocked.current = null;
        setPullDistance(0);
        return;
      }

      // Confirmed pull-down gesture — prevent iOS native rubber-band bounce
      // (Must call preventDefault on a non-passive listener)
      if (dy > 5) {
        e.preventDefault();
        isPulling.current = true;
      }

      // Apply resistance so it doesn't feel 1:1 (square root feel like iOS)
      setPullDistance(Math.sqrt(dy) * 6);
    };

    const handleTouchEnd = async () => {
      if (!isTouching.current) return;
      isTouching.current = false;
      startY.current = null;
      startX.current = null;
      isPulling.current = false;
      directionLocked.current = null;

      // Read via ref — avoids stale closure that caused the production build crash
      const currentDistance = pullDistanceRef.current;
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
  }, [enabled, threshold, onRefresh]);

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
