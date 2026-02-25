<template>
  <UContainer>
    <div class="py-6">
      <h1 class="text-2xl font-bold mb-2">API Reference</h1>
      <p class="text-gray-500 dark:text-gray-400 text-sm mb-8">
        Explore available endpoints, copy curl commands, and try calls directly from your browser.
        All endpoints require an <code>X-API-Key</code> header.
      </p>

      <!-- Endpoint cards -->
      <div class="flex flex-col gap-6 mb-10">
        <UCard v-for="endpoint in endpoints" :key="endpoint.type">
          <template #header>
            <div class="flex items-center gap-3">
              <UBadge color="primary" variant="solid" class="font-mono text-xs">POST</UBadge>
              <code class="font-mono text-sm font-semibold">{{ endpoint.path }}</code>
            </div>
          </template>

          <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">{{ endpoint.description }}</p>

          <div class="mb-3">
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Request body fields
            </p>
            <ul class="text-sm space-y-1">
              <li v-for="field in endpoint.fields" :key="field.name">
                <code class="text-primary font-mono">{{ field.name }}</code>
                <span class="text-gray-500 dark:text-gray-400 ml-1 text-xs">{{ field.required ? '(required)' : '(optional)' }}</span>
                <span class="text-gray-600 dark:text-gray-300 ml-1">— {{ field.description }}</span>
              </li>
            </ul>
          </div>

          <!-- Curl command -->
          <div>
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Curl example
            </p>
            <div class="relative">
              <pre class="bg-gray-100 dark:bg-gray-800 rounded p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all pr-20">{{ buildCurl(endpoint.type) }}</pre>
              <UButton
                size="xs"
                color="neutral"
                variant="outline"
                class="absolute top-2 right-2"
                @click="copyCurl(endpoint.type)"
              >
                {{ copiedEndpoint === endpoint.type ? 'Copied!' : 'Copy' }}
              </UButton>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Try it out -->
      <h2 class="text-xl font-bold mb-4">Try it out</h2>
      <UCard>
        <div class="flex flex-col gap-4">
          <!-- API key input -->
          <UFormField label="API Key" required>
            <UInput
              v-model="tryApiKey"
              type="password"
              placeholder="Your X-API-Key"
              class="font-mono w-full"
            />
          </UFormField>

          <!-- Endpoint selector -->
          <UFormField label="Endpoint">
            <USelect
              v-model="tryEndpoint"
              :items="endpointOptions"
              class="w-full"
            />
          </UFormField>

          <!-- Messages JSON -->
          <UFormField label="Messages (JSON array)" required>
            <UTextarea
              v-model="tryMessages"
              :rows="6"
              placeholder='[{"role":"user","content":"Hello, how are you?"},{"role":"assistant","content":"I am fine, thanks!"}]'
              class="font-mono w-full text-xs"
            />
          </UFormField>

          <!-- Optional fields -->
          <UFormField label="Conversation ID (optional)">
            <UInput v-model="tryConversationId" placeholder="my-conversation-id" class="w-full" />
          </UFormField>

          <!-- Error alert -->
          <UAlert v-if="tryError" color="error" :description="tryError" />

          <UButton :loading="trying" :disabled="!tryApiKey || !tryMessages" @click="handleTry">
            Send Request
          </UButton>
        </div>

        <!-- Response -->
        <div v-if="tryResponse !== null" class="mt-6">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold">
              Response
              <UBadge
                :color="tryStatusOk ? 'success' : 'error'"
                variant="subtle"
                class="ml-2"
              >
                {{ tryStatus }}
              </UBadge>
            </p>
            <UButton size="xs" color="neutral" variant="outline" @click="copyResponse">
              {{ copiedResponse ? 'Copied!' : 'Copy' }}
            </UButton>
          </div>
          <pre class="bg-gray-100 dark:bg-gray-800 rounded p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-96">{{ tryResponse }}</pre>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

// ─── Endpoint definitions ─────────────────────────────────────────────────────

type EndpointType = 'sentiment' | 'toxicity'

interface EndpointField {
  name: string
  required: boolean
  description: string
}

interface EndpointDef {
  type: EndpointType
  path: string
  description: string
  fields: EndpointField[]
}

