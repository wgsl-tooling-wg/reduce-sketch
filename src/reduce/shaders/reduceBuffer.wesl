import super::builtins;
import super::reduceWorkgroup::{workgroupReduce, BinOp} with {workgroupSize, subgroupMinSize};

// override consts and override fns can be filled in by host code (or importer)
override const workgroupSize: u32 = 256;         // threads per workgroup
override const elementsPerThread: u32 = 4;       // elements processed per thread
override const subgroupMinSize: u32 = 32;        // minimum subgroup size

override fn mapFn<I, D>(value: I) -> D {         // caller can inject a mapFn
  return value; // identity mapping by default
}

override fn binOp: BinOp<D>;                     // caller injects the binary operation

@group(0) @binding(1) var<storage, read> inBuffer: array<I>; 
@group(0) @binding(2) var<storage, read_write> outBuffer: array<D>; 

@compute
@workgroup_size(workgroupSize)
fn reduceBuffer<D>(
   builtinsUniform: builtins::Uniform,
   builtinsNonuniform: builtins::Nonuniform) {

  let wgId = builtinsUniform.wgid.x;                // workgroup ID
  let lidx = builtinsNonuniform.lidx;               // local thread index
  let tileSize = workgroupSize * elementsPerThread; // number of elements processed by each workgroup
  let tileStart = wgId * tileSize;                  // start index for this workgroup's tile
  
  // Phase 1: Each thread loads and reduces elementsPerThread elements
  var threadSum = binOp.identity;
  let threadStart = tileStart + lidx * elementsPerThread;
  
  for (var i = 0u; i < elementsPerThread; i++) {
    let idx = threadStart + i;
    if (idx < arrayLength(inBuffer)) {
      let rawValue = inBuffer[idx];
      let value = mapFn(rawValue);
      threadSum = binOp.subgroupBinOp(threadSum, value);
    }
  }
  
  // Phase 2: Reduce within workgroup
  let wgResult = workgroupReduce(threadSum, binOp, builtinsUniform, builtinsNonuniform);
  
  // Phase 3: First thread writes workgroup result
  if (lidx == 0u) {
    outBuffer[wgId] = wgResult;
  }
}