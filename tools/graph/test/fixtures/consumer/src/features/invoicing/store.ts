export type InvoiceStore = { save(orderId: string, amountCents: number): string };

export const createStore = (): InvoiceStore => {
  const invoices = new Map<string, number>();
  return {
    save(orderId, amountCents) {
      invoices.set(orderId, amountCents);
      return `invoice:${orderId}`;
    },
  };
};
