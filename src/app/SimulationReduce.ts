import { copyBuffer } from "thimbleberry";
import type { HostedShader } from "../api/HostedShader.ts";
import { reduceBuffer } from "../reduce/ReduceBuffer.ts";
import { randomBufferF32, requestGpuDevice } from "./GpuUtil.ts";

/* Importing from WGSL/WESL to TypeScript via reflection could look like this: */
// import { sumF32 } from "../reduce/shaders/binOps.wesl";
const sumF32 = null as any;

/** A sample app that runs an application compute shader
 * and then reduces the result. */
export async function appCompute(): Promise<number> {
  const device = await requestGpuDevice();

  /** Set up shaders */
  const mySim = mySimulation(device);
  const reducer = reduceBuffer({
    gpuDevice: device,
    inputBuffer: mySim.simResults,
    binOp: sumF32,
  });

  /** Run the simulation and the reduction */
  const encoder = device.createCommandEncoder();
  mySim.encode(encoder);
  reducer.encode(encoder);
  device.queue.submit([encoder.finish()]);

  /** Return the reduction result */
  const result = await copyBuffer(device, reducer.outputBuffer(), "f32");
  return result[0];
}

/** Imagine our app performs a Monte Carlo simulation that produces a GPUBuffer
 * full of simulated values. */
interface MySimulation extends HostedShader {
  simResults: GPUBuffer;
}

function mySimulation(device: GPUDevice): MySimulation {
  return {
    name: "mySimulation",
    encode(_encoder: GPUCommandEncoder): void {},
    simResults: randomBufferF32(device, 1024),
  };
}
