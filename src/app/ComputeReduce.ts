import { bufferF32 } from "thimbleberry";
import { randomBufferF32 } from "./GpuUtil.ts";

const { floor, random } = Math;

// import sumF32 from "./shaders/binop.wesl?sum with {D: Wesl.f32}""
const sumF32 = null as any;


/** a sample app that runs application compute shader
 * and then reduces the result (as e.g. scan) */
export async function appCompute(): Promise<void> {
  const gpuDevice = await requestGpuDevice();
  const buffer: GPUBuffer = randomBufferF32(gpuDevice, 1024);

  const encoder = gpuDevice.createCommandEncoder();
}

async function requestGpuDevice(): Promise<GPUDevice> {
  const adapter = await navigator.gpu?.requestAdapter();
  const gpuDevice = await adapter?.requestDevice();
  if (!gpuDevice) {
    throw new Error("Failed to get GPU device");
  }
  return gpuDevice;
}
