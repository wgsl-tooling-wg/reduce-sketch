An exploration of future WESL/WGSL/HostedShader ideas by sketching parts of gpu parallel reduction. 

### Summary

The starting point is John Owen's implementation of [workgroupReduce][jdo-reduce].
We implement `workgroupReduce()` 
in a hypothetical future version of WESL/WGSL to explore the needed
shader language features.
We also implement the host code integration to use `workgroupReduce`
as part of a larger `reduceBuffer()` kernel to clarify
the integration issues.

- It looks like the `workgroupReduce()` shader function can be handled cleanly with a few extra features in WESL/WGSL.  
Most of the needed extra features for `workgroupReduce()` 
have been requested for other projects too, 
and so are good candidates to prioritize for the next rev of WESL.

The implementation sketch here also shows reducing an entire GPUBuffer 
(not just a workgroup sized shader array).
That requires multiple kernel dispatches, intermediate buffers, 
linking control from host code. 
See [host+shader libraries](https://hackmd.io/@mighdoll/ryM8IYqXlg) for a
general discussion. 

-  The goal of this part of the sketch is show a way forward on a number
  of integration issues: 
  between shader modules, 
  between
  host and shader code, and between the application and hosted shader libraries.

The top down control flow in the example sketch:
  - `JustReduce.ts` (app) or `SimulationReduce.ts`
  - -> `ReduceBuffer.ts` (TS api)
  - -> `reduceBuffer()` (shader kernel)
  - -> `workgroupReduce()` (shader module) 


### Code Highlights
[origReduce](./src/orig-reduce/origReduce.ts) is a commented version of 
[jdo's wgReduce][jdo-reduce], a state of the art subgroup based
reduction for WebGPU. 
The implementation relies heavily on custom string interpolation 
to flexibly construct WGSL.

We're going to try and imagine standard language features
to allow writing functions like workgroup reduction w/o custom string interpolation.

[reduceWorkgroup.wesl](./src/reduce/shaders/reduceWorkgroup.wesl)
- an implementation using current and proposed features of WESL.
- uses several features in current WESL:
  - `import` for modularity
  - `@if` conditions
  - name uniqueness (via mangling)
- sketches the use of several proposed WESL features: 
  - generics on functions, variables, and structs (search for `<E>`)
    - global inference for `wgTemp`. (tho likely implement local-only inference first)
  - host/shader overridable constants (search for `override const`) 

[reduceBuffer.wesl](./src/reduce/shaders/reduceBuffer.wesl)
  - calls reduceWorkgroup
  - uses `import ... with` feature idea to set `override const` values in `reduceWorkgroup.wesl`
  - `override fn` for mapFn prior to reduce (typically set via host code, see `JustReduce`)

[binOp.wesl](./src/reduce/shaders/binOps.wesl)
  - code snippets for reduction that can be imported from TypeScript or from other wesl shaders

[ReduceBuffer.ts](./src/reduce/ReduceBuffer.ts)
  - api for an example HostedShader -
    i.e. a library with both host and shader code

[JustReduce.ts](./src/app/JustReduce.ts)
  - shows a TypeScript application importing a binOp from .wesl,
    and passing it to `ReduceBuffer`.

[SimulationReduce.ts](./src/app/SimulationReduce.ts)
  - shows a TypeScript application that runs a simulation and then
    uses `ReduceBuffer`.

### Proposed WESL/WGSL Features
The proposed code extends current WGSL/WESL:
- [generics](https://github.com/wgsl-tooling-wg/wesl-spec/issues/112)
  - declared on functions or structs
  - applised to member types and, variable types, structs
- [pluggable functions](https://github.com/wgsl-tooling-wg/wesl-spec/issues/133) 
  - as function arguments (e.g. mapFn)
  - in structs (e.g. subgroupBinOp)
  - function types
  - note: no dynamic dispatch here, function pointers are statically resolved.
- [override const](https://github.com/wgsl-tooling-wg/wesl-spec/issues/132)
  - module level `override const` values that can be set by other shaders or by host code
    - importing shaders use import `with` statement
    - host code, e.g. via `link({overrides});` 
    see [Linker2.ts](./src/linker/Linker2.ts)
- override fn
  - like `override const`, but for functions.
  - values can overriden by shaders or host code as with `override const`
- [reflection](https://github.com/wgsl-tooling-wg/wesl-spec/issues/51)
  - allows host code to reference wgsl code, to select reduce variations
    or inject map prior to reduce.

see TODO comments in the sources for future work.

[jdo-reduce]: https://github.com/jowens/webgpu-benchmarking/blob/eec1d7191a6d0b2c809a360380b1d1f52e321c37/wgslFunctions.mjs#L324C1-L325C1