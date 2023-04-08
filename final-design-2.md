# 1. Simplest declaration pattern - no type safety, no deps declaration

```typescript
const bag = DiBag.begin({
  alias: 'Hey',
}).factories({
  a: () => 123,
  b: (args: { self: any }) => {
    return args.self.a({ ...args, token: 'a' }).sync().value;
  },
  c: (args: { cache: any }) => {
    return args.cache.b().sync().value;
  },
});
```

# 2. Declaration pattern with type safety - inference

```typescript
const bag = DiBag.begin({
  alias: 'Hey',
}).factories({
  a: () => 123,
}).factories({
  b: (args: { self: any }) => {
    return args.self.a({ ...args, token: 'b' }).sync().value;
  },
}).factories({
  c: (args) => { // typeof cache === { b: () => ..., a: () => ... }
    return args.cache.b().sync().value;
  },
});
```

# 3. Declaration pattern with type safety - separate type declaration

```typescript
const bag = DiBag.begin({
  alias: 'Hey',
}).withTypeProvider<{
  a: number,
  b: number
}>().factories({
  a: () => 123, // knows that it should be a number
  b: ({ self, cache }) => { // knows correct types of self and cache
    return cache.a().sync().value;
  },
});
```

# 4. Declaration pattern with dependencies declaration

```typescript
const bag = DiBag.begin({
  alias: 'Hey',
}).depsPlugin<TP>(p).deps({
  b: ['a'],
}).factories({
  a: () => 123, // knows that it should be a number
  b: ({ self, cache, deps }) => { // knows correct types of self and cache
    return deps.sync.a.value;
    // return cache.a();
  },
});
```
