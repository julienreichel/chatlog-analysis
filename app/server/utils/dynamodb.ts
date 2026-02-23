/**
 * DynamoDB data-access layer for API keys.
 *
 * Table schema (single-table design)
 * -----------------------------------
 * pk  = "USER#<userId>"
 * sk  = "KEY#<keyId>"
 *
 * Attributes:
 *   keyId       (string)  – UUID
 *   keyHash     (string)  – HMAC-SHA-256 hex digest of the plaintext key
 *   label       (string)  – optional human-readable label
 *   createdAt   (string)  – ISO-8601
 *   revokedAt   (string)  – ISO-8601, present only when revoked
 *   lastUsedAt  (string)  – ISO-8601, updated on each successful auth
 *
 * A GSI "KeyHashIndex" on keyHash lets us look up a key during request
 * authentication without scanning the whole table.
 *
 * GSI:  KeyHashIndex
 *   pk  = keyHash
 */
import {
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { randomUUID } from 'node:crypto'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiKeyRecord {
  userId: string
  keyId: string
  keyHash: string
  label?: string
  createdAt: string
  revokedAt?: string
  lastUsedAt?: string
}

export interface ApiKeyMetadata extends Omit<ApiKeyRecord, 'keyHash'> {
  isActive: boolean
}

// ─── DynamoDB client (lazy singleton) ─────────────────────────────────────────

let _docClient: DynamoDBDocumentClient | null = null

function getDocClient(region: string): DynamoDBDocumentClient {
  if (!_docClient) {
    const raw = new DynamoDBClient({ region })
    _docClient = DynamoDBDocumentClient.from(raw, {
      marshallOptions: { removeUndefinedValues: true },
    })
  }
  return _docClient
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pk(userId: string) {
  return `USER#${userId}`
}
function sk(keyId: string) {
  return `KEY#${keyId}`
}

function toMetadata(record: ApiKeyRecord): ApiKeyMetadata {
  const { keyHash: _keyHash, ...rest } = record
  return { ...rest, isActive: !record.revokedAt }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Persist a new API key record for a user.
 * The plaintext key must NOT be passed here – only its hash.
 */
export async function createApiKeyRecord(
  userId: string,
  keyHash: string,
  tableName: string,
  region: string,
  label?: string,
): Promise<ApiKeyMetadata> {
  const client = getDocClient(region)
  const keyId = randomUUID()
  const now = new Date().toISOString()

  const record: ApiKeyRecord = {
    userId,
    keyId,
    keyHash,
    createdAt: now,
    ...(label ? { label } : {}),
  }

  await client.send(new PutCommand({
    TableName: tableName,
    Item: {
      pk: pk(userId),
      sk: sk(keyId),
      keyId,
      keyHash,
      createdAt: now,
      ...(label ? { label } : {}),
    },
    // Prevent accidental overwrite of an existing key with same UUID
    ConditionExpression: 'attribute_not_exists(pk)',
  }))

  return toMetadata(record)
}

/**
 * Return all key metadata for a user (no hashes exposed).
 */
export async function listApiKeys(
  userId: string,
  tableName: string,
  region: string,
): Promise<ApiKeyMetadata[]> {
  const client = getDocClient(region)

  const result = await client.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': pk(userId),
      ':skPrefix': 'KEY#',
    },
    ProjectionExpression: 'keyId, label, createdAt, revokedAt, lastUsedAt',
  }))

  return (result.Items ?? []).map(item => ({
    userId,
    keyId: item.keyId as string,
    label: item.label as string | undefined,
    createdAt: item.createdAt as string,
    revokedAt: item.revokedAt as string | undefined,
    lastUsedAt: item.lastUsedAt as string | undefined,
    isActive: !item.revokedAt,
  }))
}

/**
 * Revoke a key by recording `revokedAt`.  Idempotent.
 */
export async function revokeApiKey(
  userId: string,
  keyId: string,
  tableName: string,
  region: string,
): Promise<void> {
  const client = getDocClient(region)

  await client.send(new UpdateCommand({
    TableName: tableName,
    Key: { pk: pk(userId), sk: sk(keyId) },
    // Only update if the record exists and belongs to this user
    ConditionExpression: 'attribute_exists(pk)',
    UpdateExpression: 'SET revokedAt = :now',
    ExpressionAttributeValues: { ':now': new Date().toISOString() },
  }))
}

/**
 * Look up a key record by its hash (used in X-API-Key validation).
 * Uses the KeyHashIndex GSI.
 */
export async function getApiKeyByHash(
  keyHash: string,
  tableName: string,
  region: string,
): Promise<ApiKeyRecord | null> {
  const client = getDocClient(region)

  const result = await client.send(new QueryCommand({
    TableName: tableName,
    IndexName: 'KeyHashIndex',
    KeyConditionExpression: 'keyHash = :hash',
    ExpressionAttributeValues: { ':hash': keyHash },
    Limit: 1,
  }))

  if (!result.Items || result.Items.length === 0) return null

  const item = result.Items[0]
  // Extract userId from pk attribute ("USER#<userId>")
  const rawPk = item.pk as string | undefined
  const userId = rawPk?.startsWith('USER#') ? rawPk.slice(5) : ''

  return {
    userId,
    keyId: item.keyId as string,
    keyHash: item.keyHash as string,
    label: item.label as string | undefined,
    createdAt: item.createdAt as string,
    revokedAt: item.revokedAt as string | undefined,
    lastUsedAt: item.lastUsedAt as string | undefined,
  }
}

