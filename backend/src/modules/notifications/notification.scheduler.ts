import { Injectable } from '@nestjs/common';

/** Injectable clock. Fake timers replace its timers in tests; abort clears every wait. */
@Injectable()
export class NotificationScheduler {
  wait(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal.aborted) return resolve();
      const finish = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', finish);
        resolve();
      };
      const timer = setTimeout(finish, ms);
      signal.addEventListener('abort', finish, { once: true });
    });
  }
}
