struct Nonuniform {
  @builtin(global_invocation_id) gid: vec3u /* 3D thread id in compute shader grid */,
  @builtin(local_invocation_index) lidx: u32 /* 1D thread index within workgroup */,
  @builtin(local_invocation_id) lid: vec3u /* 3D thread index within workgroup */,
  @builtin(subgroup_invocation_id) sgid: u32 /* 1D thread index within subgroup */
}

struct Uniform {
  @builtin(num_workgroups) nwg: vec3u /* == dispatch */,
  @builtin(workgroup_id) wgid: vec3u /* 3D workgroup id within compute shader grid */,
  @builtin(subgroup_size) sgsz: u32 /* 32 on Apple GPUs */
}