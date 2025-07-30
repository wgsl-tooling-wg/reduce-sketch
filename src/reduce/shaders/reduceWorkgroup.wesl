import super::builtins;
import super::binOps::BinOp;

/** These must be overridden by host code or importing shader module */
override const workgroupSize: u32;                       
override const subgroupMinSize: u32;

const wgTempSize = 2 * workgroupSize / subgroupMinSize;
var<workgroup> wgTemp<E>: array<E, wgTempSize>;          // workgroup memory for partial results
  
/* adapted from JDO's webgpu-benchmarking library: 
  - called on each thread, returns the reduced value for the workgroup
  
  terminology:
    workgroup - thread block, typically 256 threads:
      - synchronize with a barrier, 
      - share higher speed 'workgroup' memory within the workgroup
      - contains multiple subgroups
    subgroup - SIMD lockstep subset of threads inside the workgroup, typically 32 threads
      - can use built in subgroup operations like subgroupMax
    tile - workgroup sized chunk of data
    lane - thread within a subgroup
    spine - first thread of each subgroup

  generics:
    E - output elem datatype (f32, i32, u32)
*/
@if(SUBGROUPS)
fn workgroupReduce<E>(
   in: E,
   binop: BinOp<E>,
   builtinsUniform: builtins::Uniform,
   builtinsNonuniform: builtins::Nonuniform) -> E {

  let lidx = builtinsNonuniform.lidx;           // local_invocation_index, 1D thread index within workgroup
  let sgsz = builtinsUniform.sgsz;              // subgroup_size, 32 on Apple GPUs
  let sgid = builtinsNonuniform.sgid;           // subgroup_invocation_id, 1D thread index within subgroup

  let BLOCK_DIM: u32 = workgroupSize;
  let sid = lidx / sgsz;                        // index of subgroup within workgroup
  let lane_log = u32(countTrailingZeros(sgsz)); // log_2(sgsz)

  /* workgroup size / subgroup size; how many partial reductions in this tile? */
  let local_spine: u32 = BLOCK_DIM >> lane_log;
  let aligned_size_base = 1u << ((u32(countTrailingZeros(local_spine)) + lane_log - 1u) / lane_log * lane_log);


  /* fix for aligned_size_base == 1 (needed when subgroup_size == BLOCK_DIM) */
  let aligned_size = select(aligned_size_base, BLOCK_DIM, aligned_size_base == 1);

  /* reduce all the root subgroups into wgTemp */
  let t_red = in;
  let s_red = binOp.subgroupBinOp(t_red);
  if (sgid == 0u) {
    wgTemp[sid] = s_red;
  }

  workgroupBarrier();

  /* Now we have one partial reduction per subgroup in wgTemp.
   * We will now hierarchically combine these results into a single value.  */

  var f_red: D = binOp.identity;  // Initialize final reduction result with identity
  var offset = 0u;                // Tracks bit shift amount for calculating step sizes
  var top_offset = 0u;            // Tracks position in wgTemp for reading/writing partial
  results
  let lane_pred = sgid == sgsz - 1u; // True only for the last thread in each subgroup (used 
  for writing)

  if (sgsz > aligned_size) {
    // Special case: subgroup is larger than aligned size, read directly from wgTemp
    /* don't enter the loop */
    f_red = wgTemp[lidx + top_offset];
  } else {
    // Main reduction loop: hierarchically combine subgroup results in parallel
    // j represents the number of threads participating in each iteration
    for (var j = sgsz; j <= aligned_size; j <<= lane_log) {
      let step = local_spine >> offset;  // Number of elements to process in this iteration
      let pred = lidx < step;            // Only first 'step' threads participate

      // Each participating thread reads one partial result from wgTemp
      // Non-participating threads get identity to avoid affecting the reduction
      let value = select(binOp.identity, wgTemp[lidx + top_offset], pred);

      // Perform subgroup reduction on the values (all threads in subgroup participate)
      f_red = binOp.subgroupBinOp(value);

      // Only the last thread of participating subgroups writes the reduced result
      if (pred && lane_pred) {
        wgTemp[sid + step + top_offset] = f_red;
      }
      workgroupBarrier();
      top_offset += step;
      offset += lane_log;
    }
  }

  return f_red;
}