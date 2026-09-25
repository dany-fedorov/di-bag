import { DiBag } from '../../../src';

const providers = {
  service: () => ({ read() { return Number(1); }, extra() { return true; } }),
  promised: async () => 7,
};
const root = DiBag.createBuilder().withServices(providers).buildContainer();

// diagnostic: not assignable
root.createIndependentContainer(['service', 'promised'], {
  service: () => ({ read() { return 3; }, extra() { return true; } }),
  promised: async ({service}: {service: {richer(): number}}) => service.richer(),
});

// diagnostic: not assignable
DiBag.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: (value: string) => ({ length: value.length }), callbackReceives: 'exposed-service' });
// diagnostic: not assignable
DiBag.providerWithAcquisitionMetadata({ provider: () => 1, describeAcquisition: function (this: { missing: true }) { return { value: this.missing }; }, callbackReceives: 'exposed-service' });
