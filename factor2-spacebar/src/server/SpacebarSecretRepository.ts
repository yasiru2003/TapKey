import type { StoredSpacebarSecret } from "../shared/types.js";

export interface SpacebarSecretRepository {
  findByUserId(userId: string): Promise<StoredSpacebarSecret | null>;
  save(secret: StoredSpacebarSecret): Promise<void>;
}

export class InMemorySpacebarSecretRepository implements SpacebarSecretRepository {
  private readonly secrets = new Map<string, StoredSpacebarSecret>();

  async findByUserId(userId: string): Promise<StoredSpacebarSecret | null> {
    const secret = this.secrets.get(userId);
    return secret ? { ...secret } : null;
  }

  async save(secret: StoredSpacebarSecret): Promise<void> {
    this.secrets.set(secret.userId, { ...secret });
  }
}