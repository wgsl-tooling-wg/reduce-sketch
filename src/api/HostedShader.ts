export interface HostedShader {
  /** Add compute or render passes for this shader to the provided GPUCommandEncoder */
  encode(encoder: GPUCommandEncoder): void;

  /** Clean up GPU resources */
  destroy?: () => void;

  /** Optional name for logging and benchmarking */
  name?: string;
}

/** Optional parameters can be provided as a value, a function returning a value, or undefined */
export type OptParam<T> = T | (() => T) | undefined;


/* TODO
  
  // could we have HostedShader provide a dispatch() method instead of encode()?
  dispatch(): void;

    - The theory is that encode() is faster
    because multiple shaders in the same encoder will
    be more efficiently handled by Dawn/WebGPU/GPU drivers.
    (But is this really true?)

*/