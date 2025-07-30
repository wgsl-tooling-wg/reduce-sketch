import { reduceBuffer } from "../reduce/ReduceBuffer.ts";
import { randomBufferF32, requestGpuDevice } from "./GpuUtil.ts";

/* Importing from WGSL/WESL to TypeScript via reflection could look like this: */
// import { sumF32 } from "../reduce/shaders/binOps.wesl";
const sumF32 = null as any;

/** Sample app that sums a buffer full of f32s on the GPU.
 * Simple use of a hosted shader.
 */
export async function appReduce(): Promise<void> {
  const gpuDevice = await requestGpuDevice();
  const buffer: GPUBuffer = randomBufferF32(gpuDevice, 1024);

  const rb = reduceBuffer({ gpuDevice, inputBuffer: buffer, binOp: sumF32 });
  const value = rb.reduce();
  console.log("reduced value:", value);
}
