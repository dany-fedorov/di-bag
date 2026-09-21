/** Append/concat nodes contain no version-specific materialization cache. */
export type Sequence<T> = {
    readonly values: readonly T[];
} | {
    readonly left: Sequence<T>;
    readonly right: Sequence<T>;
};
export declare function append<T>(previous: Sequence<T> | undefined, next: Sequence<T>): Sequence<T>;
export declare function materialize<T>(sequence: Sequence<T>): readonly T[];
