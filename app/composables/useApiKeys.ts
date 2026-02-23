/**
 * useApiKeys composable
 *
 * Wraps API key management: list, create, revoke.
 * Calls are authenticated via Cognito Bearer token.
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
  errorMsg: Ref<string>
  newKey: Ref<NewKeyResult | null>
  fetchKeys: () => Promise<void>
  createKey: () => Promise<void>
  revokeKey: (keyId: string) => Promise<void>
}

export function useApiKeys(): UseApiKeys {
  const { getIdToken } = useAuth()

  const keys = ref<ApiKeyMeta[]>([])
  const loading = ref(false)
  const creating = ref(false)
  const revoking = ref<string | null>(null)
  const errorMsg = ref('')
  const newKey = ref<NewKeyResult | null>(null)

  async function authHeaders() {
    const token = await getIdToken()
    if (!token) throw new Error('Not authenticated')
    return { Authorization: `Bearer ${token}` }
  }

  async function fetchKeys() {
    loading.value = true
    errorMsg.value = ''
    try {
      const headers = await authHeaders()
      const data = await $fetch<{ keys: ApiKeyMeta[] }>('/api/v1/auth/api-keys', { headers })
      keys.value = data.keys
    }
    catch (err: unknown) {
      errorMsg.value = err instanceof Error ? err.message : 'Failed to load keys'
    }
    finally {
      loading.value = false
    }
  }

  async function createKey() {
    creating.value = true
    errorMsg.value = ''
    newKey.value = null
    try {
      const headers = await authHeaders()
      const result = await $fetch<NewKeyResult>('/api/v1/auth/api-keys', {
        method: 'POST',
        headers,
      })
      newKey.value = result
      await fetchKeys()
    }
    catch (err: unknown) {
      errorMsg.value = err instanceof Error ? err.message : 'Failed to create key'
    }
    finally {
      creating.value = false
    }
  }

  async function revokeKey(keyId: string) {
    revoking.value = keyId
    errorMsg.value = ''
    try {
      const headers = await authHeaders()
      await $fetch(`/api/v1/auth/api-keys/${keyId}/revoke`, { method: 'POST', headers })
      await fetchKeys()
    }
    catch (err: unknown) {
      errorMsg.value = err instanceof Error ? err.message : 'Failed to revoke key'
    }
    finally {
      revoking.value = null
    }
  }

  return { keys, loading, creating, revoking, errorMsg, newKey, fetchKeys, createKey, revokeKey }
}
