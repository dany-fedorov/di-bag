import { DiBag } from '../../../src';
export const feature = DiBag.module().add({
  privateReader: ({ service }: { service: { read(): number; extra(): boolean } }) => () => service.read(),
  service: ({ logger }: { logger: { log(message: string): void } }) => ({
    read() { logger.log('read'); return 42; }, extra() { return true; },
  }),
  handler: ({ privateReader }: { privateReader(): number }) => ({ run() { return privateReader(); } }),
  promised: async () => 7,
}).exports(['service', 'handler', 'promised']);
