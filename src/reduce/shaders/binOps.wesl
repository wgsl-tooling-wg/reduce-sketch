/** Type for binary operations, e.g., for reduce */
struct BinOp<T> {
  @if(SUBGROUPS) subgroupBinOp: (a: T, b: T) -> T;
  @else binOps: (a: T, b: T) -> T;

  identity: T;
}

/* 
  Binary operation to sum floating point values
  - WESL programmers could pass this as a parameter to `workgroupReduce`
  - TypeScript programmers could import this from a WESL file and pass it to `ReduceBuffer`
*/
const sumF32 = BinOp<f32>(
  @if(SUBGROUPS) subgroupAdd,
  @else sum,
  0.0
);

function sum<T>(a: T, b: T) -> T {
  return a + b;
}


/** TODO
  - Consider binary operations that aren't subgroup operations (histogram merge, 64-bit min, etc.)
  - Consider whether host code can inject generic parameters
  - Consider defining conditions in WESL. 
*/