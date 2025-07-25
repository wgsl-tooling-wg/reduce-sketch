/**
 * Configuration for the workgroupReduce WGSL function generator.
 */
export interface WorkgroupReduceConfig {
  /**
   * The binary operation to use for the reduction.
   */
  binop: {
    /**
     * The identity value for the operation (e.g., "0.0" for float addition, "0u" for unsigned int addition).
     * This should be a valid WGSL literal for the given datatype.
     */
    identity: string;
    /**
     * The name of the WGSL subgroup reduction function (e.g., "subgroupAdd", "subgroupMin").
     */
    subgroupReduceOp: string;
    /**
     * An optional string representation of the binary operation, used for generating unique function names.
     * If not provided, a default will be used.
     */
    name?: string;
  };
  /**
   * The data type of the elements being reduced (e.g., "u32", "f32").
   */
  datatype: string;
  /**
   * The number of threads in the workgroup.
   */
  workgroupSize: number;
  /**
   * The minimum subgroup size to assume for allocating workgroup memory.
   * This affects the size of the temporary storage array.
   */
  subgroupMinSize: number;
  /**
   * If true, the generated function will expect a pointer to a workgroup-scoped
   * temporary buffer to be passed as an argument. If false (default), the function
   * will declare its own local `var<workgroup>` for temporary storage.
   */
  wgTempIsArgument?: boolean;
  /**
   * If true, generates a longer, configuration-specific function name to avoid
   * collisions when multiple reductions with different configurations are in the same module.
   * If false (default), uses the `customFnName`.
   */
  useLongFunctionName?: boolean;
  /**
   * The base name for the generated WGSL function. Defaults to "wgReduce".
   */
  customFnName?: string;
}

/**
 * Generates a WGSL function string for an efficient, subgroup-based workgroup reduction.
 *
 * This function implements a two-level reduction strategy:
 * 1.  **Subgroup Reduction:** Each subgroup computes a partial reduction.
 * 2.  **Workgroup-Shared Memory Reduction:** A single subgroup performs a final
 *     reduction on the partial results from all subgroups.
 *
 * @param config The configuration object for the reduction function.
 * @returns A string containing the generated WGSL function.
 */
export function workgroupReduce(config: WorkgroupReduceConfig): string {
  const {
    binop,
    datatype,
    workgroupSize,
    subgroupMinSize,
    wgTempIsArgument = false,
    useLongFunctionName = false,
    customFnName = "wgReduce",
  } = config;

  const shortFnName = customFnName;
  const configString = [
    binop.name ?? "binop",
    datatype,
    workgroupSize,
    subgroupMinSize,
  ].join("_");

  const wgTemp = wgTempIsArgument ? "wgTemp" : `wg_temp_${configString}`;
  const declareAndUseLocalWgTemp = !wgTempIsArgument;
  const longFnName = `${shortFnName}_${configString}`;
  const fnName = useLongFunctionName ? longFnName : shortFnName;

  const fn = /* wgsl */ `
${
  declareAndUseLocalWgTemp
    ? `const TEMP_${longFnName}_MEM_SIZE = 2 * ${workgroupSize} / ${subgroupMinSize};
var<workgroup> ${wgTemp}: array<${datatype}, TEMP_${longFnName}_MEM_SIZE>;`
    : ""
}

/**
 * Performs a reduction operation across all threads in a workgroup.
 * This version is optimized for hardware with subgroup support.
 */
fn ${fnName}(
  in_val: ${datatype},
  ${
    declareAndUseLocalWgTemp
      ? ""
      : `wgTemp: ptr<workgroup, array<${datatype}>>,`
  }
  builtinsUniform: BuiltinsUniform,
  builtinsNonuniform: BuiltinsNonuniform
) -> ${datatype} {
  let lidx = builtinsNonuniform.lidx;
  let sgsz = builtinsUniform.sgsz;
  let sgid = builtinsNonuniform.sgid;
  let BLOCK_DIM: u32 = ${workgroupSize};
  let sid = lidx / sgsz;
  let lane_log = u32(countTrailingZeros(sgsz)); // log_2(sgsz)
  // Number of subgroups in the workgroup
  let local_spine: u32 = BLOCK_DIM >> lane_log;
  let aligned_size_base = 1u << ((u32(countTrailingZeros(local_spine)) + lane_log - 1u) / lane_log * lane_log);
  // Fix for aligned_size_base == 1 (needed when subgroup_size == BLOCK_DIM)
  let aligned_size = select(aligned_size_base, BLOCK_DIM, aligned_size_base == 1);

  // 1. Each thread contributes its value to a subgroup-level reduction.
  let t_red = in_val;
  let s_red = ${binop.subgroupReduceOp}(t_red);

  // 2. The first thread in each subgroup writes the partial result to workgroup memory.
  if (sgid == 0u) {
    (*${wgTemp})[sid] = s_red;
  }
  workgroupBarrier();

  // 3. A single subgroup reduces the partial results from workgroup memory.
  var f_red: ${datatype} = ${binop.identity};

  var offset = 0u;
  var top_offset = 0u;
  let lane_pred = sgid == sgsz - 1u;
  if (sgsz > aligned_size) {
    // This path is taken when the number of active threads in the final reduction
    // step is less than the subgroup size.
    f_red = (*${wgTemp})[lidx + top_offset];
  } else {
    // Iteratively reduce the partial sums in workgroup memory.
    for (var j = sgsz; j <= aligned_size; j <<= lane_log) {
      let step = local_spine >> offset;
      let pred = lidx < step;
      // Threads participate in the reduction based on their local index.
      // Inactive threads contribute the identity value.
      f_red = ${binop.subgroupReduceOp}(
        select(${binop.identity},
        (*${wgTemp})[lidx + top_offset],
        pred)
      );
      // The last lane in the subgroup writes the new partial sum for the next iteration.
      if (pred && lane_pred) {
        (*${wgTemp})[sid + step + top_offset] = f_red;
      }
      workgroupBarrier();
      top_offset += step;
      offset += lane_log;
    }
  }
  return f_red;
}`;
  return fn;
}

/**
 * Helper function to generate common WGSL struct definitions needed by workgroupReduce.
 * These structs provide access to builtin variables.
 * @returns A string containing WGSL struct definitions.
 */
export function getWrgslBuiltinStructs(): string {
  return /* wgsl */ `
struct BuiltinsNonuniform {
  @builtin(global_invocation_id) gid: vec3u,
  @builtin(local_invocation_index) lidx: u32,
  @builtin(local_invocation_id) lid: vec3u,
  @builtin(subgroup_invocation_id) sgid: u32,
}

struct BuiltinsUniform {
  @builtin(num_workgroups) nwg: vec3u,
  @builtin(workgroup_id) wgid: vec3u,
  @builtin(subgroup_size) sgsz: u32,
}`;
}
