/**
 * Semaphore for limiting concurrent operations
 * Useful for rate limiting API calls or resource-intensive tasks
 */
export class Semaphore {
  private maxConcurrent: number;
  private currentCount: number;
  private queue: Array<() => void>;

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
    this.currentCount = 0;
    this.queue = [];
  }

  /**
   * Acquire a slot, waiting if necessary
   */
  async acquire(): Promise<void> {
    if (this.currentCount < this.maxConcurrent) {
      this.currentCount++;
      return Promise.resolve();
    }

    // Wait for a slot to become available
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  /**
   * Release a slot, allowing the next queued operation to proceed
   */
  release(): void {
    this.currentCount--;

    if (this.queue.length > 0) {
      this.currentCount++;
      const resolve = this.queue.shift();
      if (resolve) resolve();
    }
  }

  /**
   * Try to acquire a slot without waiting
   * Returns true if acquired, false if limit reached
   */
  tryAcquire(): boolean {
    if (this.currentCount < this.maxConcurrent) {
      this.currentCount++;
      return true;
    }
    return false;
  }

  /**
   * Get current usage stats
   */
  getStats(): { active: number; queued: number; max: number } {
    return {
      active: this.currentCount,
      queued: this.queue.length,
      max: this.maxConcurrent,
    };
  }
}

/**
 * Global semaphore for storybook generation
 * Limits concurrent API calls to Gemini to avoid rate limits
 */
export const storybookGenerationLimiter = new Semaphore(20);
