import { Request, Response, NextFunction } from 'express';

interface RecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

export async function verifyRecaptcha(req: Request, res: Response, next: NextFunction) {
  try {
    const { recaptchaToken } = req.body;

    // Development bypass mode - skip verification
    if (process.env.DEV_RECAPTCHA_BYPASS === 'true') {
      console.log('[DEV] reCAPTCHA bypass enabled - skipping verification');
      return next();
    }

    if (!recaptchaToken) {
      return res.status(400).json({ 
        error: 'reCAPTCHA token is required' 
      });
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      console.error('RECAPTCHA_SECRET_KEY is not configured');
      return res.status(500).json({ 
        error: 'Server configuration error' 
      });
    }

    // Verify with Google reCAPTCHA API
    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: recaptchaToken,
        remoteip: req.ip || req.socket.remoteAddress || '',
      }),
    });

    const data = await response.json() as RecaptchaResponse;

    if (!data.success) {
      console.error('reCAPTCHA verification failed:', data['error-codes']);
      return res.status(400).json({ 
        error: 'reCAPTCHA verification failed',
        details: data['error-codes']
      });
    }

    // For reCAPTCHA v3, check the score (0.0 to 1.0, higher is more likely human)
    const minScore = 0.5; // Adjust threshold as needed
    if (data.score !== undefined && data.score < minScore) {
      console.warn(`Low reCAPTCHA score: ${data.score} for IP: ${req.ip}`);
      return res.status(400).json({ 
        error: 'Suspicious activity detected. Please try again.' 
      });
    }

    // Verification successful, continue to next middleware
    next();
  } catch (error) {
    console.error('Error verifying reCAPTCHA:', error);
    return res.status(500).json({ 
      error: 'Failed to verify reCAPTCHA' 
    });
  }
}
