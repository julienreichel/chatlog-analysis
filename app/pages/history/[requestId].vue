<template>
  <div class="detail-page">
    <div class="page-header">
      <NuxtLink to="/history" class="back-link">← Back to History</NuxtLink>
      <h1>Analysis Detail</h1>
    </div>

    <div v-if="loading" class="loading">Loading…</div>
    <div v-else-if="!call" class="empty" data-testid="empty-detail">Call not found.</div>

    <template v-else>
      <!-- Summary card -->
      <section class="card summary-card">
        <h2>Summary</h2>
        <dl class="summary-grid">
          <div>
            <dt>Type</dt>
            <dd><span :class="['type-badge', `type-${call.type}`]">{{ call.type }}</span></dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{{ formatDate(call.createdAt) }}</dd>
          </div>
          <div>
            <dt>Messages</dt>
            <dd>{{ call.messageCount }}</dd>
          </div>
          <div v-if="call.conversationId">
            <dt>Conversation ID</dt>
            <dd><code>{{ call.conversationId }}</code></dd>
          </div>
        </dl>

        <!-- Sentiment aggregate -->
        <template v-if="call.type === 'sentiment' && call.results?.summary">
          <div class="agg-section">
            <h3>Aggregate Sentiment</h3>
            <p><strong>Dominant:</strong> {{ call.results.summary.dominant }}</p>
            <div class="counts-row" data-testid="sentiment-counts">
              <span
                v-for="(count, label) in call.results.summary.counts"
                :key="label"
                class="count-chip"
              >{{ label }}: {{ count }}</span>
            </div>
            <div v-if="call.results.summary.avgScores" class="avg-row">
              <span
                v-for="(score, label) in call.results.summary.avgScores"
                :key="label"
                class="score-chip"
              >avg {{ label }}: {{ formatScore(score as number) }}</span>
            </div>
          </div>
        </template>

        <!-- Toxicity aggregate -->
        <template v-if="call.type === 'toxicity' && call.results?.summary">
          <div class="agg-section">
            <h3>Aggregate Toxicity</h3>
            <div class="counts-row" data-testid="toxicity-summary">
              <span class="count-chip">Max: {{ formatScore(call.results.summary.maxToxicity) }}</span>
              <span class="count-chip">Avg: {{ formatScore(call.results.summary.avgToxicity) }}</span>
          <span
            v-if="call.results.summary.countAbove50 > 0"
            class="count-chip warn"
          >
            ⚠ {{ call.results.summary.countAbove50 }} above 50%
          </span>
              <span
            v-if="call.results.summary.countAbove80 > 0"
            class="count-chip danger"
          >
            🚨 {{ call.results.summary.countAbove80 }} above 80%
          </span>
            </div>
          </div>
        </template>
      </section>

      <!-- Filter bar -->
      <div class="filter-bar">
        <span class="filter-label">Filter:</span>
        <button
          v-for="f in filters"
          :key="f.value"
          :class="['filter-btn', activeFilter === f.value ? 'active' : '']"
          @click="activeFilter = f.value"
        >
          {{ f.label }}
        </button>
      </div>

      <!-- Messages -->
      <section class="messages-section">
        <h2>Conversation</h2>
        <div v-if="filteredMessages.length === 0" class="empty" data-testid="empty-messages">
          No messages match the current filter.
        </div>
        <div
          v-for="(msg, idx) in filteredMessages"
          :key="idx"
          :class="['message-card', `role-${msg.role}`]"
        >
          <div class="message-header">
            <span class="role-badge">{{ msg.role }}</span>
            <span v-if="msg.timestamp" class="msg-time">{{ formatDate(msg.timestamp) }}</span>
          </div>
          <p class="message-content">{{ msg.content }}</p>

          <!-- Sentiment result for this message -->
          <template v-if="call.type === 'sentiment'">
            <div v-if="getMessageResult(idx)" class="result-section">
              <span :class="['sentiment-label', `sentiment-${getMessageResult(idx)?.sentiment?.toLowerCase()}`]">
                {{ getMessageResult(idx)?.sentiment }}
              </span>
              <div v-if="getMessageResult(idx)?.scores" class="scores-row">
                <span
                  v-for="(score, label) in getMessageResult(idx)?.scores"
                  :key="label"
                  class="score-chip"
                >{{ label }}: {{ formatScore(score as number) }}</span>
              </div>
            </div>
          </template>

          <!-- Toxicity result for this message -->
          <template v-if="call.type === 'toxicity'">
            <div v-if="getMessageResult(idx)" class="result-section">
              <div class="toxicity-row">
                <span
                  v-for="(score, label) in getMessageResult(idx)?.toxicityScores"
                  :key="label"
                  :class="['tox-chip', (score as number) > 0.8 ? 'tox-danger' : (score as number) > 0.5 ? 'tox-warn' : '']"
                >{{ label }}: {{ formatScore(score as number) }}</span>
              </div>
              <div v-if="getMessageResult(idx)?.overallToxicity !== undefined" class="overall-tox">
                Overall:
                <strong :class="overallClass(getMessageResult(idx)?.overallToxicity as number)">
                  {{ formatScore(getMessageResult(idx)?.overallToxicity as number) }}
                </strong>
              </div>
            </div>
          </template>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { HistoryRecord } from '~/composables/useHistory'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const requestId = route.params.requestId as string

