<template>
  <UContainer>
    <div class="py-6">
      <h1 class="text-2xl font-bold mb-6">Analysis History</h1>

      <!-- Error alert -->
      <UAlert v-if="error" color="error" :description="error" class="mb-4" />

      <!-- Loading (initial) -->
      <div v-if="loading && groups.length === 0" class="text-center text-gray-400 py-12">Loading history…</div>

      <!-- Empty -->
      <UCard v-else-if="groups.length === 0" class="text-center py-12">
        <p class="text-gray-400">No analysis calls yet.</p>
      </UCard>

      <!-- Discussions table -->
      <template v-else>
        <UTable :data="tableRows" :columns="columns">
          <template #hash-cell="{ row }">
            <NuxtLink
              :to="`/history/${row.original.latestCallId}`"
              class="text-primary underline underline-offset-2 font-mono text-xs"
            >
              {{ row.original.hash }}
            </NuxtLink>
          </template>
          <template #types-cell="{ row }">
            <div class="flex flex-wrap gap-1">
              <UBadge
                v-for="t in row.original.types"
                :key="t"
                color="primary"
                variant="subtle"
                size="xs"
              >
                {{ t }}
              </UBadge>
            </div>
          </template>
          <template #sentiment-cell="{ row }">
            <UBadge
              v-if="row.original.sentiment"
              :color="sentimentColor(row.original.sentiment)"
              variant="subtle"
              size="xs"
            >
              {{ row.original.sentiment }}
            </UBadge>
            <span v-else class="text-gray-400 text-xs">—</span>
          </template>
          <template #maxToxicity-cell="{ row }">
            <UBadge
              v-if="row.original.maxToxicity !== null"
              :color="row.original.maxToxicity > 0.8 ? 'error' : row.original.maxToxicity > 0.5 ? 'warning' : 'success'"
              variant="subtle"
              size="xs"
            >
              {{ pct(row.original.maxToxicity) }}
            </UBadge>
            <span v-else class="text-gray-400 text-xs">—</span>
          </template>
        </UTable>

        <!-- Load More -->
        <div class="mt-4 flex justify-center">
          <UButton
            v-if="hasMore"
            variant="outline"
            :loading="loading"
            @click="loadMore"
          >
            Load more
          </UButton>
          <p v-else class="text-xs text-gray-400">
            All {{ groups.length }} discussion{{ groups.length === 1 ? '' : 's' }} shown
          </p>
        </div>
      </template>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { DiscussionGroup } from '~/composables/useHistory'

definePageMeta({ middleware: 'auth' })

interface DiscussionRow {
  hash: string
  latestCallId: string
  latestCallAt: string
  messageCount: number
  callCount: number
  types: string[]
  sentiment: string | null
  maxToxicity: number | null
}

const { groups, loading, error, hasMore, fetchHistory, loadMore } = useHistory()

const columns: TableColumn<DiscussionRow>[] = [
  { accessorKey: 'hash', header: 'Discussion' },
  { accessorKey: 'latestCallAt', header: 'Latest Analysis' },
  { accessorKey: 'messageCount', header: 'Messages' },
  { accessorKey: 'callCount', header: 'Calls' },
  { accessorKey: 'types', header: 'Analyses' },
  { accessorKey: 'sentiment', header: 'Sentiment' },
  { accessorKey: 'maxToxicity', header: 'Max Toxicity' },
]

function sentimentColor(label: string): 'success' | 'warning' | 'error' | 'neutral' {
  if (label === 'POSITIVE') return 'success'
  if (label === 'NEGATIVE') return 'error'
  if (label === 'MIXED') return 'warning'
  return 'neutral'
}

function pct(score: number): string {
  return `${(score * 100).toFixed(1)}%`
}

function groupToRow(g: DiscussionGroup): DiscussionRow {
  // Use the pre-computed latestCallAt to find the most recent call
  const latestCall = g.calls.find(c => c.createdAt === g.latestCallAt) ?? g.calls[0]!

  // Sentiment overview: dominant from the latest sentiment call
  const sentimentCall = g.calls
    .filter(c => c.type === 'sentiment' && c.results?.summary?.dominant)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))[0]
  const sentiment = sentimentCall?.results?.summary?.dominant ?? null

  // Toxicity overview: max toxicity from the latest toxicity call
  const toxicityCall = g.calls
    .filter(c => c.type === 'toxicity' && c.results?.summary?.maxToxicity != null)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))[0]
  const maxToxicity = toxicityCall?.results?.summary?.maxToxicity ?? null

  return {
    hash: g.discussionHash.slice(0, 8),
    latestCallId: latestCall.callId,
    latestCallAt: new Date(g.latestCallAt).toLocaleString(),
    messageCount: g.messages?.length ?? 0,
    callCount: g.calls.length,
    types: g.types,
    sentiment,
    maxToxicity,
  }
}

const tableRows = computed<DiscussionRow[]>(() => groups.value.map(groupToRow))

onMounted(() => fetchHistory())
</script>

