/** Application recipe: acquire a fresh owned bag/scope, run work, then close it. */
export async function withOwnedScope<S extends { close(): Promise<void> }, R>(
  acquire: () => S | Promise<S>,
  work: (scope: S) => R,
): Promise<Awaited<R>> {
  const scope = await acquire();
  let value: Awaited<R>;
  try {
    value = await work(scope);
  } catch (error) {
    try {
      await scope.close();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Work and scope cleanup both failed');
    }
    throw error;
  }
  await scope.close();
  return value;
}
