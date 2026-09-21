import { DiBag } from 'di-bag';

export const escaped = DiBag.createProvider(() => 1, {
  // @ts-ignore The fixture intentionally exercises map-defined option keys outside the published API.
  'key\'\\\n': 'single\'\\\n\t\x01',
  "key\"\\\t": "double\"\\\r\b\f",
  'identifier\'\\\r': `template\`\\\${value}\u2028\u2029`,
});

export const factoryReference = DiBag.fromFactory;
