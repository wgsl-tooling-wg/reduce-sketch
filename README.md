An exploration of future WESL/WGSL/HostedShader ideas by sketching reduction.

_Very much a work in progress._

# Some Highlights
[reduceWorkgroup.wesl](./src/reduce/shaders/reduceWorkgroup.wesl)
- a reduction function using subgroups
- uses several features in current WESL:
  - `@if` conditions
  - name uniqueness (via mangling)
  - imports for modularity
- sketches the use of several proposed features: 
  - generics on functions, variables, and structs (search for <E>)
    - global inference is assumed for wgTemp. (but implement with
      local inference only first (and more annotations))
  - host/shader overridable constants (search for override const) 
[reduceBuffer.wesl](./src/reduce/shaders/reduceBuffer.wesl)
  - calls reduceWorkgroup
  - uses `import ... with` feature idea to set override const
  - override fn for mapFn prior to reduce (typically set via host code)
[binOp.wesl](./src/reduce/shaders/binOps.wesl)
  - code snippets that can be imported from TypeScript or shaders
[ReduceBuffer.ts](./src/reduce/ReduceBuffer.ts)
  - api for an example HostedShader,
    i.e. a library with both host and shader code
[JustReduce.ts](./src/app/JustReduce.ts)
  - shows a TypeScript application importing a binOp from .wesl,
    and passing it to ReduceBuffer.

## Proposed WESL/WGSL Features Used
The proposed code extends current WGSL/WESL:
- [generics](https://github.com/wgsl-tooling-wg/wesl-spec/issues/112)
  - declared on functions or structs
  - applised to member types and, variable types, structs
- [pluggable functions](https://github.com/wgsl-tooling-wg/wesl-spec/issues/133) 
  - as function arguments (e.g. mapFn)
  - in structs (e.g. subgroupReduceOp)
  - also function types
  - (no dynamic dispatch to different function, just static)
- [override const](https://github.com/wgsl-tooling-wg/wesl-spec/issues/132)
  - module level `override const` values that can be set by other shaders or by host code
    - importing shaders use import `with` statement
    - host code, e.g. via link({constants});
- override fn
  - like override const, but for functions.
  - (values can overriden by shaders or host code as with `override const`)
