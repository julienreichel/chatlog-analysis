<template>
  <UContainer>
    <div class="py-6">
      <h1 class="text-2xl font-bold mb-2">LLM Checks</h1>
      <p class="text-gray-500 dark:text-gray-400 text-sm mb-6">
        Configure custom LLM analysis prompts powered by Amazon Bedrock (Nova Lite).
        Each check gets a unique endpoint URI you can call with your API key.
      </p>

      <!-- Error alert -->
      <UAlert v-if="listError" color="error" :description="listError" class="mb-4" />

      <!-- Loading -->
      <div v-if="loading" class="text-center text-gray-400 py-8">Loading checks…</div>

      <!-- Existing checks -->
      <div v-else class="space-y-4 mb-8">
        <UCard v-for="check in checks" :key="check.checkId">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-semibold">{{ check.name }}</span>
              <UButton
                size="xs"
                color="error"
                variant="ghost"
                :loading="deletingId === check.checkId"
                @click="handleDelete(check.checkId)"
              >
                Delete
              </UButton>
            </div>
          </template>

          <div class="space-y-3 text-sm">
            <div>
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Endpoint URI</p>
              <div class="relative">
                <code class="block bg-gray-100 dark:bg-gray-800 rounded p-2 font-mono text-xs break-all pr-16">
                  POST {{ apiBase }}/api/v1/analysis/llm/{{ check.checkId }}
                </code>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="outline"
                  class="absolute top-1 right-1"
                  @click="copyUri(check.checkId)"
                >
                  {{ copiedId === check.checkId ? 'Copied!' : 'Copy' }}
                </UButton>
              </div>
            </div>

            <div>
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Prompt</p>
              <pre class="bg-gray-100 dark:bg-gray-800 rounded p-2 text-xs whitespace-pre-wrap break-words max-h-32 overflow-y-auto">{{ check.prompt }}</pre>
            </div>

            <div v-if="check.outputSchema">
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Output Schema</p>
              <pre class="bg-gray-100 dark:bg-gray-800 rounded p-2 text-xs whitespace-pre-wrap break-words max-h-24 overflow-y-auto">{{ check.outputSchema }}</pre>
            </div>

            <p class="text-xs text-gray-400">Created {{ new Date(check.createdAt).toLocaleString() }}</p>
          </div>

          <!-- Test panel -->
          <template #footer>
            <UCollapsible>
              <UButton size="xs" variant="ghost" color="neutral" class="w-full text-left" trailing-icon="i-lucide-chevron-down">
                Test this check
              </UButton>
              <template #content>
                <div class="pt-3 space-y-3">
                  <UFormField label="API Key" required>
                    <UInput v-model="testApiKey" type="password" placeholder="Your X-API-Key" class="font-mono w-full" />
                  </UFormField>
                  <UFormField label="Messages (JSON array)" required>
                    <UTextarea
                      v-model="testMessages"
                      :rows="4"
                      placeholder='[{"role":"user","content":"Hello!"},{"role":"assistant","content":"Hi there!"}]'
                      class="font-mono w-full text-xs"
                    />
                  </UFormField>
                  <UAlert v-if="testErrors[check.checkId]" color="error" :description="testErrors[check.checkId]" />
                  <UButton
                    size="sm"
                    :loading="testingId === check.checkId"
                    :disabled="!testApiKey || !testMessages"
                    @click="handleTest(check.checkId)"
                  >
                    Run Test
                  </UButton>
                  <div v-if="testResults[check.checkId] !== undefined" class="mt-2">
                    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Result</p>
                    <pre class="bg-gray-100 dark:bg-gray-800 rounded p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-64">{{ testResults[check.checkId] }}</pre>
                  </div>
                </div>
              </template>
            </UCollapsible>
          </template>
        </UCard>

        <UCard v-if="checks.length === 0" class="text-center py-8">
          <p class="text-gray-400">No LLM checks yet. Create one below.</p>
        </UCard>
      </div>

      <!-- Create new check -->
      <UCard>
        <template #header>
          <span class="font-semibold">Create New LLM Check</span>
        </template>

        <div class="space-y-4">
          <!-- Preset selector -->
          <div>
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Start from a preset</p>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="preset in LLM_PRESETS"
                :key="preset.id"
                size="xs"
                variant="outline"
                color="neutral"
                @click="applyPreset(preset)"
              >
                {{ preset.label }}
              </UButton>
            </div>
          </div>

          <UDivider />

          <UFormField label="Name" required>
            <UInput v-model="newName" placeholder="e.g. Compliance Check" class="w-full" />
          </UFormField>

          <UFormField label="Prompt" required>
            <UTextarea
              v-model="newPrompt"
              :rows="6"
              placeholder="Analyse the following conversation and return a JSON object with keys: compliant (boolean), issues (array of strings), score (number 0-100)."
              class="w-full text-sm"
            />
          </UFormField>

          <UFormField label="Output Schema (optional)">
            <UTextarea
              v-model="newOutputSchema"
              :rows="4"
              placeholder='{ "compliant": boolean, "issues": string[], "score": number }'
              class="w-full font-mono text-xs"
            />
          </UFormField>

          <UAlert v-if="createError" color="error" :description="createError" />

          <UButton :loading="creating" :disabled="!newName.trim() || !newPrompt.trim()" @click="handleCreate">
            Create Check
          </UButton>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import type { LlmCheckRecord } from '~/server/utils/dynamodb'
