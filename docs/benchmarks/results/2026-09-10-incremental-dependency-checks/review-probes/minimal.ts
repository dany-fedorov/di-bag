import { DiBag, type Builder, type Registration } from '../src';

const key = Symbol('service');
const token = DiBag.token(key).of<number>();

export function bindAfterBottomKey<R extends Registration>(
  builder: Builder<{ key: never; registration: R }>,
) {
  return builder.bind(token, () => 1);
}
