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

  /** Reduction operation */
  binOp: BinOp<T>;

  /** Store reduced output value in this buffer, will be created if not provided */
  outputBuffer?: GPUBuffer;
  destOffset?: number; // Offset in bytes for outputBuffer

  /** Transform elements before reduction.
   * Can be a reflected function, a WGSL string, or a TypeGPU function */
  mapFn?: WeslFunction | string;

  inputStart?: number; // Start reading the inputBuffer at this offset in bytes
  inputStride?: number; // Bytes between input values

  /** Not shown:
   * - Allow () => T for most fields, enabling lazy evaluation. e.g.
   *    inputBuffer: GPUBuffer | () => GPUBuffer;
   */
}

/** API sketch for ReduceBuffer instance that the caller can use. */
interface ReduceBuffer<T> extends HostedShader {
  /** Users call reduce() directly for simple situations.
   * (Use HostedShader's encode() API for more complicated cases) */
  reduce(): Promise<T>;

  /* Set or get the input buffer to reduce */
  inputBuffer(buffer: GPUBuffer): ReduceBuffer<T>; // Setter allows for chaining syntax
  inputBuffer(): GPUBuffer;

  /* Set or get the output buffer for reduction result */
  outputBuffer(buffer: GPUBuffer): ReduceBuffer<T>; // Setter allows for chaining syntax
  outputBuffer(): GPUBuffer;

  /** Not shown:
   * - Getter/setters for other values like (binOp, destOffset, etc.)
   */
}

/** A struct from WESL/WGSL, typically obtained via reflection from a .wgsl/.wesl file
 * (could also be constructed via WGSL/WESL string or TypeGPU) */
interface BinOp<T> extends WeslStruct {
  subgroupReduceOp?: WeslFunction;
  reduceOp: WeslFunction;
  identity: WeslValue<T>;
}

/** A shader collection that combines elements in a GPUBuffer to a single value
 * e.g., sum, min, max, etc.
 */
export function reduceBuffer<T>(
  params: ReduceBufferParams<T>,
): ReduceBuffer<T> {
  const name = "ReduceBuffer";
  const _device = params.gpuDevice;
  let _inputBuffer = params.inputBuffer;
  let _outputBuffer = params.outputBuffer;
  let _initialized: ReduceSetup | undefined;

  const api = {
    name,
    encode,
    destroy,
    reduce,
    inputBuffer,
    outputBuffer,
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

  function outputBuffer(): GPUBuffer;
  function outputBuffer(buffer: GPUBuffer): ReduceBuffer<T>;
  function outputBuffer(buffer?: GPUBuffer): GPUBuffer | ReduceBuffer<T> {
    if (buffer) {
      destroy();
      _outputBuffer = buffer;
      return api;
    }
    return _outputBuffer as GPUBuffer;
  }

  /** Run the reduction in standalone mode */
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
  - Use signals to manage internal dependencies (vs. current init())
    - Stoneberry has a POC for this, we should reimplement with current signals lib
  - Destroy GPU resources when asked
  - Use OptParam<T> for all params, so they can be lazily evaluated
    - Alternatively, expose all params as objects with get/set methods. e.g., inputBuffer.get() / inputBuffer.set()
  - Consider an Iterator API instead of explicit stride/offset
*/
