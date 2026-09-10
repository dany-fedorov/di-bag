interface Chain { add(value: object): Chain; replace(key: string, value: unknown): Chain; end(): { resolve(key: string): number }; }
export declare class DiBag { static begin(): Chain; }
