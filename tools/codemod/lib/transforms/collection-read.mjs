import { locate, tokenUse } from './collection-tokens.mjs';

export default function collectionRead(call, api) {
  const callee = call.expression;
  const target = api.nameOf(api.member.owner, api.member.name);
  const use = tokenUse(api, call.arguments[0]);
  if (use.state === 'collection') {
    return api.assemble(call, [{ start: api.start(callee.name), end: callee.name.end, text: target }]);
  }
  api.manual(call, use.state === 'mixed'
    ? `${use.name} is also used as a single service (${locate(use.otherUse)}); split it into two tokens, then write ${target}(token) here`
    : `${api.member.name} is removed; create this token as a collection token, then write ${target}(token) here`);
  return undefined;
}
