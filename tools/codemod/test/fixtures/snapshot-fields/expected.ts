import type { BindingSnapshot, GraphSnapshot, Presence, RegistrationSnapshot } from 'di-bag';
import type { Captive } from '../node_modules/di-bag/dist/lifetime-types.js';

declare const graph: GraphSnapshot;
declare const binding: BindingSnapshot;
declare const snapshot: RegistrationSnapshot;
declare const captive: Captive;

export const edges = graph.observedEdges.map(edge => edge.consumerBindingId === edge.dependencyBindingId);
export const dependencies = binding.tokenDependencies.map(item => [item.tokenSymbol, item.dependencyKind]);
export const contribution = graph.contributions[0].collectionTokenSymbol;
export const alias = snapshot.aliasTarget?.bindingLabel;
export const bindingFields = [binding.serviceKeys, binding.isOwnedByContainer, binding.bindingLabel];
export const found: Presence<number> = { isPresent: true, value: 1 };
export const edgeLiteral: GraphSnapshot['observedEdges'] = [{ consumerBindingId: Symbol('consumer'), dependencyBindingId: Symbol('dependency') }];
export const captiveSite = captive.singleton;
export const application = { root: 'application', from: 1, to: 2, key: 'user', kind: 'private', token: 'other' };
