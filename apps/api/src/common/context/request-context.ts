import { AsyncLocalStorage } from 'async_hooks';

type RequestStore = {
  requestId: string;
  userId?: string;
};

const als = new AsyncLocalStorage<RequestStore>();

export const RequestContext = {
  run<T>(store: RequestStore, callback: () => T): T {
    return als.run(store, callback);
  },
  get(): RequestStore | undefined {
    return als.getStore();
  },
  setUserId(userId: string) {
    const store = als.getStore();
    if (store) store.userId = userId;
  },
};
