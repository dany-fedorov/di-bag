export type Stock = { take(sku: string, quantity: number): boolean };

export const createStock = (): Stock => {
  const quantities = new Map([['coffee', 4]]);
  return {
    take(sku, quantity) {
      const available = quantities.get(sku) ?? 0;
      if (quantity <= 0 || quantity > available) return false;
      quantities.set(sku, available - quantity);
      return true;
    },
  };
};
