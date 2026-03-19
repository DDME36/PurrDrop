// DataChannel Management
export function setupDataChannel(
  channel: RTCDataChannel,
  peerId: string,
  onMessage: (data: string | ArrayBuffer) => void,
  onOpen?: () => void,
  onClose?: () => void,
  onError?: (error: Event) => void
): void {
  channel.binaryType = 'arraybuffer';

  channel.onopen = () => {
    console.log(`✅ DataChannel OPEN with ${peerId}`);
    onOpen?.();
  };

  channel.onclose = () => {
    console.log(`❌ DataChannel CLOSED with ${peerId}`);
    onClose?.();
  };

  channel.onerror = (e) => {
    console.warn(`⚠️ DataChannel error with ${peerId}`, e);
    onError?.(e);
  };

  channel.onmessage = (e) => {
    onMessage(e.data);
  };
}

export async function waitForDataChannelOpen(
  dc: RTCDataChannel,
  pc: RTCPeerConnection,
  timeoutMs: number
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      clean();
      const iceState = pc.iceConnectionState;
      const gatherState = pc.iceGatheringState;
      const dcState = dc.readyState;
      console.error(`❌ Connection timeout - ICE: ${iceState}, Gathering: ${gatherState}, DC: ${dcState}`);
      reject(new Error(`Connection timeout (ICE: ${iceState}, DC: ${dcState})`));
    }, timeoutMs);

    const handleOpen = () => {
      clearTimeout(timeout);
      console.log('✅ DataChannel OPEN - ready to send file!');
      clean();
      resolve();
    };

    const handleError = (e: Event) => {
      clearTimeout(timeout);
      console.error('❌ DataChannel error event:', e);
      clean();
      reject(new Error('DataChannel error'));
    };

    const handleClose = () => {
      clearTimeout(timeout);
      console.error('❌ DataChannel closed before open, state was:', dc.readyState);
      clean();
      reject(new Error('DataChannel closed before open'));
    };

    const handleIceFailure = () => {
      const state = pc.iceConnectionState;
      console.log(`🧊 ICE state: ${state}`);

      if (state === 'connected' || state === 'completed') {
        console.log('✅ ICE connected!');
      }

      if (state === 'failed') {
        console.error('❌ ICE failed, will retry...');
        setTimeout(() => {
          if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
            clearTimeout(timeout);
            clean();
            reject(new Error('ICE connection failed'));
          }
        }, 3000);
      }
    };

    const clean = () => {
      dc.removeEventListener('open', handleOpen);
      dc.removeEventListener('error', handleError);
      dc.removeEventListener('close', handleClose);
      pc.removeEventListener('iceconnectionstatechange', handleIceFailure);
    };

    dc.addEventListener('open', handleOpen);
    dc.addEventListener('error', handleError);
    dc.addEventListener('close', handleClose);
    pc.addEventListener('iceconnectionstatechange', handleIceFailure);

    if (dc.readyState === 'open') {
      console.log('✅ DataChannel already open!');
      clearTimeout(timeout);
      clean();
      resolve();
    } else {
      console.log('⏳ DataChannel state:', dc.readyState, '- waiting for open...');
    }
  });
}
