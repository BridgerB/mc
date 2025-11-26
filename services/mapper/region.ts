/**
 * Region file reader for Minecraft .mca files
 * Minimal implementation - no error handling
 */

export class RegionFile {
  private file: Deno.FsFile;
  private header: Uint8Array;

  constructor(path: string) {
    this.file = Deno.openSync(path, { read: true });
    this.header = new Uint8Array(8192);
    this.readFully(this.header);
  }

  /**
   * Read exactly n bytes from file
   */
  private readFully(buffer: Uint8Array): void {
    let totalRead = 0;
    while (totalRead < buffer.length) {
      const bytesRead = this.file.readSync(buffer.subarray(totalRead));
      if (bytesRead === null) throw new Error("Unexpected EOF");
      totalRead += bytesRead;
    }
  }

  /**
   * Check if chunk exists in this region
   */
  hasChunk(localX: number, localZ: number): boolean {
    const index = (localX % 32) + (localZ % 32) * 32;
    const offset = this.header[index * 4] << 16 |
      this.header[index * 4 + 1] << 8 |
      this.header[index * 4 + 2];
    return offset !== 0;
  }

  /**
   * Read raw chunk NBT data
   */
  readChunk(
    localX: number,
    localZ: number,
  ): { data: Uint8Array; compressionType: number } | null {
    const index = (localX % 32) + (localZ % 32) * 32;

    // Get offset from header
    const offset = (this.header[index * 4] << 16 |
      this.header[index * 4 + 1] << 8 |
      this.header[index * 4 + 2]) * 4096;

    if (offset === 0) return null;

    // Seek to chunk data
    this.file.seekSync(offset, Deno.SeekMode.Start);

    // Read chunk header (5 bytes)
    const chunkHeader = new Uint8Array(5);
    this.readFully(chunkHeader);

    const length = chunkHeader[0] << 24 |
      chunkHeader[1] << 16 |
      chunkHeader[2] << 8 |
      chunkHeader[3];
    const compressionType = chunkHeader[4];

    // Read chunk data (compression type byte already read, so length - 1)
    const chunkData = new Uint8Array(length - 1);
    this.readFully(chunkData);

    return { data: chunkData, compressionType };
  }

  close() {
    this.file.close();
  }
}
