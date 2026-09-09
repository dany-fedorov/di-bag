/** Structural optional presence; payloads are application-owned and not frozen. */
export type Presence<T> = { readonly present: false } | { readonly present: true; readonly value: T };

export type FramePresenceTuple<A extends readonly unknown[]> = {
  readonly [I in keyof A]: Presence<A[I]>;
};

export interface AcquisitionSnapshot<A extends readonly unknown[] = readonly []> {
  readonly acquisitionId: symbol;
  readonly state: 'creating' | 'pending' | 'ready' | 'failed' | 'disposing' | 'disposed';
  readonly metadata: FramePresenceTuple<A>;
}

export interface InspectionSnapshot<M = Readonly<{}>, A extends readonly unknown[] = readonly []> {
  readonly bindingId: symbol;
  readonly label: string;
  /** Direct lexical target; acquisition snapshots follow the canonical target. */
  readonly alias?: { readonly bindingId: symbol; readonly label: string };
  readonly metadata: Readonly<M>;
  readonly acquisitions: readonly AcquisitionSnapshot<A>[];
}
