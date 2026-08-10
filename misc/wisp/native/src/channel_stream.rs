use bytes::Bytes;
use napi::{
    bindgen_prelude::Buffer,
    threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
};
use std::{
    io,
    pin::Pin,
    task::{Context, Poll},
};
use tokio::{
    io::{AsyncRead, AsyncWrite, ReadBuf},
    sync::mpsc,
};

pub struct ChannelStream {
    rx: mpsc::Receiver<Bytes>,
    overflow: Option<(Bytes, usize)>,
    on_send: ThreadsafeFunction<Buffer, (), Buffer, napi::Status, false, false, 0>,
    on_close: ThreadsafeFunction<(), (), (), napi::Status, false, false, 0>,
}

impl ChannelStream {
    pub fn new(
        rx: mpsc::Receiver<Bytes>,
        on_send: ThreadsafeFunction<Buffer, (), Buffer, napi::Status, false, false, 0>,
        on_close: ThreadsafeFunction<(), (), (), napi::Status, false, false, 0>,
    ) -> Self {
        Self { rx, overflow: None, on_send, on_close }
    }
}

impl AsyncRead for ChannelStream {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        let this = self.get_mut();

        if let Some((bytes, offset)) = this.overflow.take() {
            let remaining = &bytes[offset..];
            let n = remaining.len().min(buf.remaining());
            buf.put_slice(&remaining[..n]);
            if n < remaining.len() {
                this.overflow = Some((bytes, offset + n));
            }
            return Poll::Ready(Ok(()));
        }

        match this.rx.poll_recv(cx) {
            Poll::Ready(Some(bytes)) => {
                let n = bytes.len().min(buf.remaining());
                buf.put_slice(&bytes[..n]);
                if n < bytes.len() {
                    this.overflow = Some((bytes, n));
                }
                Poll::Ready(Ok(()))
            }
            Poll::Ready(None) => Poll::Ready(Ok(())),
            Poll::Pending => Poll::Pending,
        }
    }
}

impl AsyncWrite for ChannelStream {
    fn poll_write(
        self: Pin<&mut Self>,
        _cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        let n = buf.len();
        self.get_mut()
            .on_send
            .call(Buffer::from(buf.to_vec()), ThreadsafeFunctionCallMode::NonBlocking);
        Poll::Ready(Ok(n))
    }

    fn poll_flush(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Poll::Ready(Ok(()))
    }

    fn poll_shutdown(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        self.get_mut()
            .on_close
            .call((), ThreadsafeFunctionCallMode::NonBlocking);
        Poll::Ready(Ok(()))
    }
}
