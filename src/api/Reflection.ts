/**
  Reflection allows users to get TypeScript objects
  and types for WGSL/WESL declarations like function, structs and variables.

 - TypeScript users use `import` statements.
   ```ts
   import { mainEntry } from "./shaders/mainApp.wesl;
   ```

 - `import` statements can also pass generic parameters

   ```ts
   import { sum as sumF32 } from "./shaders/binOps.wesl?sum with {D: Wesl.f32}";
   ```
 
 */

/* (This is just a sketch to show the basic idea.
 *  Likely we'd adapt or adopt TypeGPU types for WGSL.) */

export interface WeslStruct {
  [key: string]: WeslFunction | WeslValue<any>;
}

export type WeslFunction = any;

export interface WeslValue<T> {
  type: "f32" | "i32" | "u32";
  value: T;
}

export const Wesl = {
  f32: "f32",
  i32: "i32",
  u32: "u32",
};
