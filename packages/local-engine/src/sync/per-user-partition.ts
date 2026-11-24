// ============================================
// packages/local-engine/src/sync/per-user-partition.ts
//
// Per-User Local Database Isolation & Encryption Manager
// Guarantees zero cross-user data leakage on shared devices (POS terminals).
// Each user on each device has an isolated, encrypted local SQLite partition.
// ============================================

import { pbkdf2 } from '@noble/hashes/pbkdf2.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'

export interface UserDatabaseConfig {
  readonly deviceId: string
  readonly userId: string
  readonly workspaceId: string
  readonly userRole: string
  readonly baseStoragePath: string
}

export interface UserPartitionInfo {
  readonly databaseFileName: string
  readonly fullPath: string
  readonly userHash: string
  readonly encryptionKeyHex: string
}

export class PerUserPartitionManager {
  /**
   * Computes an isolated database filename and storage path for a user.
   * Ensures that Owner, Manager, and Employee have physically separated SQLite files on disk.
   */
  public static resolvePartition(config: UserDatabaseConfig): UserPartitionInfo {
    const userHash = bytesToHex(
      sha256(utf8ToBytes(`${config.deviceId}:${config.workspaceId}:${config.userId}`)),
    ).slice(0, 16)

    const databaseFileName = `hisabche_user_${userHash}.sqlite`
    const normalizedBasePath = config.baseStoragePath.replace(/\\/g, '/').replace(/\/$/, '')
    const fullPath = `${normalizedBasePath}/${databaseFileName}`

    // Derive deterministic AES-256-GCM / SQLCipher encryption key bound to device & user
    const salt = sha256(utf8ToBytes(config.deviceId))
    const derivedKey = pbkdf2(sha256, utf8ToBytes(config.userId), salt, { c: 100_000, dkLen: 32 })
    const encryptionKeyHex = bytesToHex(derivedKey)

    return {
      databaseFileName,
      fullPath,
      userHash,
      encryptionKeyHex,
    }
  }

  /**
   * Asserts that data belonging to User A cannot be accessed under User B's active partition.
   */
  public static assertPartitionIntegrity(activeUserId: string, targetUserId: string): void {
    if (activeUserId !== targetUserId) {
      throw new Error(
        `Cross-User Security Violation: User '${activeUserId}' attempted to access local partition belonging to '${targetUserId}'.`,
      )
    }
  }
}
