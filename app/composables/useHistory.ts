/**
 * useHistory composable
 *
 * Wraps analysis call history fetching.
 * Calls are authenticated via Cognito Bearer token.
 */

export interface HistoryRecord {
  callId: string
  userId: string
  createdAt: string
  type: 'sentiment' | 'toxicity'
  conversationId?: string
  messageCount: number
  results: Record<string, unknown>
  messages: Array<{ role: string, content: string, timestamp?: string }>
  metadata?: { model?: string, channel?: string, tags?: string[] }
}

interface UseHistory {
  calls: Ref<HistoryRecord[]>
  loading: Ref<boolean>
  errorMsg: Ref<string>
  fetchHistory: (limit?: number) => Promise<void>
  fetchCall: (callId: string) => Promise<HistoryRecord | null>
}

export function useHistory(): UseHistory {
  const { getIdToken } = useAuth()

  const calls = ref<HistoryRecord[]>([])
  const loading = ref(false)
  const errorMsg = ref('')

  async function authHeaders() {
    const token = await getIdToken()
    if (!token) throw new Error('Not authenticated')
    return { Authorization: `Bearer ${token}` }
  }

  async function fetchHistory(limit = 50) {
    loading.value = true
    errorMsg.value = ''
    try {
      const headers = await authHeaders()
      const data = await $fetch<{ calls: Array<Omit<HistoryRecord, 'messageCount'> & { messages: HistoryRecord['messages'] }> }>(
        `/api/v1/auth/calls?limit=${limit}`,
        { headers },
      )
      calls.value = data.calls.map(c => ({
        ...c,
        messageCount: c.messages?.length ?? 0,
      }))
    }
    catch (err: unknown) {
      errorMsg.value = err instanceof Error ? err.message : 'Failed to load history'
    }
    finally {
      loading.value = false
    }
  }

  async function fetchCall(callId: string): Promise<HistoryRecord | null> {
    try {
      const headers = await authHeaders()
      const data = await $fetch<Omit<HistoryRecord, 'messageCount'> & { messages: HistoryRecord['messages'] }>(
        `/api/v1/auth/calls/${callId}`,
        { headers },
      )
      return { ...data, messageCount: data.messages?.length ?? 0 }
    }
    catch {
      return null
    }
  }

  return { calls, loading, errorMsg, fetchHistory, fetchCall }
}
