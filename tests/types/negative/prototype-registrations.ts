import { DiBag } from '../../../src';
// diagnostic: not assignable
class Factories {
  value() {
    return 42;
  }
}
DiBag.createBuilder().register(new Factories()).build().resolve('value');
