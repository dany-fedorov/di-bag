import type { RuntimeScenario, RuntimeWorkResult } from '../../scripts/performance-evidence.ts';

type Registration = unknown;
type RuntimeBag = {
  resolve(name: string): unknown;
  scope(): RuntimeBag;
  close(): Promise<void>;
};
type RuntimeBuilder = {
  add(bindings: Record<string, Registration>): RuntimeBuilder;
  end(): RuntimeBag;
};
type RuntimeFacade = {
  begin(): RuntimeBuilder;
  factory(create: (dependencies: Record<string, unknown>) => unknown, options?: { acquisition: 'raw' | 'native' }): Registration;
  withDisposal(registration: Registration, dispose: (value: unknown) => void | Promise<void>): Registration;
  withLifetime(registration: Registration, lifetime: 'root' | 'scoped' | 'transient'): Registration;
};

export type PreparedRuntimeScenario = {
  readonly id: object;
  readonly scenario: RuntimeScenario;
  readonly providers: 10 | 100;
  readonly facade: RuntimeFacade;
  readonly bindings: Record<string, Registration>;
  readonly cleanupLog: string[];
  readonly values: object[];
  factories: number;
  disposers: number;
  bag?: RuntimeBag;
  primedValue?: unknown;
  rawPromise?: Promise<object>;
  nativePromise?: Promise<object>;
  nativeValue?: object;
  disposedValue?: unknown;
};

export type TimedRuntimeScenario = {
  readonly preparedId: object;
  readonly value?: unknown;
  readonly values: readonly object[];
};

function checkedProviders(providers: number): 10 | 100 {
  if (providers !== 10 && providers !== 100) throw new Error('runtime providers must be 10 or 100');
  return providers;
}

function linearBindings(prepared: PreparedRuntimeScenario, lifetime?: 'root'): Record<string, Registration> {
  const bindings: Record<string, Registration> = Object.create(null);
  for (let index = 0; index < prepared.providers; index += 1) {
    const previous = `provider${index - 1}`;
    const factory = prepared.facade.factory((dependencies: Record<string, unknown>) => {
      prepared.factories += 1;
      return index === 0 ? 1 : Number(dependencies[previous]) + 1;
    }, { acquisition: 'raw' });
    bindings[`provider${index}`] = lifetime === undefined
      ? factory
      : prepared.facade.withLifetime(factory, lifetime);
  }
  return bindings;
}

function terminal(prepared: PreparedRuntimeScenario): string {
  return `provider${prepared.providers - 1}`;
}

export function expectedScenarioResult(scenario: RuntimeScenario, providers: number): RuntimeWorkResult {
  const count = checkedProviders(providers);
  switch (scenario) {
    case 'build-close': return { checksum: `build-${count}`, factories: 0, disposers: 0, cleanupLog: [] };
    case 'cold-linear-resolve': return { checksum: `cold-${count}`, factories: count, disposers: 0, cleanupLog: [] };
    case 'warm-root-resolve': return { checksum: `warm-${count}`, factories: count, disposers: 0, cleanupLog: [] };
    case 'scope-resolve-close': return {
      checksum: `scope-${count}`, factories: count + 3, disposers: 3,
      cleanupLog: ['transient-2', 'transient-1', 'scoped'],
    };
    case 'transient-resolve-close': return {
      checksum: `transient-${count}`, factories: count, disposers: count,
      cleanupLog: Array.from({ length: count }, (_, index) => `transient-${count - index}`),
    };
    case 'raw-promise-identity': return { checksum: `raw-promise-${count}`, factories: 1, disposers: 1, cleanupLog: ['raw-promise'] };
    case 'node-native-promise': return { checksum: `node-native-${count}`, factories: 1, disposers: 1, cleanupLog: ['node-native'] };
  }
}

