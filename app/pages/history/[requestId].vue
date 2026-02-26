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

        <!-- LLM check result card -->
        <UCard v-if="call.type === 'llm' && call.results?.result !== undefined" class="mb-6">
          <template #header>
            <div class="flex items-center gap-2">
              <span class="font-semibold">LLM Analysis Result</span>
              <UBadge v-if="call.results?.checkName" color="primary" variant="subtle">
                {{ call.results.checkName }}
              </UBadge>
            </div>
          </template>

          <!-- Hate speech preset result -->
          <template v-if="detectedPreset === 'hate-speech'">
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <UBadge :color="call.results.result.hasSpeech ? 'error' : 'success'" size="lg">
                  {{ call.results.result.hasSpeech ? 'Hate speech detected' : 'No hate speech' }}
                </UBadge>
                <span class="text-sm text-gray-500">Score: {{ pct(call.results.result.score) }}</span>
              </div>
              <div v-if="call.results.result.categories" class="flex flex-wrap gap-2">
                <UBadge
                  v-for="(active, cat) in call.results.result.categories"
                  :key="cat"
                  :color="active ? 'error' : 'neutral'"
                  variant="subtle"
                >
                  {{ cat }}
                </UBadge>
              </div>
              <div v-if="call.results.result.flags?.length" class="space-y-1">
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Flags</p>
                <ul class="list-disc list-inside text-sm space-y-1">
                  <li v-for="(flag, i) in call.results.result.flags" :key="i">{{ flag }}</li>
                </ul>
              </div>
            </div>
          </template>

          <!-- Jailbreak preset result -->
          <template v-else-if="detectedPreset === 'jailbreak'">
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <UBadge :color="call.results.result.isJailbreak ? 'error' : 'success'" size="lg">
                  {{ call.results.result.isJailbreak ? 'Jailbreak detected' : 'No jailbreak attempt' }}
                </UBadge>
                <span class="text-sm text-gray-500">Confidence: {{ pct(call.results.result.score) }}</span>
              </div>
              <div v-if="call.results.result.techniques?.length" class="flex flex-wrap gap-2">
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide w-full">Techniques</p>
                <UBadge v-for="(t, i) in call.results.result.techniques" :key="i" color="warning" variant="subtle">
                  {{ t }}
                </UBadge>
              </div>
              <p v-if="call.results.result.summary" class="text-sm text-gray-600 dark:text-gray-300">
                {{ call.results.result.summary }}
              </p>
            </div>
          </template>

          <!-- Hallucination preset result -->
          <template v-else-if="detectedPreset === 'hallucination'">
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <UBadge :color="call.results.result.hasHallucination ? 'error' : 'success'" size="lg">
                  {{ call.results.result.hasHallucination ? 'Hallucination detected' : 'No hallucinations' }}
                </UBadge>
                <span class="text-sm text-gray-500">Score: {{ pct(call.results.result.score) }}</span>
              </div>
              <div v-if="call.results.result.instances?.length" class="space-y-2">
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Instances</p>
                <div
                  v-for="(inst, i) in call.results.result.instances"
                  :key="i"
                  class="bg-red-50 dark:bg-red-900/20 rounded p-2 text-sm"
                >
                  <span class="font-medium text-red-600 dark:text-red-400">Message {{ inst.messageIndex + 1 }}:</span>
                  {{ inst.claim }}
                </div>
              </div>
              <p v-if="call.results.result.summary" class="text-sm text-gray-600 dark:text-gray-300">
                {{ call.results.result.summary }}
              </p>
            </div>
          </template>

          <!-- Relevance preset result -->
          <template v-else-if="detectedPreset === 'relevance'">
            <div class="space-y-3">
              <div class="flex items-center gap-3 flex-wrap">
                <UBadge :color="call.results.result.relevant ? 'success' : 'error'" size="lg">
                  {{ call.results.result.relevant ? 'Relevant' : 'Not relevant' }}
                </UBadge>
                <UBadge :color="call.results.result.helpful ? 'success' : 'warning'" variant="subtle">
                  {{ call.results.result.helpful ? 'Helpful' : 'Not helpful' }}
                </UBadge>
                <span class="text-sm text-gray-500">Score: {{ pct(call.results.result.score) }}</span>
              </div>
              <div v-if="call.results.result.issues?.length" class="space-y-1">
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Issues</p>
                <ul class="list-disc list-inside text-sm space-y-1">
                  <li v-for="(issue, i) in call.results.result.issues" :key="i">{{ issue }}</li>
                </ul>
              </div>
              <p v-if="call.results.result.summary" class="text-sm text-gray-600 dark:text-gray-300">
                {{ call.results.result.summary }}
              </p>
            </div>
          </template>

          <!-- Addiction preset result -->
          <template v-else-if="detectedPreset === 'addiction'">
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <UBadge :color="call.results.result.hasDependency ? 'error' : 'success'" size="lg">
                  {{ call.results.result.hasDependency ? 'Dependency detected' : 'No dependency patterns' }}
                </UBadge>
                <span class="text-sm text-gray-500">Score: {{ pct(call.results.result.score) }}</span>
              </div>
              <div v-if="call.results.result.patterns?.length" class="flex flex-wrap gap-2">
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide w-full">Patterns</p>
                <UBadge v-for="(p, i) in call.results.result.patterns" :key="i" color="warning" variant="subtle">
                  {{ p }}
                </UBadge>
              </div>
              <p v-if="call.results.result.summary" class="text-sm text-gray-600 dark:text-gray-300">
                {{ call.results.result.summary }}
              </p>
            </div>
          </template>

          <!-- Fallback: raw JSON -->
          <template v-else>
            <pre class="bg-gray-100 dark:bg-gray-800 rounded p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">{{ JSON.stringify(call.results.result, null, 2) }}</pre>
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
import { detectPreset } from '~/utils/llmPresets'

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

const hasSummary = computed(() => call.value?.type !== 'llm' && !!call.value?.results?.summary)

const detectedPreset = computed(() => {
  if (call.value?.type !== 'llm') return null
  return detectPreset(call.value?.results?.result)
})

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
