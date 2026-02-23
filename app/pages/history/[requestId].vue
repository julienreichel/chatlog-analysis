<template>
  <UContainer>
    <div class="py-6">
      <div class="mb-6">
        <NuxtLink to="/history" class="text-sm text-gray-500 hover:text-primary mb-2 inline-block">
          ← Back to history
        </NuxtLink>
        <h1 class="text-2xl font-bold">
          Analysis Detail
        </h1>
        <p v-if="call" class="text-sm text-gray-500 mt-1">
          {{ call.type }} · {{ new Date(call.createdAt).toLocaleString() }} · {{ call.messages?.length ?? 0 }} messages
        </p>
      </div>

      <!-- Error -->
      <UAlert v-if="error" color="error" :description="error" class="mb-4" />

      <!-- Loading -->
      <div v-if="loading" class="text-center text-gray-400 py-12">Loading…</div>

      <template v-else-if="call">
        <!-- Role filter -->
        <div class="flex gap-2 mb-4">
          <UButton
            v-for="opt in roleFilters"
            :key="opt.value"
            :variant="roleFilter === opt.value ? 'solid' : 'outline'"
            size="sm"
            @click="roleFilter = opt.value"
          >
            {{ opt.label }}
          </UButton>
        </div>

        <!-- Summary card -->
        <UCard v-if="hasSummary" class="mb-6">
          <template #header>
            <span class="font-semibold">Aggregated Summary</span>
          </template>
          <template v-if="call.type === 'sentiment' && call.results?.summary">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div v-for="(count, label) in call.results.summary.counts" :key="label" class="text-center">
                <p class="text-2xl font-bold">{{ count }}</p>
                <p class="text-xs text-gray-500 uppercase">{{ label }}</p>
              </div>
            </div>
            <p class="mt-3 text-sm">
              Dominant: <UBadge :color="sentimentColor(call.results.summary.dominant)" variant="subtle">
                {{ call.results.summary.dominant }}
              </UBadge>
            </p>
          </template>
          <template v-else-if="call.type === 'toxicity' && call.results?.summary">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p class="text-2xl font-bold">{{ pct(call.results.summary.maxToxicity) }}</p>
                <p class="text-xs text-gray-500">Max toxicity</p>
              </div>
              <div>
                <p class="text-2xl font-bold">{{ pct(call.results.summary.avgToxicity) }}</p>
                <p class="text-xs text-gray-500">Avg toxicity</p>
              </div>
              <div>
                <p class="text-2xl font-bold">{{ call.results.summary.countAbove50 }}</p>
                <p class="text-xs text-gray-500">Above 50%</p>
              </div>
              <div>
                <p class="text-2xl font-bold">{{ call.results.summary.countAbove80 }}</p>
                <p class="text-xs text-gray-500">Above 80%</p>
              </div>
            </div>
          </template>
        </UCard>

        <!-- Per-message results -->
        <div class="space-y-3">
          <UCard
            v-for="({ msg, originalIdx }) in filteredMessages"
            :key="originalIdx"
            :class="[
              'border-l-4',
              msg.role === 'user' ? 'border-blue-400' : msg.role === 'assistant' ? 'border-purple-400' : 'border-gray-300',
            ]"
          >
            <template #header>
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ msg.role }}</span>
                <span v-if="msg.timestamp" class="text-xs text-gray-400">{{ new Date(msg.timestamp).toLocaleTimeString() }}</span>
              </div>
            </template>
            <p class="text-sm whitespace-pre-wrap">{{ msg.content }}</p>
            <!-- Sentiment result -->
            <template v-if="msgResult(originalIdx)?.sentiment">
              <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <div class="flex items-center gap-2 flex-wrap">
                  <UBadge :color="sentimentColor(msgResult(originalIdx)!.sentiment)" variant="subtle">
                    {{ msgResult(originalIdx)!.sentiment }}
                  </UBadge>
                  <span
                    v-for="(score, label) in msgResult(originalIdx)!.scores"
                    :key="label"
                    class="text-xs text-gray-400"
                  >
                    {{ label }}: {{ pct(score) }}
                  </span>
                </div>
              </div>
            </template>
            <!-- Toxicity result -->
            <template v-if="msgResult(originalIdx)?.toxicityScore !== undefined">
              <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <div class="flex items-center gap-2 flex-wrap">
                  <UBadge
                    :color="msgResult(originalIdx)!.toxicityScore > 0.8 ? 'error' : msgResult(originalIdx)!.toxicityScore > 0.5 ? 'warning' : 'success'"
                    variant="subtle"
                  >
                    Toxicity: {{ pct(msgResult(originalIdx)!.toxicityScore) }}
                  </UBadge>
                  <span
                    v-for="(score, cat) in msgResult(originalIdx)?.categories"
                    :key="cat"
                    :class="['text-xs', score > 0.5 ? 'text-red-500 font-semibold' : 'text-gray-400']"
                  >
                    {{ cat }}: {{ pct(score) }}
                  </span>
                </div>
              </div>
            </template>
          </UCard>
        </div>
      </template>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const requestId = route.params.requestId as string

const { fetchCall } = useHistory()

const call = ref<Awaited<ReturnType<typeof fetchCall>> | null>(null)
const loading = ref(true)
const error = ref('')

type RoleFilter = 'all' | 'user' | 'assistant'
const roleFilter = ref<RoleFilter>('all')

const roleFilters: { label: string; value: RoleFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'User only', value: 'user' },
  { label: 'Assistant only', value: 'assistant' },
]

onMounted(async () => {
  try {
    call.value = await fetchCall(requestId)
  }
  catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to load call'
  }
  finally {
    loading.value = false
  }
})

const filteredMessages = computed(() => {
  if (!call.value?.messages) return []
  const allWithIdx = call.value.messages.map((msg, originalIdx) => ({ msg, originalIdx }))
  if (roleFilter.value === 'all') return allWithIdx
  return allWithIdx.filter(({ msg }) => msg.role === roleFilter.value)
})

const hasSummary = computed(() => !!call.value?.results?.summary)

function msgResult(idx: number) {
  return call.value?.results?.perMessage?.[idx] ?? null
}

function sentimentColor(label: string): 'success' | 'warning' | 'error' | 'neutral' {
  if (label === 'POSITIVE') return 'success'
  if (label === 'NEGATIVE') return 'error'
  if (label === 'MIXED') return 'warning'
  return 'neutral'
}

function pct(score: number): string {
  return `${(score * 100).toFixed(1)}%`
}
</script>
