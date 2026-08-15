import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/infrastructure/supabase/client';
import { privateQueryKeys } from '../../application/query/privateQueryKeys';
import { clearPrivateSessionState } from '../../application/services/privateSessionState';

interface PrivateSessionContextValue {
  authUserId: string | null;
  isTransitioning: boolean;
  transitionTo: (authUserId: string | null) => Promise<void>;
}

const PrivateSessionContext = createContext<PrivateSessionContextValue | null>(null);

export function PrivateSessionBoundary({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState({ authUserId: null as string | null, isTransitioning: true });
  const activeUserIdRef = useRef<string | null>(null);
  const hasEstablishedSessionRef = useRef(false);
  const transitionTargetRef = useRef<string | null | undefined>(undefined);
  const transitionPromiseRef = useRef<Promise<void> | null>(null);
  const generationRef = useRef(0);

  const transitionTo = useCallback((nextUserId: string | null): Promise<void> => {
    if (transitionTargetRef.current === nextUserId && transitionPromiseRef.current) {
      return transitionPromiseRef.current;
    }

    if (
      hasEstablishedSessionRef.current
      && activeUserIdRef.current === nextUserId
      && !transitionPromiseRef.current
    ) {
      setState({ authUserId: nextUserId, isTransitioning: false });
      return Promise.resolve();
    }

    const generation = ++generationRef.current;
    transitionTargetRef.current = nextUserId;
    setState({ authUserId: null, isTransitioning: true });

    const transition = clearPrivateSessionState(queryClient, window.localStorage)
      .then(() => {
        if (generation !== generationRef.current) return;
        activeUserIdRef.current = nextUserId;
        hasEstablishedSessionRef.current = true;
        setState({ authUserId: nextUserId, isTransitioning: false });
      })
      .finally(() => {
        if (generation === generationRef.current) {
          transitionPromiseRef.current = null;
          transitionTargetRef.current = undefined;
        }
      });

    transitionPromiseRef.current = transition;
    return transition;
  }, [queryClient]);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return;
      void transitionTo(error ? null : data.user?.id ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      const nextUserId = session?.user?.id ?? null;
      if (event === 'SIGNED_OUT' || !nextUserId) {
        void transitionTo(null);
        return;
      }

      if (nextUserId !== activeUserIdRef.current) {
        void transitionTo(nextUserId);
        return;
      }

      if (event === 'USER_UPDATED') {
        void queryClient.invalidateQueries({ queryKey: privateQueryKeys.identity(nextUserId) });
      }
    });

    return () => {
      mounted = false;
      generationRef.current += 1;
      authListener.subscription.unsubscribe();
    };
  }, [queryClient, transitionTo]);

  const value = useMemo<PrivateSessionContextValue>(() => ({
    ...state,
    transitionTo,
  }), [state, transitionTo]);

  const sessionKey = state.isTransitioning
    ? 'session-transition'
    : state.authUserId || 'signed-out';

  return (
    <PrivateSessionContext.Provider value={value}>
      <Fragment key={sessionKey}>{children}</Fragment>
    </PrivateSessionContext.Provider>
  );
}

export function usePrivateSession() {
  const context = useContext(PrivateSessionContext);
  if (!context) throw new Error('PRIVATE_SESSION_BOUNDARY_MISSING');
  return context;
}
