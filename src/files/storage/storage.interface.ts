export interface IStorageProvider {
  /**
   * Upload a file to the storage provider
   * @param path The destination path (key)
   * @param data The file buffer
   * @param mimeType The file's MIME type
   * @returns The storage path / key
   */
  upload(path: string, data: Buffer, mimeType: string): Promise<string>;

  /**
   * Upload a chunk for a large file
   * @param uploadId The session ID for the chunked upload
   * @param partNumber The chunk number
   * @param data The chunk buffer
   */
  uploadChunk(uploadId: string, partNumber: number, data: Buffer): Promise<any>;

  /**
   * Initialize a multipart upload session
   * @param path The destination path
   * @param mimeType The file's MIME type
   */
  initializeMultipartUpload(path: string, mimeType: string): Promise<string>;

  /**
   * Complete a multipart upload session
   * @param uploadId The session ID
   * @param path The destination path
   * @param parts The parts information (ETag, etc. from uploadChunk)
   */
  completeMultipartUpload(uploadId: string, path: string, parts: any[]): Promise<string>;

  /**
   * Download a file from the storage provider
   * @param path The storage path / key
   * @returns A stream or Buffer
   */
  download(path: string): Promise<Buffer>;

  /**
   * Delete a file from the storage provider
   * @param path The storage path / key
   */
  delete(path: string): Promise<void>;

  /**
   * Get a pre-signed URL for accessing the file securely
   * @param path The storage path / key
   * @param expiresIn Expiration time in seconds
   */
  getSignedUrl(path: string, expiresIn: number): Promise<string>;
}
