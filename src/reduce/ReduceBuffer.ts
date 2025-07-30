/// <reference types="wesl-plugin/suffixes" />
import type { HostedShader } from "../api/HostedShader";
import type { WeslFunction, WeslStruct, WeslValue } from "../api/Reflection";
import { link2 } from "../linker/Linker2.ts";
import reduceBufferLink from "../shaders/reduceBuffer.wesl?link";
import { type ReduceSetup, setupReduce } from "./ReduceBufferSetup.ts";

/** Caller options to initialize ReduceBuffer */
interface ReduceBufferParams<T> {
  gpuDevice: GPUDevice;
  inputBuffer: GPUBuffer;

  /** reduction operation */
  binOp: BinOp<T>;

  /** store reduced output value in this buffer, will be created if not provided */
  outputBuffer?: GPUBuffer;
  destOffset?: number; // offset in bytes for outputBuffer

  /** translate elements before reduction
   * can be a reflected function, a wgsl string, or a TypeGPU function */
  mapFn?: WeslFunction | string;

  inputStart?: number; // start reading the inputBuffer at this offset in bytes
  inputStride?: number; // bytes between input values

  /** not shown:
   * - allow () => T for most fields, enabling lazy evaluation. e.g.
   *    inputBuffer: GPUBuffer | () => GPUBuffer;
   */
}

/** api sketch for ReduceBuffer instance that the caller can use. */
interface ReduceBuffer<T> extends HostedShader {
  /** * Users call reduce() directly for simple situations.
   * (Use HostedShader's encode() api for more complicated cases) */
  reduce(): Promise<T>;

  /* set or get the input buffer to reduce */
  inputBuffer(buffer: GPUBuffer): ReduceBuffer<T>; // setter allows for chaining syntax
  inputBuffer(): GPUBuffer | undefined;

  /** not shown:
   * - getter/setters for other values like (outputBuffer, binOp, etc.)
   */
}

/** a struct from WESL/WGSL, typically obtained via reflection from a .wgsl/wesl file
 * (could also be constructed via wgsl/wesl string or typegpu) */
interface BinOp<T> extends WeslStruct {
  subgroupReduceOp?: WeslFunction;
  reduceOp: WeslFunction;
  identity: WeslValue<T>;
}

/** A shader collection combining elements in a GPUBuffer to a single value
 * e.g. sum, min, max, etc.
 */
export function reduceBuffer<T>(
  params: ReduceBufferParams<T>,
): ReduceBuffer<T> {
  const name = "ReduceBuffer";
  const _device = params.gpuDevice;
  let _inputBuffer = params.inputBuffer;
  let _initialized: ReduceSetup | undefined;

  const api = {
    name,
    encode,
    destroy,
    reduce,
    inputBuffer,
  };
  return api;

  function inputBuffer(): GPUBuffer | undefined;
  function inputBuffer(buffer: GPUBuffer): ReduceBuffer<T>;
  function inputBuffer(buffer?: GPUBuffer): GPUBuffer | ReduceBuffer<T> {
    if (buffer) {
      destroy();
      _inputBuffer = buffer;
      return api;
    }
    return _inputBuffer;
  }

  /** run the reduce in standalone mode */
  async function reduce(): Promise<T> {
    await init();
    const encoder = _device.createCommandEncoder({ label: name });
    encode(encoder);
    _device.queue.submit([encoder.finish()]);
    return undefined as T;
  }

  async function encode(encoder: GPUCommandEncoder): Promise<void> {
    const { pipeline, passes } = await init();

    passes.forEach(pass => {
      const passEncoder = encoder.beginComputePass({ label: name });
      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, pass.bindGroup);
      passEncoder.dispatchWorkgroups(pass.workgroups);
      passEncoder.end();
    });
  }

  async function init(): Promise<ReduceSetup> {
    if (_initialized) return _initialized;

    // Inject the binOp and mapFn, and transpile the shader to WGSL module
    const { mapFn, binOp } = params;
    const overrides = { binOp, mapFn };
    const linked = await link2({ ...reduceBufferLink, overrides });
    const module: GPUShaderModule = linked.createShaderModule(_device);

    _initialized = setupReduce(_device, _inputBuffer, module);

    return _initialized;
  }

  function destroy(): void {
    if (_initialized) {
      _initialized = undefined;
    }
  }
}


/* TODO
  - consider an Iterator api instead?
  - use OptParam<T> for all params, so they can be lazy evaluated
  - use signals to manage internal dependencies (vs. current init())
  - destroy GPU resources when asked
*/