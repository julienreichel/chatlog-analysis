/**
 * useHistory composable
 *
 * Wraps analysis call history endpoints (list, detail).
 * Requires Cognito JWT via useAuth().getIdToken().
 */
import type { AnalysisCallRecord, DiscussionGroup } from '~/server/utils/dynamodb'

export type { AnalysisCallRecord, DiscussionGroup }

interface UseHistory {
  groups: Ref<DiscussionGroup[]>
  loading: Ref<boolean>
  error: Ref<string>
  hasMore: Ref<boolean>
  fetchHistory: (limit?: number) => Promise<void>
  loadMore: () => Promise<void>
  fetchCall: (requestId: string) => Promise<AnalysisCallRecord>
}

export function useHistory(): UseHistory {
  const { getIdToken } = useAuth()
  const groups = ref<DiscussionGroup[]>([])
  const loading = ref(false)
  const error = ref('')
  const _cursor = ref<string | undefined>(undefined)
  const hasMore = ref(false)
  let _limit = 20

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await getIdToken()
    if (!token) throw new Error('Not authenticated')
    return { Authorization: `Bearer ${token}` }
  }

  async function fetchHistory(limit = 20): Promise<void> {
    _limit = limit
    loading.value = true
    error.value = ''
    try {
      const headers = await authHeaders()
      const data = await $fetch<{ groups: DiscussionGroup[], nextCursor?: string }>(
        '/api/v1/internal/history',
        { headers, query: { limit } },
      )
      groups.value = data.groups
      _cursor.value = data.nextCursor
      hasMore.value = !!data.nextCursor
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to load history'
    }
    finally {
      loading.value = false
    }
  }

  async function loadMore(): Promise<void> {
    if (!_cursor.value || loading.value) return
    loading.value = true
    error.value = ''
    try {
      const headers = await authHeaders()
      const data = await $fetch<{ groups: DiscussionGroup[], nextCursor?: string }>(
        '/api/v1/internal/history',
        { headers, query: { limit: _limit, cursor: _cursor.value } },
      )
      // Merge new groups, combining any that share a hash with existing ones
      const existingMap = new Map(groups.value.map(g => [g.discussionHash, g]))
      for (const g of data.groups) {
        const existing = existingMap.get(g.discussionHash)
        if (existing) {
          existing.calls.push(...g.calls)
          for (const t of g.types) {
            if (!existing.types.includes(t)) existing.types.push(t)
          }
          if (g.latestCallAt > existing.latestCallAt) {
            existing.latestCallAt = g.latestCallAt
          }
        }
        else {
          existingMap.set(g.discussionHash, g)
          groups.value.push(g)
        }
      }
      _cursor.value = data.nextCursor
      hasMore.value = !!data.nextCursor
    }
    catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to load more history'
    }
    finally {
      loading.value = false
    }
  }

  async function fetchCall(requestId: string): Promise<AnalysisCallRecord> {
    const headers = await authHeaders()
    return await $fetch<AnalysisCallRecord>(`/api/v1/internal/history/${requestId}`, { headers })
  }

  return { groups, loading, error, hasMore, fetchHistory, loadMore, fetchCall }
}
