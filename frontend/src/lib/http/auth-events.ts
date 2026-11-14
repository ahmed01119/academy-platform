/**
 * Tiny pub/sub used by the HTTP layer to tell the AuthProvider about
 * session changes without importing React code.
 */
export type AuthEventType = 'UNAUTHORIZED' | 'REFRESH_SUCCESS' | 'SESSION_EXPIRED';

type AuthEventListener = (event: AuthEventType) => void;

const authEventListeners = new Set<AuthEventListener>();

export function onAuthEvent(listener: AuthEventListener): () => void {
  authEventListeners.add(listener);
  return () => {
    authEventListeners.delete(listener);
  };
}

export function emitAuthEvent(event: AuthEventType): void {
  authEventListeners.forEach((fn) => {
    try {
      fn(event);
    } catch (e) {
      console.error('Error in auth event listener', e);
    }
  });
}
