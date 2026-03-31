import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { config } from '../../config';

let _containerClient: ContainerClient | null = null;

function getContainerClient(): ContainerClient {
  if (_containerClient) return _containerClient;

  if (!config.azureStorageConnectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is not configured');
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(
    config.azureStorageConnectionString,
  );
  _containerClient = blobServiceClient.getContainerClient(config.azureStorageContainerName);
  return _containerClient;
}

export const azureBlobStorage = {
  /**
   * Ensures the storage container exists (creates it if needed).
   */
  async ensureContainer(): Promise<void> {
    const client = getContainerClient();
    await client.createIfNotExists({ access: 'blob' });
  },

  /**
   * Uploads a buffer as a blob and returns its public URL.
   */
  async upload(blobName: string, data: Buffer, contentType: string): Promise<string> {
    await this.ensureContainer();
    const client = getContainerClient();
    const blockBlobClient = client.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(data, {
      blobHTTPHeaders: { blobContentType: contentType },
    });
    return blockBlobClient.url;
  },

  /**
   * Deletes a blob by name.
   */
  async delete(blobName: string): Promise<void> {
    const client = getContainerClient();
    const blockBlobClient = client.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists();
  },
};
