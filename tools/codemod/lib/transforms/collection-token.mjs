import { creationUse, locate } from './collection-tokens.mjs';

export default function collectionToken(call, api) {
  const callee = call.expression;
  const use = creationUse(api, call);
  if (use.state === 'collection') {
    return api.assemble(call, [{
      start: api.start(callee.name), end: callee.name.end,
      text: api.nameOf(api.member.owner, api.member.name),
    }]);
  }
  if (use.state === 'mixed') {
    api.manual(call, `${use.name} is used as a collection and as a single service (${locate(use.otherUse)}); a 0.5 token is one or the other, so create a second token for the list with ${api.nameOf(api.member.owner, api.member.name)} and move the collection uses to it`);
  }
  if (use.state === 'untraceable') {
    api.manual(call, `token creation cannot be traced to an identifier binding; if it is used as a collection, create a named token with ${api.nameOf(api.member.owner, api.member.name)} and move the collection uses to it`);
  }
  return undefined;
}
