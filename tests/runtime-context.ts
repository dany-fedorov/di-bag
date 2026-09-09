import { isPromise } from 'node:util/types';
import { BindingGraph, Runtime as CoreRuntime } from '../src/runtime';

/** Internal graph tests explicitly select the same host boundary as di-bag/node. */
export class Runtime extends CoreRuntime {
  constructor(graph: BindingGraph) { super(graph, { isNativePromise: isPromise }); }
}