/**
 * Record the timestamp of a successful API key usage.
 * Fire-and-forget pattern – failures are intentionally swallowed to keep
 * the hot path fast.
 */
export async function touchLastUsed(
  userId: string,
  keyId: string,
  tableName: string,
  region: string,
): Promise<void> {
  const client = getDocClient(region)

  await client.send(new UpdateCommand({
    TableName: tableName,
    Key: { pk: pk(userId), sk: sk(keyId) },
    UpdateExpression: 'SET lastUsedAt = :now',
    ExpressionAttributeValues: { ':now': new Date().toISOString() },
  }))
}

// ─── Analysis Request Types ───────────────────────────────────────────────────

/** Maximum allowed request body size for analysis endpoints (256 KB). */
export const MAX_PAYLOAD_BYTES = 256 * 1024

export interface DiscussionMessage {
  role: string
  content: string
  timestamp?: string
}

export interface DiscussionMetadata {
  model?: string
  channel?: string
  tags?: string[]
}

export type AnalysisType = 'sentiment' | 'toxicity'

export interface AnalysisCallRecord {
  userId: string
  callId: string
  createdAt: string
  type: AnalysisType
  conversationId?: string
  messages: DiscussionMessage[]
  metadata?: DiscussionMetadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: Record<string, any>
}

// ─── Analysis Request Persistence ────────────────────────────────────────────

/**
 * AnalysisRequests table schema
 * -----------------------------------
 * pk  = "USER#<userId>"
 * sk  = "CALL#<ISO-timestamp>#<callId>"
 *
 * Additional attribute:
 *   callId  – stored separately to allow GSI lookup by callId alone.
 *
 * GSI "CallIdIndex":  callId (pk)
 */

function analysisPk(userId: string) {
  return `USER#${userId}`
}

function analysisSk(createdAt: string, callId: string) {
  return `CALL#${createdAt}#${callId}`
}

/**
 * Persist a new analysis call record.
 */
export async function createAnalysisCall(
  userId: string,
  type: AnalysisType,
  messages: DiscussionMessage[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: Record<string, any>,
  tableName: string,
  region: string,
  conversationId?: string,
  metadata?: DiscussionMetadata,
): Promise<AnalysisCallRecord> {
  const client = getDocClient(region)
  const callId = randomUUID()
  const createdAt = new Date().toISOString()

  const record: AnalysisCallRecord = {
    userId,
    callId,
    createdAt,
    type,
    messages,
    results,
    ...(conversationId ? { conversationId } : {}),
    ...(metadata ? { metadata } : {}),
  }

  await client.send(new PutCommand({
    TableName: tableName,
    Item: {
      pk: analysisPk(userId),
      sk: analysisSk(createdAt, callId),
      callId,
      userId,
      createdAt,
      type,
      messages,
      results,
      ...(conversationId ? { conversationId } : {}),
      ...(metadata ? { metadata } : {}),
    },
    ConditionExpression: 'attribute_not_exists(pk)',
  }))

  return record
}

/**
 * List analysis calls for a user, newest first.
 */
export async function listAnalysisCalls(
  userId: string,
  tableName: string,
  region: string,
  limit = 50,
): Promise<AnalysisCallRecord[]> {
  const client = getDocClient(region)

  const result = await client.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': analysisPk(userId),
      ':skPrefix': 'CALL#',
    },
    ScanIndexForward: false,
    Limit: limit,
  }))

  return (result.Items ?? []).map(item => ({
    userId: item.userId as string,
    callId: item.callId as string,
    createdAt: item.createdAt as string,
    type: item.type as AnalysisType,
    conversationId: item.conversationId as string | undefined,
    messages: item.messages as DiscussionMessage[],
    metadata: item.metadata as DiscussionMetadata | undefined,
    results: item.results as Record<string, unknown>,
  }))
}

/**
 * Retrieve a single analysis call by callId using the CallIdIndex GSI.
 * The caller should verify that the returned record belongs to the requesting user.
 */
export async function getAnalysisCallById(
  callId: string,
  tableName: string,
  region: string,
): Promise<AnalysisCallRecord | null> {
  const client = getDocClient(region)

  const result = await client.send(new QueryCommand({
    TableName: tableName,
    IndexName: 'CallIdIndex',
    KeyConditionExpression: 'callId = :callId',
    ExpressionAttributeValues: { ':callId': callId },
    Limit: 1,
  }))

  if (!result.Items || result.Items.length === 0) return null

  const item = result.Items[0]
  return {
    userId: item.userId as string,
    callId: item.callId as string,
    createdAt: item.createdAt as string,
    type: item.type as AnalysisType,
    conversationId: item.conversationId as string | undefined,
    messages: item.messages as DiscussionMessage[],
    metadata: item.metadata as DiscussionMetadata | undefined,
    results: item.results as Record<string, unknown>,
  }
}
