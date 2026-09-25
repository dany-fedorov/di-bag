# Clean

DI Bag builds a container with `buildContainer()` from one options bag. Import `di-bag`.
We build the graph once. A service is in scope of nothing; the root container owns it.
See `DI_BAG_DEPENDENCY_CYCLE` and `buildModule({ exportedServiceKeys })`.
The `PluginProvider` type keeps its name.

```ts
// The old vocabulary inside a TypeScript fence is not prose.
const description = 'cleanup in a child scope of a family';
```
