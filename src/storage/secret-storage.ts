import { S3Storage } from 'coze-coding-dev-sdk';

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

export class SecretStorageService {
  /**
   * 存储客户端密钥
   * @param clientId 客户端 ID
   * @param secret 客户端密钥（明文）
   * @returns 存储的 key
   */
  async storeClientSecret(clientId: string, secret: string): Promise<string> {
    const key = `oauth/clients/${clientId}/secret.txt`;
    const actualKey = await storage.uploadFile({
      fileContent: Buffer.from(secret, 'utf-8'),
      fileName: key,
      contentType: 'text/plain',
    });
    return actualKey;
  }

  /**
   * 获取客户端密钥
   * @param clientId 客户端 ID
   * @returns 客户端密钥（明文）或 null
   */
  async getClientSecret(clientId: string): Promise<string | null> {
    const key = `oauth/clients/${clientId}/secret.txt`;
    try {
      const exists = await storage.fileExists({ fileKey: key });
      if (!exists) return null;
      
      const buffer = await storage.readFile({ fileKey: key });
      return buffer.toString('utf-8');
    } catch {
      return null;
    }
  }

  /**
   * 删除客户端密钥
   * @param clientId 客户端 ID
   */
  async deleteClientSecret(clientId: string): Promise<boolean> {
    const key = `oauth/clients/${clientId}/secret.txt`;
    return storage.deleteFile({ fileKey: key });
  }

  /**
   * 检查客户端密钥是否存在
   * @param clientId 客户端 ID
   */
  async hasClientSecret(clientId: string): Promise<boolean> {
    const key = `oauth/clients/${clientId}/secret.txt`;
    return storage.fileExists({ fileKey: key });
  }
}

export const secretStorage = new SecretStorageService();
