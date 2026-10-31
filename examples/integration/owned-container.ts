/** Application recipe: acquire a fresh owned container, run work, then close it. */
export async function withOwnedContainer<C extends { close(): Promise<void> }, R>(
  acquire: () => C | Promise<C>,
  work: (container: C) => R,
): Promise<Awaited<R>> {
  const container = await acquire();
  let value: Awaited<R>;
  try {
    value = await work(container);
  } catch (error) {
    try {
      await container.close();
    } catch (disposalError) {
      throw new AggregateError([error, disposalError], 'Work and container disposal both failed');
    }
    throw error;
  }
  await container.close();
  return value;
}
