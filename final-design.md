# Alternative names

- deps-bag
- services-bag, svc-bag, s-bag
- injectables-bag, i-bag, injector-bag, nj-bag
- di-bag, dibag

# Design

## 1

```typescript
const injector = dibag.Injector.begin().factories({
  a: () => 123,
  b: ({cache}) => cache.a(),
  c: ({input}) => input.hey
}).end()
injector.resolveOne('c', {hey}).sync().value
injector.resolveAll({hey}).sync().value;
```

## 2

```typescript
const injector = dibag.Injector.begin()
  .deps({
    b: ['a']
  })
  .factories({
    a: () => 123,
    b: ({deps}) => deps.sync.a,
    c: ({input}) => input.hey
  }).end()
injector.resolveOne('c', {hey}).sync().value
injector.resolveAll({hey}).sync().value;
```

## 3

```typescript
const injector = dibag.Injector
  .begin({
    alias: 'injector-hop-hey-lalaley', metadata: {}
  })
  .withFactoryPlugin<FactoryTypePlugin>(factoryPluginInstance) // this allows to return not new SasBox(new ValBox(123)), but just 123
  .injections({
    deps: dibag.DepsInjection.create(), // e.g.    
    customThing: new CustomThing()
  }).factories(() => ({
    a: () => 123,
    b: ({customThing}) => 'hey',
    c: ({self, token}) => `${self.alias}-${token}` // token === 'c'
  }))
  .end()
```

## 3

```typescript
const injector = dibag.Injector
  .begin()
  .opts({
    customThing: new CustomThing(),
  })
  .inject(() => ({ // alternative to .factories
    a: () => SasBox.fromSync(() => ValBox.new(123)),
    b: ({ opts }) => SasBox.fromSync(() => ValBox.new(opts.customThing.getB())),
    c: ({ self, key }) => SasBox.fromSync(() => ValBox.new(`${self.alias}-${key}`)), // self is any
  }))
  .withFactoryPlugin<FactoryTypePlugin>(factoryPluginInstance) // this allows to return not new SasBox(new ValBox(123)), but just 123
  .inject(() => ({
    d: () => 123,
    e: ({ customThing }) => 'hey',
    f: ({ self, key }) => `${self.alias}-${key}`,
  }))
  .withResolverPlugin<ResolverPluginTypesProvider>(resolverPluginInstance) // alternative name - creatorPlugin + injector.create,  getterPlugin + injector.getOne ???
  // Alternative resolution API: getOne -> throws if there is none (alternative name - getOneOrThrow (a la prisma)), 
  // Alternative resolution API: createOne -> creates NEW and returns
  // Alternative resolution API: ensureOne -> if none, creates NEW and returns, if cached, returns cached
  .end();

injector.resolver({ /* ...resolver options */ }).ensureOne('a', {
  input: {},
  opts: {},
});

await injector.resolveOne('b', {
  opts: { customThing: 'hey' },
  input: 'hehehehr',
}); // This interface is defined by .withResolverPlugin
```
