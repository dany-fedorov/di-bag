// @ts-ignore -- this consumer is copied beside a freshly installed package archive.
import { DiBag } from 'di-bag';
import { automaticAcquisition, portableContract } from './portable/contract.ts';

async function main() {
  const merged: Record<string, unknown> = { ...await portableContract(DiBag), automatic: await automaticAcquisition(DiBag) };
  // The evaluator requires canonical JSON, whose keys are sorted.
  const result = Object.fromEntries(Object.keys(merged).sort().map(key => [key, merged[key]]));
  // @ts-ignore -- Deno supplies import.meta.resolve in the copied ESM consumer.
  const resolvedDiBag = import.meta.resolve('di-bag');
  console.log(JSON.stringify({ lane: 'deno-root', resolvedDiBag, result }));
}

void main();
