/**
 * useHistory composable
 *
 * Wraps analysis call history endpoints (list, detail).
 * Requires Cognito JWT via useAuth().getIdToken().
 */
import type { AnalysisCallRecord } from '~/server/utils/dynamodb'

export type { AnalysisCallRecord }

interface UseHistory {
  calls: Ref<AnalysisCallRecord[]>
  loading: Ref<boolean>
  error: Ref<string>
  fetchHistory: (limit?: number) => Promise<void>
  fetchCall: (requestId: string) => Promise<AnalysisCallRecord>
}

export function useHistory(): UseHistory {
  const { getIdToken } = useAuth()
  const calls = ref<AnalysisCallRecord[]>([])
  const loading = ref(false)
  const error = ref('')

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await getIdToken()
    if (!token) throw new Error('Not authenticated')
    return { Authorization: `Bearer ${token}` }
  }

  async function fetchHistory(limit = 50): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const headers = await authHeaders()
      const data = await $fetch<{ calls: AnalysisCallRecord[] }>('/api/v1/internal/history', {
        headers,
        query: { limit },
      })
      calls.value = data.calls
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to load history'
    }
    finally {
      loading.value = false
    }
  }

  async function fetchCall(requestId: string): Promise<AnalysisCallRecord> {
    const headers = await authHeaders()
    return await $fetch<AnalysisCallRecord>(`/api/v1/internal/history/${requestId}`, { headers })
  }

  return { calls, loading, error, fetchHistory, fetchCall }
}
