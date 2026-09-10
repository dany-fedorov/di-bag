import { DiBag } from '../src';
const { withLifetime } = DiBag;
export const graph = DiBag.begin().add({
  db: withLifetime(() => ({ query: () => 1 }), 'root'),
  repo: withLifetime(({ db }: { db: { query(): number } }) => db.query(), 'root'),
}).end();
export const reflectedScope = graph.scope;
export const reflectedFork = graph.fork;
export const reflectedEnd = DiBag.begin().add({ value: () => 1 }).end;
export const reflectedStart = DiBag.begin().add({ value: () => 1 }).start;
export function reflectedScopeWrapper() { return graph.scope; }
export function reflectedForkWrapper() { return graph.fork; }
