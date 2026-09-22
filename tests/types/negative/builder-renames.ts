import { DiBag } from '../../../src/node';

type Clock = { now(): number };
const clockKey = Symbol('clock');
const clock = DiBag.token(clockKey).of<Clock>();
const toolKey = Symbol('tool');
const toolsKey = Symbol('tools');
const tool = DiBag.token(toolKey).of<string>();
const tools = DiBag.token(toolsKey).forCollectionOf<string>();

DiBag.createBuilder().withTokenService(
  clock,
  // diagnostic: token binding output is not assignable to its service
  () => ({ now: () => 'late' }),
);

DiBag.createBuilder().withTokenService(clock, (): Clock => ({ now: () => 1 })).withTokenService(
  // diagnostic: register introduces new names or typed tokens only
  clock,
  (): Clock => ({ now: () => 2 }),
);

DiBag.createBuilder().withTokenService(
  // diagnostic: register requires a single-service token
  tools,
  () => ['wrong channel'],
);

DiBag.createBuilder().withServices({ a: () => 1 }).withServiceAlias({
  aliasKey: 'b',
  // diagnostic: alias requires an existing named target
  targetServiceKey: 'missing',
});

DiBag.createBuilder().withServices({ a: () => 1 }).withServiceAlias({
  // diagnostic: register introduces new names or typed tokens only
  aliasKey: 'a',
  targetServiceKey: 'a',
});

DiBag.createBuilder().withServices({ a: (): readonly string[] => [] }).withServiceAlias({
  // diagnostic: alias destination requires a single-service token
  aliasKey: tools,
  targetServiceKey: 'a',
});

DiBag.createBuilder().withCollectionContribution({
  // diagnostic: contribute requires a collection token
  collectionToken: tool,
  provider: () => 'search',
});

DiBag.createBuilder().withCollectionContribution({
  collectionToken: tools,
  // diagnostic: collection contribution output is not assignable to its item
  provider: () => 42,
});

// Zero-dependency fast path: the diagnostic must land on serviceKey.
DiBag.createBuilder().withServices({ a: () => 1 }).withReplacedService({
  // diagnostic: replace requires one existing singleton string-literal key
  serviceKey: 'missing',
  provider: () => 2,
});

// General replacement path: a dependency-bearing provider cannot use the zero-dependency overload.
DiBag.createBuilder().withServices({ a: () => 1, b: () => 2, consumer: ({ a }: { a: number }) => a }).withReplacedService({
  serviceKey: 'a',
  // diagnostic: consumer dependency
  provider: ({ b }: { b: number }) => 'text',
});

// Two overloads while the 0.4.0 form exists: one line each for now. Task 12 spreads these two over several lines.
// diagnostic: buildModule accepts existing names or typed tokens only
DiBag.createBuilder().withServices({ a: () => 1 }).buildModule({ exportedServiceKeys: ['missing'] });
// diagnostic: is not assignable to type 'string'
DiBag.createBuilder().withServices({ a: () => 1 }).buildModule({ exportedServiceKeys: ['a'], moduleLabel: 1 });
