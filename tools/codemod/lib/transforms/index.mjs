// tools/codemod/lib/transforms/index.mjs
import buildAndStart from './build-and-start.mjs';
import collectionRead from './collection-read.mjs';
import collectionReference from './collection-reference.mjs';
import collectionToken from './collection-token.mjs';
import containerDerivation from './container-derivation.mjs';
import providerFacades from './provider-facades.mjs';
import providerSources from './provider-sources.mjs';

/** Custom transforms by id. Each transform returns a whole rewritten call or reports and gives up. */
export const transforms = {
  'build-and-start': buildAndStart,
  'collection-read': collectionRead,
  'collection-reference': collectionReference,
  'collection-token': collectionToken,
  'container-derivation': containerDerivation,
  'provider-facades': providerFacades,
  'provider-sources': providerSources,
};
