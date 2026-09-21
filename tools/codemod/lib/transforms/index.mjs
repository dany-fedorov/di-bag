// tools/codemod/lib/transforms/index.mjs
import buildAndStart from './build-and-start.mjs';

/** Custom transforms by id. Each transform returns a whole rewritten call or reports and gives up. */
export const transforms = {
  'build-and-start': buildAndStart,
};
