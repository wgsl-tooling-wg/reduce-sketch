/** binary operation for reductions */
struct BinOp<T> {
  @if(SUBGROUPS) subgroupReduceOp: (a: T, b: T) -> T;
  @else reduceOp: (a: T, b: T) -> T;

  identity: T;
}

/* 
  binary operation to sum floating point values
  - wesl programmers could pass this as a parameter to `workgroupReduce`
  - typescript programmers could import this from a WESL file and pass it `ReduceBuffer`
*/
const sumF32 = BinOp<f32>(
  @if(SUBGROUPS) subgroupReduceOp: subgroupAdd,
  @else reduceOp: sum,
  identity: 0.0
);

function sum<T>(a: T, b: T) -> T {
  return a + b;
}


/** TODO
  - binary operations that aren't subgroup operations (histogram merge, 64-bit min, etc.)
*/