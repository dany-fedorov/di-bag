class DiBag_Begin_WithTypes<TTYpes extends Record<string, any>> {
}

class DiBag_Begin {
  addFacs<F extends Record<string, (args: any) => any>>(
    f: F,
  ): DiBag_Begin_WithTypes_WithFacs<TTypes, F> {}
}

class DiBag {
  static begin(): DiBag_Begin {
    return {} as any;
  }
}

const main = () => {};

main();
