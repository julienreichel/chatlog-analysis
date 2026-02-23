/**
 * useApiKeys composable
 *
 * Wraps API key management endpoints (list, create, revoke).
 * Requires Cognito JWT via useAuth().getIdToken().
 */

export interface ApiKeyMeta {
  keyId: string
  label?: string
  createdAt: string
  lastUsedAt?: string
  isActive: boolean
}

export interface NewKeyResult extends ApiKeyMeta {
  key: string
}

interface UseApiKeys {
  keys: Ref<ApiKeyMeta[]>
  loading: Ref<boolean>
  creating: Ref<boolean>
  revoking: Ref<string | null>
  error: Ref<string>
  fetchKeys: () => Promise<void>
  createKey: (label?: string) => Promise<NewKeyResult>
  revokeKey: (keyId: string) => Promise<void>
}

export function useApiKeys(): UseApiKeys {
  const { getIdToken } = useAuth()
  const keys = ref<ApiKeyMeta[]>([])
  const loading = ref(false)
  const creating = ref(false)
  const revoking = ref<string | null>(null)
  const error = ref('')

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await getIdToken()
    if (!token) throw new Error('Not authenticated')
    return { Authorization: `Bearer ${token}` }
  }

  async function fetchKeys(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const headers = await authHeaders()
      const data = await $fetch<{ keys: ApiKeyMeta[] }>('/api/v1/auth/api-keys', { headers })
      keys.value = data.keys
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to load keys'
    }
    finally {
      loading.value = false
    }
  }

  async function createKey(label?: string): Promise<NewKeyResult> {
    creating.value = true
    error.value = ''
    try {
      const headers = await authHeaders()
      const result = await $fetch<NewKeyResult>('/api/v1/auth/api-keys', {
        method: 'POST',
        headers,
        body: label ? { label } : undefined,
      })
      await fetchKeys()
      return result
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to create key'
      throw err
    }
    finally {
      creating.value = false
    }
  }

  async function revokeKey(keyId: string): Promise<void> {
    revoking.value = keyId
    error.value = ''
    try {
      const headers = await authHeaders()
      await $fetch(`/api/v1/auth/api-keys/${keyId}/revoke`, { method: 'POST', headers })
      await fetchKeys()
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to revoke key'
      throw err
    }
    finally {
      revoking.value = null
    }
  }

  return { keys, loading, creating, revoking, error, fetchKeys, createKey, revokeKey }
}
