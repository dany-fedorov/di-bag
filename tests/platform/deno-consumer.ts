// @ts-ignore -- this consumer is copied beside a freshly installed package archive.
import { DiBag } from 'di-bag';
import { portableContract } from './portable/contract.ts';

async function main() {
  const result = await portableContract(DiBag);
  // @ts-ignore -- Deno supplies import.meta.resolve in the copied ESM consumer.
  const resolvedDiBag = import.meta.resolve('di-bag');
  console.log(JSON.stringify({ lane: 'deno-root', resolvedDiBag, result }));
}

void main();
