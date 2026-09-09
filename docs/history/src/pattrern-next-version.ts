/**
 * Resolutions:
 * - Try to avoid SasBox. This was a useless idea.
 * - Try to add type condition to handle val boxes. Add symbol for a val-box to handle it in javascript.
 * - Try to avoid tracking sync and async methods separately. Just resolve to promise if factory is async. (Same as iti)
 * - Two ideas for type validation:
 *   - After all .addFacs , do checkTypes<Types>() (Is checkTypes better than validateTypes ? ).
 *     If types do not align, TypeScript will underline the validateTypes method with error.
 *     This is considerably worse than underlining not matching factory, but I don't see another way to do this.
 *   - Before .addFacs do .withTypes<Types>(), this will allow to do ONLY ONE .addFacs call that should conform to this type.
 *     I think if I'm about to implement this pattern, it should come last.
 * - .addParsers handling. Parser argument should map to factories return types. Parsers result overrides the tracked factory method types.
 * - Experiment more with zod:
 *   - .zodParse - applies zod parsers, does not care about current factories types
 *   - .zodCheck - is same as checkTypes
 *   - .zod - does .zodCheck and also does .zodParse in the runtime.
 */
