export interface PassInfo {
  bindGroup: GPUBindGroup;
  workgroups: number;
  outBuffer: GPUBuffer;
}

export interface ReduceSetup {
  pipeline: GPUComputePipeline;
  passes: PassInfo[];
}

export type BindingEntry =
  | Pick<GPUBindGroupLayoutEntry, "buffer">
  | Pick<GPUBindGroupLayoutEntry, "sampler">
  | Pick<GPUBindGroupLayoutEntry, "texture">
  | Pick<GPUBindGroupLayoutEntry, "storageTexture">
  | Pick<GPUBindGroupLayoutEntry, "externalTexture">;

/** setup GPU resources for reduction */
export function setupReduce(
  device: GPUDevice,
  _inputBuffer: GPUBuffer,
  module: GPUShaderModule,
): ReduceSetup {
  /*
   * (only a sketch towards implementation here. the point is to
   *  focus on the interesting parts in ReduceBuffer.ts and
   *  imagine that here we take care of the gpu boilerplate.)
   */
  const _elementsPerThread = 4;
  const _threadsPerWorkgroup = 256;

  const bindings: BindingEntry[] = []; // TODO
  const pipeline = createPipeline(device, bindings, module);

  const passes = setupPasses();
  return { pipeline, passes };

  function setupPasses(): PassInfo[] {
    const workgroupsByPass = workgroupsPerPass();
    const bindGroupByPass = bindGroupPerPass(workgroupsByPass);

    const passes = workgroupsByPass.map((workgroups, i) => ({
      bindGroup: bindGroupByPass[i],
      workgroups,
      outBuffer: null as GPUBuffer, // TODO
    }));
    return passes;
  }

  function workgroupsPerPass(): number[] {
    const tileSize = _threadsPerWorkgroup * _elementsPerThread;
    const firstPass = Math.ceil(_inputBuffer.size / tileSize);
    const passes = [firstPass];

    const reductionFactor = tileSize * _threadsPerWorkgroup;
    let reducedSize = Math.ceil(_inputBuffer.size / reductionFactor);
    while (reducedSize > 1) {
      passes.push(reducedSize);
      reducedSize = Math.ceil(reducedSize / _threadsPerWorkgroup);
    }
    return passes;
  }

  function bindGroupPerPass(workgroupsByPass: number[]): GPUBindGroup[] {
    const bindGroups: GPUBindGroup[] = [];
    for (let i = 0; i < workgroupsByPass.length; i++) {
      bindGroups.push(
        device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: null as any, // TODO
        }),
      );
    }
    return bindGroups;
  }
}

export function createPipeline(
  device: GPUDevice,
  bindings: BindingEntry[],
  module: GPUShaderModule,
): GPUComputePipeline {
  const label = "ReduceBufferPipeline";
  const entries = bindings.map((binding, i) => ({
    binding: i,
    visibility: GPUShaderStage.COMPUTE,
    ...binding,
  }));
  const bindGroupLayout = device.createBindGroupLayout({
    label,
    entries,
  });

  const pipeline = device.createComputePipeline({
    label,
    compute: { module },
    layout: device.createPipelineLayout({
      label: "ReduceBufferPipeline",
      bindGroupLayouts: [bindGroupLayout],
    }),
  });
  return pipeline;
}
