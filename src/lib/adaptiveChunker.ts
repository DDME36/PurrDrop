/**
 * Adaptive Chunker - Dynamically adjusts chunk size based on network conditions
 * Optimized for P2P file transfer with memory-efficient buffering
 * Free Tier optimized: Conservative chunk sizes to prevent browser crashes
 */

export class AdaptiveChunker {
  private chunkSize: number;
  private readonly MIN_CHUNK = 16 * 1024; // 16KB - minimum for slow networks
  private readonly MAX_CHUNK = 128 * 1024; // 128KB - reduced from 256KB for stability
  private readonly INITIAL_CHUNK = 64 * 1024; // 64KB - balanced starting point
  private readonly MAX_BUFFER_SIZE = 1024 * 1024; // 1MB - prevent memory overflow

  constructor(initialSize?: number) {
    this.chunkSize = initialSize || this.INITIAL_CHUNK;
  }

  /**
   * Adjust chunk size based on DataChannel buffer state
   * @param bufferedAmount Current buffered bytes in DataChannel
   * @param threshold Buffer threshold (bufferedAmountLowThreshold)
   * @returns Adjusted chunk size
   */
  adjustChunkSize(bufferedAmount: number, threshold: number): number {
    // Critical: If buffer approaching danger zone, force minimum chunk size
    if (bufferedAmount > this.MAX_BUFFER_SIZE * 0.9) {
      console.warn('⚠️ Buffer near capacity, forcing minimum chunk size');
      this.chunkSize = this.MIN_CHUNK;
      return this.chunkSize;
    }
    
    // If buffer is less than 30% full, network is fast - increase chunk size (conservative)
    if (bufferedAmount < threshold * 0.3) {
      this.chunkSize = Math.min(
        Math.floor(this.chunkSize * 1.3), // Reduced from 1.5x to 1.3x for stability
        this.MAX_CHUNK
      );
    }
    // If buffer is more than 70% full, network is slow - decrease chunk size (aggressive)
    else if (bufferedAmount > threshold * 0.7) {
      this.chunkSize = Math.max(
        Math.floor(this.chunkSize * 0.6), // More aggressive reduction from 0.75 to 0.6
        this.MIN_CHUNK
      );
    }
    // Otherwise keep current size

    return this.chunkSize;
  }

  /**
   * Check if buffer is safe to send more data
   */
  isBufferSafe(bufferedAmount: number): boolean {
    return bufferedAmount < this.MAX_BUFFER_SIZE;
  }

  /**
   * Get current chunk size
   */
  getCurrentSize(): number {
    return this.chunkSize;
  }

  /**
   * Get max buffer size limit
   */
  getMaxBufferSize(): number {
    return this.MAX_BUFFER_SIZE;
  }

  /**
   * Reset to initial size
   */
  reset(): void {
    this.chunkSize = this.INITIAL_CHUNK;
  }
}
