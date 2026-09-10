/** Structural optional presence; payloads are application-owned and not frozen. */
export type Presence<T> = { readonly present: false } | { readonly present: true; readonly value: T };

/** A readonly tuple indicating whether each acquisition-stage frame is available. */
export type FramePresenceTuple<A extends readonly unknown[]> = {
  readonly [I in keyof A]: Presence<A[I]>;
};

/** A frozen point-in-time view of one acquisition attempt. */
export interface AcquisitionSnapshot<A extends readonly unknown[] = readonly []> {
  /** Stable identity for this attempt; retries receive a new symbol. */
  readonly acquisitionId: symbol;
  /** State at the instant the snapshot was copied. */
  readonly state: 'creating' | 'pending' | 'ready' | 'failed' | 'disposing' | 'disposed';
  /** Ordered presence records for adapter-provided acquisition metadata. */
  readonly metadata: FramePresenceTuple<A>;
}

/** A frozen registration description and copied acquisition state returned by bag inspection. */
export interface InspectionSnapshot<M = Readonly<{}>, A extends readonly unknown[] = readonly []> {
  /** Stable identity for the canonical graph binding. */
  readonly bindingId: symbol;
  /** Human-readable binding label. */
  readonly label: string;
  /** Direct lexical target; acquisition snapshots follow the canonical target. */
  readonly alias?: { readonly bindingId: symbol; readonly label: string };
  /** Static registration metadata; application-owned payload values retain their identity. */
  readonly metadata: Readonly<M>;
  /** Point-in-time attempts; inspection does not retain failed-attempt history. */
  readonly acquisitions: readonly AcquisitionSnapshot<A>[];
}
