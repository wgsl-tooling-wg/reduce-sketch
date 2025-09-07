use std::{marker::PhantomData, sync::Arc};

use wgpu::{Buffer, BufferSlice, BufferView, CommandEncoder, Device};

trait HostedShader {
    fn init(&mut self);
    fn destroy(&mut self);
    fn encode(&mut self, enc: &mut CommandEncoder);
    fn name(&self) -> Option<&'_ str> {
        None
    }
}

struct BinOp<T> {
    _marker: PhantomData<T>,
    wesl_fn: String,
}

struct ReduceBuffer<T> {
    device: Arc<Device>,
    in_buf: Buffer,
    out_buf: Buffer,
    binop: BinOp<T>,
    initialized: bool,
}

impl<T> ReduceBuffer<T> {
    fn new(device: Arc<Device>, in_buf: Buffer, bin_op: BinOp<T>) -> Self {
        Self {
            device,
            in_buf,
            out_buf: device.create_buffer(todo!()),
            binop: bin_op,
            initialized: false,
        }
    }

    fn set_binop(&mut self, binop: BinOp<T>) {
        self.binop = binop;
        self.initialized = false;
    }
    fn set_input_buffer(&mut self, in_buf: Buffer) {
        self.in_buf = in_buf;
        self.initialized = false;
    }

    fn output_buffer(&self) -> &Buffer {
        &self.out_buf
    }
}

impl<T> HostedShader for ReduceBuffer<T> {
    fn init(&mut self) {
        todo!()
    }

    fn destroy(&mut self) {
        todo!()
    }

    fn encode(&mut self, enc: &mut CommandEncoder) {
        todo!()
    }
}

fn main() {
    let device = todo!();
    let mut encoder = todo!();
    let in_buf = todo!();
    let add_f32 = todo!();

    let reducer = ReduceBuffer::new(device, in_buf, add_f32);

    reducer.encode(&mut encoder);
    // run the shader
    let out = reducer.output_buffer();
    // read out to number
    let result = todo!();

    println!("result: {result}");
}
