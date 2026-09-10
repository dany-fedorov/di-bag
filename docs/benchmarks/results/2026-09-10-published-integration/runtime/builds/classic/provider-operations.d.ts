import type { ArgumentReference } from './dependency-references';
import type { Factory } from './registration';
import type { AcquisitionMode } from './acquisition-mode';
import type { LifetimePolicy } from './lifetime';
interface SourceOperation {
    readonly kind: 'source';
    readonly create: Factory;
    readonly acquisition: AcquisitionMode;
    readonly tokenKeys: readonly symbol[];
    readonly references: readonly ArgumentReference[];
    readonly contextual: boolean;
    readonly dispose?: (value: never) => void | Promise<void>;
}
interface MetadataOperation {
    readonly kind: 'metadata';
    readonly metadata: Readonly<object>;
}
export interface OwnedOperation {
    readonly kind: 'owned';
    readonly dispose: (value: never) => void | Promise<void>;
}
interface MapOperation {
    readonly kind: 'map-sync' | 'map-async';
    readonly acquisition: AcquisitionMode;
    readonly project: (this: void, value: never) => unknown;
}
interface FrameOperation {
    readonly kind: 'frame-sync' | 'frame-async';
    readonly acquisition: AcquisitionMode;
    readonly project: (this: void, value: never) => {
        readonly value: unknown;
        readonly frame: unknown;
    };
}
export type ProviderOperation = MetadataOperation | OwnedOperation | MapOperation | FrameOperation;
export interface ProviderDescription {
    readonly lifetime: LifetimePolicy;
    readonly alias?: string | symbol;
    readonly source: SourceOperation;
    readonly operations: readonly ProviderOperation[];
    readonly metadata: Readonly<object>;
}
export declare function sourceDescription(create: Factory, dispose?: (value: never) => void | Promise<void>, tokenKeys?: readonly symbol[], acquisition?: AcquisitionMode, contextual?: boolean, references?: readonly ArgumentReference[]): ProviderDescription;
/** One registry authenticates both ownership handles and transformed providers. */
export declare function retainDescription(handle: object, description: ProviderDescription): void;
export declare function describe(registration: unknown): ProviderDescription;
export declare function normalize(registration: unknown): {
    lifetime: LifetimePolicy;
    alias?: string | symbol;
    create: Factory;
    acquisition: AcquisitionMode;
    tokenKeys: readonly symbol[];
    references: readonly ArgumentReference[];
    contextual: boolean;
    dispose?: (value: never) => void | Promise<void>;
    metadata: Readonly<object>;
    operations: readonly ProviderOperation[];
};
export {};
