import { locate, tokenUse } from './collection-tokens.mjs';

export default function collectionReference(call, api) {
  const use = tokenUse(api, call.arguments[0]);
  if (use.state === 'collection' && call.arguments.length === 1) return api.text(call.arguments[0]);
  api.manual(call, use.state === 'mixed'
    ? `${use.name} is also used as a single service (${locate(use.otherUse)}); split it into two tokens, then pass the collection token itself here`
    : `${api.member.name} is removed; create this token as a collection token, then pass the token itself here`);
  return undefined;
}
