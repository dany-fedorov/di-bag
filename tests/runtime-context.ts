import { isPromise } from 'node:util/types';
import { BindingGraph, BagRuntime as CoreRuntime } from '../src/runtime';

/** Internal graph tests explicitly select the same host boundary as di-bag/node. */
export class BagRuntime extends CoreRuntime {
  constructor(graph: BindingGraph) { super(graph, { isNativePromise: isPromise }); }
}
