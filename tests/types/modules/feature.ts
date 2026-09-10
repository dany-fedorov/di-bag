import { DiBag } from '../../../src';
export const feature = DiBag.createModuleBuilder().register({
  privateReader: ({ service }: { service: { read(): number; extra(): boolean } }) => () => service.read(),
  service: ({ logger }: { logger: { log(message: string): void } }) => ({
    read() { logger.log('read'); return 42; }, extra() { return true; },
  }),
  handler: ({ privateReader }: { privateReader(): number }) => ({ run() { return privateReader(); } }),
  promised: async () => 7,
}).buildModule(['service', 'handler', 'promised']);
