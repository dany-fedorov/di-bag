import { DiBag } from 'di-bag';

const aliasRoot = DiBag.createBuilder().register({ config: DiBag.withLifetime(() => 1, 'root') }).build();
export const publicAlias = aliasRoot;
export const aliasChild = aliasRoot.createScope(['config'], { config: () => 2 });

const objectRoot = DiBag.createBuilder().register({ config: DiBag.withLifetime(() => 1, 'root') }).build();
export const holder = { root: objectRoot };
export const objectChild = objectRoot.createScope(['config'], { config: () => 2 });

const arrayRoot = DiBag.createBuilder().register({ config: DiBag.withLifetime(() => 1, 'root') }).build();
export const containers = [arrayRoot];
export const arrayChild = arrayRoot.createScope(['config'], { config: () => 2 });

const storedRoot = DiBag.createBuilder().register({ config: DiBag.withLifetime(() => 1, 'root') }).build();
const localAggregate = { storedRoot };
void localAggregate;
export const storedChild = storedRoot.createScope(['config'], { config: () => 2 });
