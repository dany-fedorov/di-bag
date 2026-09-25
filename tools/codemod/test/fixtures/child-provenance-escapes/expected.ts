import { DiBag } from 'di-bag';

const aliasRoot = DiBag.createBuilder().withServices({ config: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();
export const publicAlias = aliasRoot;
export const aliasChild = aliasRoot.createChildContainer(['config'], { config: () => 2 });

const objectRoot = DiBag.createBuilder().withServices({ config: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();
export const holder = { root: objectRoot };
export const objectChild = objectRoot.createChildContainer(['config'], { config: () => 2 });

const arrayRoot = DiBag.createBuilder().withServices({ config: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();
export const containers = [arrayRoot];
export const arrayChild = arrayRoot.createChildContainer(['config'], { config: () => 2 });

const storedRoot = DiBag.createBuilder().withServices({ config: DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'singleton:one-per-container-tree' }) }).buildContainer();
const localAggregate = { storedRoot };
void localAggregate;
export const storedChild = storedRoot.createChildContainer(['config'], { config: () => 2 });
