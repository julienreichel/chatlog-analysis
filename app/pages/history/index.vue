<template>
  <div class="history-page">
    <header class="page-header">
      <div>
        <h1>Analysis History</h1>
        <p class="subtitle">All analysis calls made with your API keys.</p>
      </div>
    </header>

    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <div v-if="loading" class="loading">Loading history…</div>

    <div v-else-if="calls.length === 0" class="empty" data-testid="empty-history">
      No analysis calls yet. Use your API key to call a sentiment or toxicity endpoint.
    </div>

    <table v-else class="history-table">
      <thead>
        <tr>
          <th>Created</th>
          <th>Type</th>
          <th>Messages</th>
          <th>Status</th>
          <th>Duration</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="call in calls" :key="call.callId">
          <td>{{ formatDate(call.createdAt) }}</td>
          <td>
            <span :class="['type-badge', `type-${call.type}`]">{{ call.type }}</span>
          </td>
          <td>{{ call.messageCount }}</td>
          <td><span class="badge-success">completed</span></td>
          <td>{{ formatDuration(call.results) }}</td>
          <td>
            <NuxtLink :to="`/history/${call.callId}`" class="btn-view">View →</NuxtLink>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { calls, loading, errorMsg, fetchHistory } = useHistory()

function formatDate(iso: string) {
  return new Date(iso).toLocaleString()
}

function formatDuration(results: Record<string, unknown>) {
  const ms = results?.durationMs
  if (typeof ms === 'number') return `${ms} ms`
  return '—'
}

onMounted(() => fetchHistory())
</script>

<style scoped>
.history-page {
  max-width: 960px;
  margin: 2rem auto;
  padding: 0 1rem;
}

.page-header {
  margin-bottom: 1.5rem;
}

h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
}

.subtitle {
  color: #6b7280;
  font-size: 0.9rem;
  margin: 0;
}

.error {
  color: #ef4444;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.loading,
.empty {
  color: #6b7280;
  padding: 2rem 0;
  text-align: center;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.history-table th {
  text-align: left;
  padding: 0.625rem 0.75rem;
  border-bottom: 2px solid #e5e7eb;
  font-weight: 600;
  color: #374151;
}

.history-table td {
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid #f3f4f6;
}

.type-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.type-sentiment {
  background: #ede9fe;
  color: #5b21b6;
}

.type-toxicity {
  background: #fee2e2;
  color: #991b1b;
}

.badge-success {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: #d1fae5;
  color: #065f46;
}

.btn-view {
  color: #6366f1;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
}

.btn-view:hover {
  text-decoration: underline;
}
</style>
