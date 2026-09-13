// Lets `node --test` run TypeScript sources that import siblings as `./file.js`.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !/^\.\.?\/.*\.js$/.test(specifier)) throw error;
      return next(specifier.replace(/\.js$/, '.ts'), context);
    }
  },
});
