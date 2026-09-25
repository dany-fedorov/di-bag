import type { BindingSnapshot, GraphSnapshot, Presence, RegistrationSnapshot } from 'di-bag';
import type { Captive } from '../node_modules/di-bag/dist/lifetime-types.js';

declare const graph: GraphSnapshot;
declare const binding: BindingSnapshot;
declare const snapshot: RegistrationSnapshot;
declare const captive: Captive;

export const edges = graph.observedEdges.map(edge => edge.from === edge.to);
export const dependencies = binding.tokenDependencies.map(item => [item.key, item.kind]);
export const contribution = graph.contributions[0].token;
export const alias = snapshot.aliasTarget?.label;
export const bindingFields = [binding.keys, binding.owned, binding.label];
export const found: Presence<number> = { present: true, value: 1 };
export const edgeLiteral: GraphSnapshot['observedEdges'] = [{ from: Symbol('consumer'), to: Symbol('dependency') }];
export const captiveSite = captive.root;
export const application = { root: 'application', from: 1, to: 2, key: 'user', kind: 'private', token: 'other' };
