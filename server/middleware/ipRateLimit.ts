import { Request, Response, NextFunction } from 'express';
import { IStorage } from '../storage';

export function createIpRateLimitMiddleware(storage: IStorage) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get IP address from request
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

      if (ipAddress === 'unknown') {
        console.warn('Could not determine IP address for rate limiting');
        return res.status(400).json({ 
          error: 'Could not determine your IP address' 
        });
      }

      // Check rate limit
      const rateLimitCheck = await storage.checkIpRateLimit(ipAddress);

      if (!rateLimitCheck.allowed) {
        return res.status(429).json({ 
          error: 'Daily story creation limit reached',
          message: 'You have reached your daily limit of 3 stories. Please try again tomorrow or sign in to create unlimited stories.',
          remaining: 0
        });
      }

      // Store IP address in request for later use
      (req as any).ipAddress = ipAddress;
      (req as any).rateLimitRemaining = rateLimitCheck.remaining;

      next();
    } catch (error) {
      console.error('Error checking IP rate limit:', error);
      return res.status(500).json({ 
        error: 'Failed to check rate limit' 
      });
    }
  };
}
