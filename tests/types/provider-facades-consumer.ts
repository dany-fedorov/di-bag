import type { ProviderOutput } from '../../src';
import { decorated } from './provider-facades.js';
import type { Assert, Equal } from './assert';
type _ConsumedOutput = Assert<Equal<Awaited<ProviderOutput<typeof decorated>>, number>>;
