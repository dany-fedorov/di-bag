// tools/codemod/lib/transforms/index.mjs
import buildAndStart from './build-and-start.mjs';
import collectionRead from './collection-read.mjs';
import collectionReference from './collection-reference.mjs';
import collectionToken from './collection-token.mjs';

/** Custom transforms by id. Each transform returns a whole rewritten call or reports and gives up. */
export const transforms = {
  'build-and-start': buildAndStart,
  'collection-read': collectionRead,
  'collection-reference': collectionReference,
  'collection-token': collectionToken,
};
