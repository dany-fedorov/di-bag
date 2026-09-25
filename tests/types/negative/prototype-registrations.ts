import { DiBag } from '../../../src';
// diagnostic: not assignable
class Factories {
  value() {
    return 42;
  }
}
DiBag.createBuilder().withServices(new Factories()).buildContainer().resolve('value');
