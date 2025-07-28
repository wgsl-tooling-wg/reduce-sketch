import { bufferF32 } from "thimbleberry";

export async function requestGpuDevice(): Promise<GPUDevice> {
  const adapter = await navigator.gpu?.requestAdapter();
  const gpuDevice = await adapter?.requestDevice();
  if (!gpuDevice) {
    throw new Error("Failed to get GPU device");
  }
  return gpuDevice;
}

export function randomBufferF32(gpuDevice: GPUDevice, size: number): GPUBuffer {
  const randomData = new Array(size)
    .fill(0)
    .map(() => Math.floor(Math.random() * 100));
  return bufferF32(gpuDevice, randomData);
}
