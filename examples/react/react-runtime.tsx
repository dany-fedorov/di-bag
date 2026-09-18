import { createContext, useContext, useEffect, useSyncExternalStore, type Context, type ReactNode } from 'react';
import type { Closable, RuntimeOwner, RuntimeStatus } from './runtime-owner';

/** The owner's status as React state; the snapshot is stable until the owner publishes another. */
export function useRuntimeStatus<T extends Closable>(owner: RuntimeOwner<T>): RuntimeStatus<T> {
  return useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
}

/**
 * Keep `identity` selected while the calling component is mounted with it. Selection
 * happens in an effect, never during render, so Strict Mode's setup-cleanup-setup
 * releases the first selection and ends with a fresh one.
 */
export function useSelectedRuntime<T extends Closable>(owner: RuntimeOwner<T>, identity: string): RuntimeStatus<T> {
  useEffect(() => {
    const selection = owner.select(identity);
    return () => { selection.release(); };
  }, [owner, identity]);
  return useRuntimeStatus(owner);
}

/** A Context for one narrow services interface plus the hook that reads it. */
export function createServicesContext<S>(name: string): { Context: Context<S | undefined>; useServices: () => S } {
  const Context = createContext<S | undefined>(undefined);
  return {
    Context,
    useServices: () => {
      const services = useContext(Context);
      if (services === undefined) throw new Error(`${name} are only available below a ready RuntimeProvider`);
      return services;
    },
  };
}

/** Selects `identity` for its lifetime and renders one of three states. One provider per owner. */
export function RuntimeProvider<T extends Closable, S>(props: {
  owner: RuntimeOwner<T>;
  identity: string;
  context: Context<S | undefined>;
  services: (runtime: T) => S;
  starting: ReactNode;
  failed: (error: unknown, retry: () => void) => ReactNode;
  children: ReactNode;
}): ReactNode {
  const status = useSelectedRuntime(props.owner, props.identity);
  if (status.state === 'ready') return <props.context.Provider value={props.services(status.runtime)}>{props.children}</props.context.Provider>;
  if (status.state === 'failed') return props.failed(status.error, () => props.owner.retry());
  return props.starting;
}
