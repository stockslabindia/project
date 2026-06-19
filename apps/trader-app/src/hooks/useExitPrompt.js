import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function useExitPrompt(logoutCallback) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Only intercept back button if the user is on a root-level page
    const isRootPage = 
      location.pathname === '/' || 
      location.pathname === '/dashboard' || 
      location.pathname === '/markets';
    
    if (!isRootPage) return;

    // Push an exit guard state if it hasn't been pushed yet
    const currentState = window.history.state || {};
    if (!currentState.exitGuard) {
      window.history.pushState({ ...currentState, exitGuard: true }, '', window.location.href);
    }

    const handlePopState = (e) => {
      // The user pressed back, popping our guard state.
      // Confirm if they really want to logout
      if (window.confirm('Do you want to logout and exit the app?')) {
        if (logoutCallback) logoutCallback();
        navigate('/login', { replace: true });
      } else {
        // User canceled, push the guard state back to trap them again
        const curr = window.history.state || {};
        window.history.pushState({ ...curr, exitGuard: true }, '', window.location.href);
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [location.pathname, logoutCallback, navigate]);
}
