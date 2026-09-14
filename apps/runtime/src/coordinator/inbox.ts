/**
 * 단일 writer queue. 한 번에 메시지 하나만 처리한다.
 */
import type { InboxMessage } from "./types.js";

export interface InboxHandle {
  readonly enqueue: (message: InboxMessage) => Promise<unknown>;
  readonly setHandler: (
    handler: (message: InboxMessage) => Promise<unknown>,
  ) => void;
  readonly waitIdle: () => Promise<void>;
}

export const createInbox = (): InboxHandle => {
  const queue: {
    message: InboxMessage;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }[] = [];
  let busy = false;
  let handler: ((message: InboxMessage) => Promise<unknown>) | undefined;
  let idleWaiters: (() => void)[] = [];

  const notifyIdle = (): void => {
    if (busy || queue.length > 0) {
      return;
    }
    const waiters = idleWaiters;
    idleWaiters = [];
    for (const waiter of waiters) {
      waiter();
    }
  };

  const drain = async (): Promise<void> => {
    if (busy || !handler) {
      return;
    }
    busy = true;
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) {
        break;
      }
      try {
        item.resolve(await handler(item.message));
      } catch (error) {
        item.reject(error);
      }
    }
    busy = false;
    notifyIdle();
  };

  return {
    setHandler: (next) => {
      handler = next;
      void drain();
    },
    enqueue: (message) =>
      new Promise((resolve, reject) => {
        queue.push({ message, resolve, reject });
        void drain();
      }),
    waitIdle: () => {
      if (!busy && queue.length === 0) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        idleWaiters.push(resolve);
      });
    },
  };
};
