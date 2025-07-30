/**
 * Original version of workgroupReduce with string templating.
 * 
 * (AI generated header comment, take with a grain of salt)
 * 
 * String Template Parameters for wgReduce:
 *
 * Required parameters (must be in env):
 * - binop: Object containing:
 *   - identity: The identity value for the reduction operation (e.g., "0" for sum, "1" for product)
 *   - subgroupReduceOp: The subgroup reduction operation function name
 * - datatype: The WGSL data type for the reduction (e.g., "f32", "i32", "u32")
 * - workgroupSize: The size of the workgroup (e.g., 64, 128, 256)
 * - SUBGROUP_MIN_SIZE: Minimum subgroup size for the GPU
 *
 * Optional parameters:
 * - wgTempIsArgument: If true, workgroup temp array is passed as function argument
 *                     If false (default), temp array is declared locally
 * - useLongFunctionName: If true, uses config-specific function name (e.g., wgReduce_add_f32_64_16)
 *                        If false (default), uses short name "wgReduce"
 *
 * Generated template variables and their logic:
 * 
 * - config: String joining all params with "_" (e.g., "add_f32_64_16")
 * 
 * - wgTemp: Name of the workgroup temporary array
 *   - If wgTempIsArgument=true: "wgTemp" (passed as parameter)
 *   - If wgTempIsArgument=false: "wg_temp_${config}" (e.g., "wg_temp_add_f32_64_16")
 * 
 * - declareAndUseLocalWgTemp: Boolean (inverse of wgTempIsArgument)
 *   - If true: Emits workgroup array declaration before function
 *   - If false: Expects wgTemp as function parameter
 * 
 * - longFnName: "${shortFnName}_${config}" (e.g., "wgReduce_add_f32_64_16")
 *   - Always constructed to be unique based on configuration
 * 
 * - fnName: The actual function name used in the template
 *   - If useLongFunctionName=true: uses longFnName
 *   - If useLongFunctionName=false: uses shortFnName ("wgReduce")
 * 
 * Template emission logic:
 * - When declareAndUseLocalWgTemp=true:
 *   - Declares const TEMP_${longFnName}_MEM_SIZE
 *   - Declares var<workgroup> ${wgTemp} array
 *   - Function signature excludes wgTemp parameter
 * - When declareAndUseLocalWgTemp=false:
 *   - No workgroup declarations
 *   - Function signature includes wgTemp parameter
 */
export function wgReduce(args = {}) {
  const env = { ...this.env, ...args }; // properties in args overwrite this.env

  /** The normal case would be that we only need one function of each type
   * thus we can use the shortFnName for declaration and call, and can do
   * everything within a template string.
   * But if we need more flexibility (here, more than one reduce call in
   * a module), we should do it outside the template string. Until that is
   * necessary, this capability has not been used and is untested.
   *
   * Primitive-specific args are:
   * - wgTempIsArgument: if true, pass in a temp array for temporary use
   * - useLongFunctionName: use config-specific name, otherwise wgReduce
   * Default for all of these is "false".
   */
  const shortFnName = "wgReduce";
  /* every entry in params below needs to be a member of env */
  const params = ["binop", "datatype", "workgroupSize", "SUBGROUP_MIN_SIZE"];
  for (const necessary of params) {
    if (!(necessary in env)) {
      console.warn(`wgReduce: field '${necessary}' must be set in env`);
    }
  }
  const config = params.map(param => env[param]).join("_");
  const wgTemp = env.wgTempIsArgument ? "wgTemp" : `wg_temp_${config}`;
  const declareAndUseLocalWgTemp = !env.wgTempIsArgument;
  const longFnName = `${shortFnName}_${config}`;
  const fnName = env?.useLongFunctionName ? longFnName : shortFnName;
  const fn = /* wgsl */ `
${
  declareAndUseLocalWgTemp
    ? `const TEMP_${longFnName}_MEM_SIZE = 2 * ${env.workgroupSize} / ${env.SUBGROUP_MIN_SIZE};
var<workgroup> ${wgTemp}: array<${env.datatype}, TEMP_${longFnName}_MEM_SIZE>;`
    : ""
}

fn ${fnName}(// in: ptr<storage, array<${env.datatype}>, read>,
             in: ${env.datatype},
             ${
               declareAndUseLocalWgTemp
                 ? ""
                 : `wgTemp: ptr<workgroup, array<${env.datatype}, MAX_PARTIALS_SIZE>>,`
             }
             builtinsUniform: BuiltinsUniform,
             builtinsNonuniform: BuiltinsNonuniform) -> ${env.datatype} {
  let lidx = builtinsNonuniform.lidx;
  let sgsz = builtinsUniform.sgsz;
  let sgid = builtinsNonuniform.sgid;
  let BLOCK_DIM: u32 = ${env.workgroupSize};
  let sid = lidx / sgsz;
  let lane_log = u32(countTrailingZeros(sgsz)); /* log_2(sgsz) */
  /* workgroup size / subgroup size; how many partial reductions in this tile? */
  let local_spine: u32 = BLOCK_DIM >> lane_log;
  let aligned_size_base = 1u << ((u32(countTrailingZeros(local_spine)) + lane_log - 1u) / lane_log * lane_log);
  /* fix for aligned_size_base == 1 (needed when subgroup_size == BLOCK_DIM) */
  let aligned_size = select(aligned_size_base, BLOCK_DIM, aligned_size_base == 1);

  let t_red = in;
  let s_red = ${env.binop.subgroupReduceOp}(t_red);
  if (sgid == 0u) {
    ${wgTemp}[sid] = s_red;
  }
  workgroupBarrier();
  var f_red: ${env.datatype} = ${env.binop.identity};

  var offset = 0u;
  var top_offset = 0u;
  let lane_pred = sgid == sgsz - 1u;
  if (sgsz > aligned_size) {
    /* don't enter the loop */
    f_red = ${wgTemp}[lidx + top_offset];
  } else {
    for (var j = sgsz; j <= aligned_size; j <<= lane_log) {
      let step = local_spine >> offset;
      let pred = lidx < step;
      f_red = ${env.binop.subgroupReduceOp}(
        select(${env.binop.identity},
        ${wgTemp}[lidx + top_offset],
        pred));
      if (pred && lane_pred) {
        ${wgTemp}[sid + step + top_offset] = f_red;
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
