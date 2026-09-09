import { DiBag } from '../../../src';
// diagnostic: not assignable
class Factories {
  value() {
    return 42;
  }
}
DiBag.begin().add(new Factories()).end().resolve('value');