import { LLM_PRESETS } from '~/utils/llmPresets'
import type { LlmPreset } from '~/utils/llmPresets'

definePageMeta({ middleware: 'auth' })

const { getIdToken } = useAuth()

const checks = ref<LlmCheckRecord[]>([])
const loading = ref(false)
const listError = ref('')

const newName = ref('')
const newPrompt = ref('')
const newOutputSchema = ref('')
const creating = ref(false)
const createError = ref('')

const deletingId = ref<string | null>(null)
const copiedId = ref<string | null>(null)

const testApiKey = ref('')
const testMessages = ref('')
const testingId = ref<string | null>(null)
const testResults = ref<Record<string, string>>({})
const testErrors = ref<Record<string, string>>({})

const apiBase = useRequestURL().origin

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken()
  if (!token) throw new Error('Not authenticated')
  return { Authorization: `Bearer ${token}` }
}

async function fetchChecks() {
  loading.value = true
  listError.value = ''
  try {
    const headers = await authHeaders()
    const data = await $fetch<{ checks: LlmCheckRecord[] }>('/api/v1/internal/llm-checks', { headers })
    checks.value = data.checks
  }
  catch (err: unknown) {
    listError.value = err instanceof Error ? err.message : 'Failed to load checks'
  }
  finally {
    loading.value = false
  }
}

async function handleCreate() {
  createError.value = ''
  creating.value = true
  try {
    const headers = await authHeaders()
    const check = await $fetch<LlmCheckRecord>('/api/v1/internal/llm-checks', {
      method: 'POST',
      headers,
      body: {
        name: newName.value.trim(),
        prompt: newPrompt.value.trim(),
        outputSchema: newOutputSchema.value.trim() || undefined,
      },
    })
    checks.value.unshift(check)
    newName.value = ''
    newPrompt.value = ''
    newOutputSchema.value = ''
  }
  catch (err: unknown) {
    createError.value = err instanceof Error ? err.message : 'Failed to create check'
  }
  finally {
    creating.value = false
  }
}

async function handleDelete(checkId: string) {
  deletingId.value = checkId
  try {
    const headers = await authHeaders()
    await $fetch(`/api/v1/internal/llm-checks/${checkId}`, { method: 'DELETE', headers })
    checks.value = checks.value.filter(c => c.checkId !== checkId)
  }
  catch {
    // ignore
  }
  finally {
    deletingId.value = null
  }
}

async function copyUri(checkId: string) {
  await navigator.clipboard.writeText(`POST ${apiBase}/api/v1/analysis/llm/${checkId}`)
  copiedId.value = checkId
  setTimeout(() => (copiedId.value = null), 2000)
}

async function handleTest(checkId: string) {
  testErrors.value = { ...testErrors.value, [checkId]: '' }
  const { [checkId]: _removed, ...rest } = testResults.value
  testResults.value = rest

  let messages: unknown
  try {
    messages = JSON.parse(testMessages.value)
  }
  catch {
    testErrors.value = { ...testErrors.value, [checkId]: 'Invalid JSON in the Messages field.' }
    return
  }

  if (!Array.isArray(messages)) {
    testErrors.value = { ...testErrors.value, [checkId]: 'Messages must be a JSON array.' }
    return
  }

  testingId.value = checkId
  try {
    const res = await fetch(`/api/v1/analysis/llm/${checkId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': testApiKey.value,
      },
      body: JSON.stringify({ messages }),
    })
    const text = await res.text()
    let formatted: string
    try {
      formatted = JSON.stringify(JSON.parse(text), null, 2)
    }
    catch {
      formatted = text
    }
    if (!res.ok) {
      testErrors.value = { ...testErrors.value, [checkId]: `Error ${res.status}: ${formatted}` }
    }
    else {
      testResults.value = { ...testResults.value, [checkId]: formatted }
    }
  }
  catch (err: unknown) {
    testErrors.value = { ...testErrors.value, [checkId]: err instanceof Error ? err.message : 'Request failed' }
  }
  finally {
    testingId.value = null
  }
}

function applyPreset(preset: LlmPreset) {
  newName.value = preset.name
  newPrompt.value = preset.prompt
  newOutputSchema.value = preset.outputSchema
}

onMounted(() => fetchChecks())
</script>
