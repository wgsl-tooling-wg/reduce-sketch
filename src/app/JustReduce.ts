import { bufferF32 } from "thimbleberry";
import { reduceBuffer } from "../reduce/ReduceBuffer.ts";
import { requestGpuDevice } from "./GpuUtil.ts";

/** importing from WGSL/WESL to typescript via reflection could look like this:
import { sumF32 } from "../reduce/shaders/binOps.wesl";
*/

const { floor, random } = Math;
const sumF32 = null as any;

/** sample app that sums a buffer full of f32s on the gpu */
export async function appReduce(): Promise<void> {
  const gpuDevice = await requestGpuDevice();
  const randomData = new Array(1024).fill(0).map(() => floor(random() * 100));
  const buffer: GPUBuffer = bufferF32(gpuDevice, randomData);

  const rb = reduceBuffer({ gpuDevice, inputBuffer: buffer, binOp: sumF32 });
  const value = rb.reduce();
  console.log("reduced value:", value);
}
