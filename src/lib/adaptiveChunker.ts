/**
 * Adaptive Chunker - Dynamically adjusts chunk size based on network conditions
 * Starts small (16KB) and scales up to 256KB for optimal transfer speed
 */

export class AdaptiveChunker {
  private chunkSize: number;
  private readonly MIN_CHUNK = 16 * 1024; // 16KB
  private readonly MAX_CHUNK = 256 * 1024; // 256KB
  private readonly INITIAL_CHUNK = 64 * 1024; // 64KB (current default)

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
    // If buffer is less than 50% full, network is fast - increase chunk size
    if (bufferedAmount < threshold * 0.5) {
      this.chunkSize = Math.min(
        Math.floor(this.chunkSize * 1.5),
        this.MAX_CHUNK
      );
    }
    // If buffer is more than 80% full, network is slow - decrease chunk size
    else if (bufferedAmount > threshold * 0.8) {
      this.chunkSize = Math.max(
        Math.floor(this.chunkSize * 0.75),
        this.MIN_CHUNK
      );
    }
    // Otherwise keep current size

    return this.chunkSize;
  }

  /**
   * Get current chunk size
   */
  getCurrentSize(): number {
    return this.chunkSize;
  }

  /**
   * Reset to initial size
   */
  reset(): void {
    this.chunkSize = this.INITIAL_CHUNK;
  }
}
