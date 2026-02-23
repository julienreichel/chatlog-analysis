<template>
  <UContainer>
    <div class="py-6">
      <h1 class="text-2xl font-bold mb-6">Analysis History</h1>

      <!-- Error alert -->
      <UAlert v-if="error" color="error" :description="error" class="mb-4" />

      <!-- Loading -->
      <div v-if="loading" class="text-center text-gray-400 py-12">Loading history…</div>

      <!-- Empty -->
      <UCard v-else-if="calls.length === 0" class="text-center py-12">
        <p class="text-gray-400">No analysis calls yet.</p>
      </UCard>

      <!-- Calls table -->
      <UTable v-else :data="tableRows" :columns="columns">
        <template #requestId-cell="{ row }">
          <NuxtLink
            :to="`/history/${row.original.requestId}`"
            class="text-primary underline underline-offset-2"
          >
            {{ row.original.requestId }}
          </NuxtLink>
        </template>
        <template #status-cell="{ row }">
          <UBadge :color="row.original.statusColor" variant="subtle">
            {{ row.original.status }}
          </UBadge>
        </template>
      </UTable>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ middleware: 'auth' })

interface HistoryRow {
  requestId: string
  createdAt: string
  endpointType: string
  messageCount: number
  status: string
  statusColor: 'success' | 'warning' | 'error' | 'neutral'
  durationMs: string
}

const { calls, loading, error, fetchHistory } = useHistory()

const columns: TableColumn<HistoryRow>[] = [
  { accessorKey: 'requestId', header: 'Request ID' },
  { accessorKey: 'createdAt', header: 'Created' },
  { accessorKey: 'endpointType', header: 'Type' },
  { accessorKey: 'messageCount', header: 'Messages' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'durationMs', header: 'Duration' },
]

const tableRows = computed<HistoryRow[]>(() =>
  calls.value.map(c => ({
    requestId: c.callId,
    createdAt: new Date(c.createdAt).toLocaleString(),
    endpointType: c.type,
    messageCount: c.messages?.length ?? 0,
    status: c.results && Object.keys(c.results).length > 0 ? 'completed' : 'pending',
    statusColor: (c.results && Object.keys(c.results).length > 0 ? 'success' : 'warning') as HistoryRow['statusColor'],
    durationMs: c.results?.durationMs != null ? `${c.results.durationMs} ms` : '—',
  })),
)

onMounted(() => fetchHistory())
</script>
