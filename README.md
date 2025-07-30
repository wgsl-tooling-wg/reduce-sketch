An exploration of future WESL/WGSL/HostedShader ideas by sketching gpu parallel reduction.

_Very much a work in progress._

### Some Highlights
[reduceWorkgroup.wesl](./src/reduce/shaders/reduceWorkgroup.wesl)
- a reduction function using subgroups
- translated from [jdo's original](https://github.com/jowens/webgpu-benchmarking/blob/eec1d7191a6d0b2c809a360380b1d1f52e321c37/wgslFunctions.mjs#L324C1-L325C1) 
which relies heavily on string templating.
- uses several features in current WESL:
  - `import` for modularity
  - `@if` conditions
  - name uniqueness (via mangling)
- sketches the use of several proposed WESL features: 
  - generics on functions, variables, and structs (search for `<E>`)
    - global inference for wgTemp. 
      (but we'd implement local inference first)
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
    and passing it to ReduceBuffer.

### Proposed WESL/WGSL Features Used
The proposed code extends current WGSL/WESL:
- [generics](https://github.com/wgsl-tooling-wg/wesl-spec/issues/112)
  - declared on functions or structs
  - applised to member types and, variable types, structs
- [pluggable functions](https://github.com/wgsl-tooling-wg/wesl-spec/issues/133) 
  - as function arguments (e.g. mapFn)
  - in structs (e.g. subgroupBinOp)
  - function types
  - (no dynamic dispatch to different function, just static)
- [override const](https://github.com/wgsl-tooling-wg/wesl-spec/issues/132)
  - module level `override const` values that can be set by other shaders or by host code
    - importing shaders use import `with` statement
    - host code, e.g. via link({constants});
- override fn
  - like override const, but for functions.
  - (values can overriden by shaders or host code as with `override const`)
