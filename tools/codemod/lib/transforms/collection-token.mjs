import { creationUse, locate } from './collection-tokens.mjs';

export default function collectionToken(call, api) {
  const callee = call.expression;
  const use = creationUse(api, call);
  if (use.state === 'collection' || use.state === 'single') {
    return api.assemble(call, [{
      start: api.start(callee.name),
      end: callee.name.end,
      text: api.nameForRole(use.state),
    }]);
  }
  if (use.state === 'mixed') {
    api.manual(call, `${use.name} is used as a collection and as a single service (${locate(use.otherUse)}); create a second token with ${api.nameForRole('collection')} and keep the single token with ${api.nameForRole('single')}`);
  } else {
    api.manual(call, `token creation is not bound to a traceable program variable; choose ${api.nameForRole('single')} or ${api.nameForRole('collection')} by hand`);
  }
  // The kind stays manual; independently resolved children can still migrate.
  return api.assemble(call, []);
}
