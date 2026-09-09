// @ts-ignore -- this entry is copied beside a freshly installed package archive.
import { DiBag } from 'di-bag';
import { portableContract } from './portable/contract.ts';

void portableContract(DiBag).then(result => {
  postMessage({ lane: 'browser-worker-minified', result });
});
