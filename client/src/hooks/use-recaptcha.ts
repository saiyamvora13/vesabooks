import { useEffect, useState } from 'react';

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

export function useRecaptcha() {
  const [isReady, setIsReady] = useState(false);
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  // Only allow bypass in development mode to prevent accidental production usage
  const devBypass = import.meta.env.MODE === 'development' && import.meta.env.VITE_DEV_RECAPTCHA_BYPASS === 'true';

  useEffect(() => {
    // Skip reCAPTCHA loading in development bypass mode
    if (devBypass) {
      setIsReady(true);
      console.log('[DEV] reCAPTCHA bypass enabled - skipping script load');
      return;
    }

    if (!siteKey) {
      console.error('VITE_RECAPTCHA_SITE_KEY is not configured');
      return;
    }

    // Load reCAPTCHA script
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      window.grecaptcha?.ready(() => {
        setIsReady(true);
      });
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      const existingScript = document.querySelector(`script[src*="recaptcha"]`);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [siteKey, devBypass]);

  const executeRecaptcha = async (action: string = 'submit'): Promise<string | null> => {
    // Return mock token in development bypass mode
    if (devBypass) {
      console.log('[DEV] reCAPTCHA bypass enabled - returning mock token');
      return 'dev-bypass-token';
    }

    if (!siteKey) {
      console.error('VITE_RECAPTCHA_SITE_KEY is not configured');
      return null;
    }

    if (!isReady) {
      console.warn('reCAPTCHA not ready yet');
      return null;
    }

    try {
      const token = await window.grecaptcha.execute(siteKey, { action });
      return token;
    } catch (error) {
      console.error('Failed to execute reCAPTCHA:', error);
      return null;
    }
  };

  return { isReady, executeRecaptcha };
}