const endpoints: EndpointDef[] = [
  {
    type: 'sentiment',
    path: '/api/v1/analysis/sentiment',
    description: 'Analyzes the sentiment of each message (POSITIVE, NEGATIVE, NEUTRAL, MIXED) using Amazon Comprehend, and returns a per-message breakdown plus an aggregated summary.',
    fields: [
      { name: 'messages', required: true, description: 'Array of { role, content, timestamp? } objects.' },
      { name: 'languageCode', required: false, description: 'BCP-47 language code (default: "en").' },
      { name: 'conversationId', required: false, description: 'Client-supplied identifier for the conversation.' },
      { name: 'model', required: false, description: 'Name of the LLM model used to generate messages.' },
      { name: 'channel', required: false, description: 'Channel name (e.g. "chat", "email").' },
      { name: 'tags', required: false, description: 'Array of string tags for filtering in history.' },
    ],
  },
  {
    type: 'toxicity',
    path: '/api/v1/analysis/toxicity',
    description: 'Analyzes the toxicity of each message using Amazon Comprehend DetectToxicContent, and returns a per-message toxicity score plus an aggregated summary.',
    fields: [
      { name: 'messages', required: true, description: 'Array of { role, content, timestamp? } objects.' },
      { name: 'conversationId', required: false, description: 'Client-supplied identifier for the conversation.' },
      { name: 'model', required: false, description: 'Name of the LLM model used to generate messages.' },
      { name: 'channel', required: false, description: 'Channel name (e.g. "chat", "email").' },
      { name: 'tags', required: false, description: 'Array of string tags for filtering in history.' },
    ],
  },
]

const endpointOptions = endpoints.map(e => ({ label: e.path, value: e.type }))

// ─── Curl command builder ─────────────────────────────────────────────────────

const SAMPLE_PAYLOAD = JSON.stringify(
  {
    messages: [
      { role: 'user', content: 'I love this platform. The response time is excellent.' },
      { role: 'assistant', content: 'Thank you! I am happy to help.' },
    ],
  },
  null,
  2,
)

const defaultApiBaseUrl = useRequestURL().origin

function buildCurl(type: EndpointType, baseUrl = defaultApiBaseUrl, apiKey = '<YOUR_API_KEY>'): string {
  return `curl -X POST ${baseUrl}/api/v1/analysis/${type} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '${SAMPLE_PAYLOAD.replace(/'/g, "'\\''")}'`
}

const copiedEndpoint = ref<EndpointType | null>(null)

async function copyCurl(type: EndpointType) {
  await navigator.clipboard.writeText(buildCurl(type))
  copiedEndpoint.value = type
  setTimeout(() => (copiedEndpoint.value = null), 2000)
}

// ─── Try it out ───────────────────────────────────────────────────────────────

const tryApiKey = ref('')
const tryEndpoint = ref<EndpointType>('sentiment')
const tryMessages = ref('')
const tryConversationId = ref('')
const trying = ref(false)
const tryError = ref('')
const tryResponse = ref<string | null>(null)
const tryStatus = ref<number | null>(null)
const tryStatusOk = ref(false)
const copiedResponse = ref(false)

async function handleTry() {
  tryError.value = ''
  tryResponse.value = null
  tryStatus.value = null

  let messages: unknown
  try {
    messages = JSON.parse(tryMessages.value)
  }
  catch {
    tryError.value = 'Invalid JSON in the Messages field.'
    return
  }

  if (!Array.isArray(messages)) {
    tryError.value = 'Messages must be a JSON array.'
    return
  }

  trying.value = true
  try {
    const body: Record<string, unknown> = { messages }
    if (tryConversationId.value) body.conversationId = tryConversationId.value

    const res = await fetch(`/api/v1/analysis/${tryEndpoint.value}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': tryApiKey.value,
      },
      body: JSON.stringify(body),
    })

    tryStatus.value = res.status
    tryStatusOk.value = res.ok

    const text = await res.text()
    try {
      tryResponse.value = JSON.stringify(JSON.parse(text), null, 2)
    }
    catch {
      tryResponse.value = text
    }
  }
  catch (err: unknown) {
    tryError.value = err instanceof Error ? err.message : 'Request failed'
  }
  finally {
    trying.value = false
  }
}

async function copyResponse() {
  if (tryResponse.value === null) return
  await navigator.clipboard.writeText(tryResponse.value)
  copiedResponse.value = true
  setTimeout(() => (copiedResponse.value = false), 2000)
}
</script>
