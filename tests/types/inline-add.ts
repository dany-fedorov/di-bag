import { DiBag } from '../../src';
import type { Assert, Equal } from './assert';

// Forward dependencies and nested methods must not widen the registration map.
const bag = DiBag.createBuilder().withServices({
    service: ({ clock }: { clock: { now(): number } }) => ({
      stamp() {
        return clock.now();
      },
      async label() {
        return 'ready' as const;
      },
    }),
  }).withServices({
    clock: () => ({
      now() {
        return 42;
      },
    }),
  }).buildContainer();

const service = bag.resolve('service');
const clock = bag.resolve('clock');
type Service = Assert<
  Equal<
    typeof service,
    {
      stamp(): number;
      label(): Promise<'ready'>;
    }
  >
>;
type Clock = Assert<Equal<typeof clock, { now(): number }>>;

// Factories declared as methods and returned methods using `this` also work.
const stateful = DiBag.createBuilder().withServices({
    counter() {
      return {
        value: 0,
        increment() {
          return ++this.value;
        },
      };
    },
  }).buildContainer().resolve('counter');
type Counter = Assert<
  Equal<
    typeof stateful,
    {
      value: number;
      increment(): number;
    }
  >
>;
