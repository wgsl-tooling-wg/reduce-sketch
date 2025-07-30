import super::builtins;
// Import and fill in our override consts in workgroupReduce with our values
import super::reduceWorkgroup::{workgroupReduce, BinOp} with {workgroupSize, subgroupMinSize}; 

// override consts and override fns can be filled in by host code, or importing shader module
override const workgroupSize: u32 = 256;         // Threads per workgroup
override const elementsPerThread: u32 = 4;       // Elements processed per thread
override const subgroupMinSize: u32 = 32;        // Minimum subgroup size

override fn mapFn<I, D>(value: I) -> D {         // Host can inject a mapFn
  return value; // Identity mapping by default
}

override fn binOp: BinOp<D>;                     // Host must inject the binary operation

@group(0) @binding(1) var<storage, read> inBuffer: array<I>; 
@group(0) @binding(2) var<storage, read_write> outBuffer: array<D>; 

@compute
@workgroup_size(workgroupSize)
fn reduceBuffer<D>(
   builtinsUniform: builtins::Uniform,
   builtinsNonuniform: builtins::Nonuniform) {

  let wgId = builtinsUniform.wgid.x;                // Workgroup ID
  let lidx = builtinsNonuniform.lidx;               // Local thread index
  let tileSize = workgroupSize * elementsPerThread; // Number of elements processed by each workgroup
  let tileStart = wgId * tileSize;                  // Start index for this workgroup's tile
  
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