export async function prepareScenario(
  scenario: RuntimeScenario,
  providers: number,
  suppliedFacade: unknown,
): Promise<PreparedRuntimeScenario> {
  const count = checkedProviders(providers);
  const prepared: PreparedRuntimeScenario = {
    id: Object.freeze({}), scenario, providers: count, facade: suppliedFacade as RuntimeFacade,
    bindings: Object.create(null) as Record<string, Registration>, cleanupLog: [], values: [], factories: 0, disposers: 0,
  };

  if (scenario === 'build-close') {
    Object.assign(prepared.bindings, linearBindings(prepared));
    return prepared;
  }
  if (scenario === 'cold-linear-resolve' || scenario === 'warm-root-resolve') {
    Object.assign(prepared.bindings, linearBindings(prepared, scenario === 'warm-root-resolve' ? 'root' : undefined));
    prepared.bag = prepared.facade.begin().add(prepared.bindings).end();
    if (scenario === 'warm-root-resolve') prepared.primedValue = prepared.bag.resolve(terminal(prepared));
    return prepared;
  }
  if (scenario === 'scope-resolve-close') {
    Object.assign(prepared.bindings, linearBindings(prepared));
    prepared.bindings.scoped = prepared.facade.withDisposal(prepared.facade.factory(() => {
      prepared.factories += 1;
      return { label: 'scoped' };
    }, { acquisition: 'raw' }), () => { prepared.disposers += 1; prepared.cleanupLog.push('scoped'); });
    prepared.bindings.transient = prepared.facade.withLifetime(prepared.facade.withDisposal(prepared.facade.factory(() => {
      prepared.factories += 1;
      const value = { id: prepared.values.length + 1 };
      prepared.values.push(value);
      return value;
    }, { acquisition: 'raw' }), value => {
      prepared.disposers += 1;
      prepared.cleanupLog.push(`transient-${(value as { id: number }).id}`);
    }), 'transient');
    prepared.bag = prepared.facade.begin().add(prepared.bindings).end();
    return prepared;
  }
  if (scenario === 'transient-resolve-close') {
    for (let index = 0; index < count; index += 1) {
      prepared.bindings[`provider${index}`] = prepared.facade.withLifetime(prepared.facade.withDisposal(
        prepared.facade.factory(() => {
          prepared.factories += 1;
          const value = { id: index + 1 };
          prepared.values.push(value);
          return value;
        }, { acquisition: 'raw' }),
        value => { prepared.disposers += 1; prepared.cleanupLog.push(`transient-${(value as { id: number }).id}`); },
      ), 'transient');
    }
    prepared.bag = prepared.facade.begin().add(prepared.bindings).end();
    return prepared;
  }

  for (let index = 0; index < count - 1; index += 1) {
    prepared.bindings[`provider${index}`] = prepared.facade.factory(() => index, { acquisition: 'raw' });
  }
  if (scenario === 'raw-promise-identity') {
    prepared.rawPromise = Promise.resolve(Object.freeze({ kind: 'raw' }));
    prepared.bindings.promise = prepared.facade.withDisposal(
      prepared.facade.factory(() => { prepared.factories += 1; return prepared.rawPromise; }, { acquisition: 'raw' }),
      value => { prepared.disposers += 1; prepared.disposedValue = value; prepared.cleanupLog.push('raw-promise'); },
    );
  } else {
    prepared.nativeValue = Object.freeze({ kind: 'native' });
    prepared.nativePromise = Promise.resolve(prepared.nativeValue);
    prepared.bindings.promise = prepared.facade.withDisposal(
      prepared.facade.factory(() => { prepared.factories += 1; return prepared.nativePromise; }, { acquisition: 'native' }),
      value => { prepared.disposers += 1; prepared.disposedValue = value; prepared.cleanupLog.push('node-native'); },
    );
  }
  prepared.bag = prepared.facade.begin().add(prepared.bindings).end();
  return prepared;
}

export async function runTimed(prepared: PreparedRuntimeScenario): Promise<TimedRuntimeScenario> {
  let value: unknown;
  let values: readonly object[] = [];
  if (prepared.scenario === 'build-close') {
    const bag = prepared.facade.begin().add(prepared.bindings).end();
    await bag.close();
  } else if (prepared.scenario === 'cold-linear-resolve' || prepared.scenario === 'warm-root-resolve') {
    value = prepared.bag!.resolve(terminal(prepared));
  } else if (prepared.scenario === 'scope-resolve-close') {
    const child = prepared.bag!.scope();
    child.resolve(terminal(prepared));
    child.resolve('scoped');
    child.resolve('transient');
    child.resolve('transient');
    values = prepared.values.slice();
    await child.close();
  } else if (prepared.scenario === 'transient-resolve-close') {
    for (let index = 0; index < prepared.providers; index += 1) prepared.bag!.resolve(`provider${index}`);
    values = prepared.values.slice();
    await prepared.bag!.close();
  } else {
    value = prepared.bag!.resolve('promise');
    await prepared.bag!.close();
  }
  return { preparedId: prepared.id, value, values };
}

export function verifyScenario(prepared: PreparedRuntimeScenario, timed: TimedRuntimeScenario): RuntimeWorkResult {
  if (timed.preparedId !== prepared.id) throw new Error('timed result does not belong to prepared scenario');
  const expected = expectedScenarioResult(prepared.scenario, prepared.providers);
  if (prepared.factories !== expected.factories) throw new Error('scenario factory count mismatch');
  if (prepared.disposers !== expected.disposers) throw new Error('scenario disposer count mismatch');
  if (prepared.cleanupLog.length !== expected.cleanupLog.length
    || prepared.cleanupLog.some((entry, index) => entry !== expected.cleanupLog[index])) throw new Error('scenario cleanup log mismatch');
  if (prepared.scenario === 'cold-linear-resolve' || prepared.scenario === 'warm-root-resolve') {
    if (timed.value !== prepared.providers) throw new Error('linear scenario checksum mismatch');
    if (prepared.scenario === 'warm-root-resolve' && timed.value !== prepared.primedValue) throw new Error('warm root identity mismatch');
  }
  if ((prepared.scenario === 'scope-resolve-close' || prepared.scenario === 'transient-resolve-close')
    && new Set(timed.values).size !== timed.values.length) throw new Error('transient scenario identity mismatch');
  if (prepared.scenario === 'raw-promise-identity'
    && (timed.value !== prepared.rawPromise || prepared.disposedValue !== prepared.rawPromise)) throw new Error('raw Promise identity mismatch');
  if (prepared.scenario === 'node-native-promise'
    && (timed.value !== prepared.nativePromise || prepared.disposedValue !== prepared.nativeValue)) throw new Error('native Promise identity mismatch');
  return expected;
}
