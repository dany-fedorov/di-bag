import { DiBag } from 'di-bag';

export const escaped = DiBag.fromFactory(() => 1, {
  // @ts-ignore The fixture intentionally exercises map-defined option keys outside the published API.
  'single-key': 'single-old',
  "double-key": "double-old",
  template: `template-old`,
});

export const factoryReference = DiBag.fromFactory;
