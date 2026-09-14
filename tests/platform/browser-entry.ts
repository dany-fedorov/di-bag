// @ts-ignore -- this entry is copied beside a freshly installed package archive.
import { DiBag } from 'di-bag';
import { automaticAcquisition, portableContract } from './portable/contract.ts';

void Promise.all([portableContract(DiBag), automaticAcquisition(DiBag)]).then(([result, automatic]) => {
  postMessage({ lane: 'browser-worker-minified', result: { ...result, automatic } });
});
