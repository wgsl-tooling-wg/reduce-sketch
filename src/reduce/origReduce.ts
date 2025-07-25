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
    const config = params.map((param) => env[param]).join("_");
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