import { result, token, tokenGraph } from './incremental-modules';
import type { Assert, Equal } from './assert';

const resolved = tokenGraph.resolve(token);
type Exact = [
  Assert<Equal<typeof result, number>>,
  Assert<Equal<typeof resolved, number>>,
];

