const MiniDi = {};

MiniDi.Container = class MiniDiContainer {
  static new(icfg) {
    new MiniDi.Container(icfg);
  }

  constructor(icfg) {
    this.icfg = icfg;
  }

  resolveAll() {}

  resolveOne() {}

  resolve(pnames) {}
};

// const o = {
//   a: 1,
//   b: ({ sync, async, fn, self }) => sync.a,
// };
//
// MiniDi.Container.new({
//   pmDecorator: {
//     normalize: () => {},
//   },
//   middlewares: [{}],
//   pmInjectors: [
//     {
//       key: 'self',
//       apply: (context, pmInputObject) => {},
//     },
//   ],
// });
//
// module.exports = {
//   MiniDi,
// };
