import { DiBag } from '../../../src';

const needed = DiBag.createBuilder().withServices({
  hidden: ({ value }: { value: number }) => value,
}).buildModule({ exportedServiceKeys: [] });
const wrong = DiBag.createBuilder().withServices({ value: () => 'wrong' }).buildModule({ exportedServiceKeys: ['value'] });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([needed]).withInstalledModules([wrong]);
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withInstalledModules([wrong]).withInstalledModules([needed]);
// diagnostic: required service registrations are missing
DiBag.createBuilder().withInstalledModules([needed]).buildContainer();

const key = Symbol('value');
const narrow = DiBag.token(key).of<number>();
const wide = DiBag.token(key).of<number | string>();
const needsWide = DiBag.createBuilder().withServices({
  hidden: DiBag.fromFunction([wide], value => value),
}).buildModule({ exportedServiceKeys: [] });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withTokenService(narrow, () => 1).withInstalledModules([needsWide]);
const optionallyNeedsWide = DiBag.createBuilder().withServices({
  hidden: DiBag.fromFunction([DiBag.optional(wide)], value => value ?? 0),
}).buildModule({ exportedServiceKeys: [] });
// diagnostic: provided service does not satisfy its consumer dependency
DiBag.createBuilder().withTokenService(narrow, () => 1).withInstalledModules([optionallyNeedsWide]);
