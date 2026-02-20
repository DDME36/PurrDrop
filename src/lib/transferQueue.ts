// Transfer Queue - รองรับส่งหลายไฟล์แบบ queue
export interface QueuedTransfer {
  id: string;
  file: File;
  peerId: string;
  peerName: string;
  status: 'pending' | 'sending' | 'complete' | 'error';
  progress: number;
  addedAt: number;
}

export class TransferQueue {
  private queue: QueuedTransfer[] = [];
  private isProcessing = false;
  private onUpdate: (queue: QueuedTransfer[]) => void;
  private onProcess: (transfer: QueuedTransfer) => Promise<boolean>;

  constructor(
    onUpdate: (queue: QueuedTransfer[]) => void,
    onProcess: (transfer: QueuedTransfer) => Promise<boolean>
  ) {
    this.onUpdate = onUpdate;
    this.onProcess = onProcess;
  }

  add(file: File, peerId: string, peerName: string): string {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const transfer: QueuedTransfer = {
      id,
      file,
      peerId,
      peerName,
      status: 'pending',
      progress: 0,
      addedAt: Date.now(),
    };
    this.queue.push(transfer);
    this.onUpdate([...this.queue]);
    this.processNext();
    return id;
  }

  updateProgress(id: string, progress: number) {
    const transfer = this.queue.find(t => t.id === id);
    if (transfer) {
      transfer.progress = progress;
      this.onUpdate([...this.queue]);
    }
  }

  complete(id: string, success: boolean) {
    const transfer = this.queue.find(t => t.id === id);
    if (transfer) {
      transfer.status = success ? 'complete' : 'error';
      transfer.progress = success ? 100 : transfer.progress;
      this.onUpdate([...this.queue]);
      
      // Remove completed after delay
      setTimeout(() => {
        this.queue = this.queue.filter(t => t.id !== id);
        this.onUpdate([...this.queue]);
      }, 3000);
    }
    this.isProcessing = false;
    this.processNext();
  }

  private async processNext() {
    if (this.isProcessing) return;
    
    const next = this.queue.find(t => t.status === 'pending');
    if (!next) return;

    this.isProcessing = true;
    next.status = 'sending';
    this.onUpdate([...this.queue]);

    try {
      await this.onProcess(next);
    } catch {
      this.complete(next.id, false);
    }
  }

  getQueue(): QueuedTransfer[] {
    return [...this.queue];
  }

  clear() {
    this.queue = [];
    this.isProcessing = false;
    this.onUpdate([]);
  }
}