const { fetchCall } = useHistory()

const call = ref<HistoryRecord | null>(null)
const loading = ref(true)

type FilterValue = 'all' | 'user' | 'assistant'
const activeFilter = ref<FilterValue>('all')
const filters: Array<{ label: string, value: FilterValue }> = [
  { label: 'All', value: 'all' },
  { label: 'User only', value: 'user' },
  { label: 'Assistant only', value: 'assistant' },
]

const filteredMessages = computed(() => {
  if (!call.value) return []
  const msgs = call.value.messages ?? []
  if (activeFilter.value === 'all') return msgs
  return msgs.filter(m => m.role === activeFilter.value)
})

function getMessageResult(idx: number) {
  if (!call.value) return null
  const perMessage = call.value.results?.perMessage
  if (!Array.isArray(perMessage)) return null
  return perMessage[idx] ?? null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString()
}

function formatScore(n: number) {
  return typeof n === 'number' ? (n * 100).toFixed(1) + '%' : '—'
}

function overallClass(score: number) {
  if (score > 0.8) return 'tox-danger'
  if (score > 0.5) return 'tox-warn'
  return ''
}

onMounted(async () => {
  call.value = await fetchCall(requestId)
  loading.value = false
})
</script>

<style scoped>
.detail-page {
  max-width: 860px;
  margin: 2rem auto;
  padding: 0 1rem;
}

.page-header {
  margin-bottom: 1.5rem;
}

.back-link {
  color: #6366f1;
  text-decoration: none;
  font-size: 0.875rem;
  display: inline-block;
  margin-bottom: 0.5rem;
}

.back-link:hover {
  text-decoration: underline;
}

h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

h2 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 1rem;
}

h3 {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0.75rem 0 0.5rem;
  color: #374151;
}

.loading,
.empty {
  color: #6b7280;
  padding: 2rem 0;
  text-align: center;
}

.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1.25rem;
  margin-bottom: 1.25rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.75rem;
  margin: 0 0 0.5rem;
}

.summary-grid dt {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #9ca3af;
  letter-spacing: 0.05em;
  margin-bottom: 0.2rem;
}

.summary-grid dd {
  margin: 0;
  font-weight: 500;
}

.agg-section {
  border-top: 1px solid #f3f4f6;
  padding-top: 0.75rem;
  margin-top: 0.75rem;
}

.counts-row,
.avg-row,
.toxicity-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.375rem;
}

.count-chip,
.score-chip {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: #f3f4f6;
  color: #374151;
}

.count-chip.warn {
  background: #fef3c7;
  color: #92400e;
}

.count-chip.danger {
  background: #fee2e2;
  color: #991b1b;
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

.filter-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.filter-label {
  font-size: 0.875rem;
  color: #6b7280;
}

.filter-btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 9999px;
  background: #fff;
  font-size: 0.8rem;
  cursor: pointer;
  color: #374151;
}

.filter-btn:hover {
  background: #f9fafb;
}

.filter-btn.active {
  background: #6366f1;
  color: #fff;
  border-color: #6366f1;
}

.messages-section h2 {
  margin-bottom: 0.75rem;
}

.message-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 0.75rem;
}

.role-user {
  border-left: 3px solid #6366f1;
}

.role-assistant {
  border-left: 3px solid #10b981;
}

.role-system {
  border-left: 3px solid #9ca3af;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.role-badge {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  background: #f3f4f6;
  color: #374151;
}

.msg-time {
  font-size: 0.75rem;
  color: #9ca3af;
}

.message-content {
  margin: 0;
  font-size: 0.9rem;
  color: #1f2937;
  line-height: 1.5;
  white-space: pre-wrap;
}

.result-section {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed #e5e7eb;
}

.sentiment-label {
  display: inline-block;
  padding: 0.125rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 700;
  margin-bottom: 0.375rem;
}

.sentiment-positive {
  background: #d1fae5;
  color: #065f46;
}

.sentiment-negative {
  background: #fee2e2;
  color: #991b1b;
}

.sentiment-neutral {
  background: #f3f4f6;
  color: #374151;
}

.sentiment-mixed {
  background: #fef3c7;
  color: #92400e;
}

.tox-chip {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: #f3f4f6;
  color: #374151;
}

.tox-warn {
  background: #fef3c7;
  color: #92400e;
}

.tox-danger {
  background: #fee2e2;
  color: #991b1b;
}

.overall-tox {
  margin-top: 0.375rem;
  font-size: 0.875rem;
  color: #374151;
}
</style>
