import super::{BuiltinsNonuniform, BuiltinsUniform};

/*
    D - elem datatype, either f32, i32, u32
*/

override const workgroupSize: u32;                       // override const filled in by host code or importer
override const subgroupMinSize: u32;

const wgTempSize = 2 * workgroupSize / subgroupMinSize;
var<workgroup> wgTemp: array<D, wgTempSize>;             // type D inferred from usage

struct BinOp<E> {
  subgroupReduceOp: fn(E, E) -> E,                       // function to reduce two elements in a subgroup 
  identity: E                                            // identity element for the reduction 
}

fn workgroupReduce<D, E>(
   in: ptr<storage, array<D>, read>,
   mapFn: fn(D) -> E,                                     // map prior to reduce
   binop: BinOp<E>,
   builtinsUniform: BuiltinsUniform,
   builtinsNonuniform: BuiltinsNonuniform) -> E {

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
  let s_red = binOp.subgroupReduceOp(t_red);
  if (sgid == 0u) {
    wgTemp[sid] = s_red;
  }

  workgroupBarrier();
  var f_red: D = binOp.identity;
  var offset = 0u;
  var top_offset = 0u; 
  let lane_pred = sgid == sgsz - 1u; // predicate for the last lane in the subgroup
  if (sgsz > aligned_size) {
    /* don't enter the loop */
    f_red = wgTemp[lidx + top_offset];
  } else {
    /* step through reduced subgroups */
    for (var j = sgsz; j <= aligned_size; j <<= lane_log) {
      let step = local_spine >> offset;
      let pred = lidx < step;

      /* find the reduced value for this step */
      let value = select(binOp.identity, wgTemp[lidx + top_offset], pred);
      f_red = binOp.subgroupReduceOp(value);

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