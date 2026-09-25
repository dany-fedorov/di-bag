type Coded = { code?: string };

export function classify(error: Coded): string {
  if (error.code === 'DI_BAG_CYCLE') return "DI_BAG_CYCLE";
  if (error.code === 'DI_BAG_INVALID_SCOPE') return 'scope';
  if (/DI_BAG_CYCLE: alias cycle/.test(String(error))) return `DI_BAG_CYCLE`;
  // DI_BAG_CYCLE in a comment is reported, not rewritten.
  return 'DI_BAG_CYCLES_ARE_NOT_A_CODE';
}
