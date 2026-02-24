<template>
  <UContainer>
    <div class="py-6">
      <div class="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold">API Keys</h1>
          <p class="text-gray-500 text-sm mt-1">
            Use these keys in the <code>X-API-Key</code> header to call analysis endpoints.
          </p>
        </div>
        <UButton :loading="creating" @click="handleCreate">
          Generate new key
        </UButton>
      </div>

      <!-- New key banner -->
      <UCard v-if="newKey" class="mb-6 border border-green-300 bg-green-50 dark:bg-green-950">
        <template #header>
          <p class="font-semibold text-green-800 dark:text-green-200">
            🔑 Copy your new API key now — it will not be shown again.
          </p>
        </template>
        <div class="flex items-center gap-3 flex-wrap">
          <code class="bg-white dark:bg-gray-900 border border-green-200 px-3 py-1.5 rounded text-sm break-all flex-1">
            {{ newKey.key }}
          </code>
          <UButton size="sm" color="success" variant="outline" @click="copyKey(newKey!.key)">
            {{ copied ? 'Copied!' : 'Copy' }}
          </UButton>
        </div>
        <template #footer>
          <UButton size="sm" variant="ghost" color="neutral" @click="newKey = null">
            Dismiss
          </UButton>
        </template>
      </UCard>

      <!-- Error alert -->
      <UAlert v-if="errorMsg" color="error" :description="errorMsg" class="mb-4" />

      <!-- Loading -->
      <div v-if="loading" class="text-center text-gray-400 py-12">Loading keys…</div>

      <!-- Empty -->
      <UCard v-else-if="keys.length === 0" class="text-center py-12">
        <p class="text-gray-400">No API keys yet. Generate one above.</p>
      </UCard>

      <!-- Keys table -->
      <UTable v-else :data="tableRows" :columns="columns">
        <template #status-cell="{ row }">
          <UBadge :color="row.original.isActive ? 'success' : 'error'" variant="subtle">
            {{ row.original.isActive ? 'Active' : 'Revoked' }}
          </UBadge>
        </template>
        <template #actions-cell="{ row }">
          <UButton
            v-if="row.original.isActive"
            size="xs"
            color="error"
            variant="outline"
            :loading="revoking === row.original.keyId"
            @click="handleRevoke(row.original.keyId)"
          >
            Revoke
          </UButton>
        </template>
      </UTable>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ middleware: 'auth' })

interface ApiKeyMeta {
  keyId: string
  label?: string
  createdAt: string
  lastUsedAt?: string
  isActive: boolean
}

interface NewKeyResult extends ApiKeyMeta {
  key: string
}

interface ApiKeyRow {
  keyId: string
  label: string
  createdAt: string
  lastUsedAt: string
  isActive: boolean
}

const { getIdToken } = useAuth()

const keys = ref<ApiKeyMeta[]>([])
const loading = ref(false)
const creating = ref(false)
const revoking = ref<string | null>(null)
const errorMsg = ref('')
const newKey = ref<NewKeyResult | null>(null)
const copied = ref(false)

const columns: TableColumn<ApiKeyRow>[] = [
  { accessorKey: 'keyId', header: 'Key ID' },
  { accessorKey: 'label', header: 'Label' },
  { accessorKey: 'createdAt', header: 'Created' },
  { accessorKey: 'lastUsedAt', header: 'Last used' },
  { id: 'status', header: 'Status' },
  { id: 'actions', header: '' },
]

const tableRows = computed<ApiKeyRow[]>(() =>
  keys.value.map(k => ({
    keyId: k.keyId.slice(0, 8) + '…',
    label: k.label ?? '—',
    createdAt: formatDate(k.createdAt),
    lastUsedAt: k.lastUsedAt ? formatDate(k.lastUsedAt) : 'Never',
    isActive: k.isActive,
  })),
)

async function authHeaders() {
  const token = await getIdToken()
  if (!token) throw new Error('Not authenticated')
  return { Authorization: `Bearer ${token}` }
}

async function fetchKeys() {
  loading.value = true
  errorMsg.value = ''
  try {
    const headers = await authHeaders()
    const data = await $fetch<{ keys: ApiKeyMeta[] }>('/api/v1/auth/api-keys', { headers })
    keys.value = data.keys
  }
  catch (err: unknown) {
    errorMsg.value = err instanceof Error ? err.message : 'Failed to load keys'
  }
  finally {
    loading.value = false
  }
}

async function handleCreate() {
  creating.value = true
  errorMsg.value = ''
  newKey.value = null
  try {
    const headers = await authHeaders()
    const result = await $fetch<NewKeyResult>('/api/v1/auth/api-keys', {
      method: 'POST',
      headers,
    })
    newKey.value = result
    await fetchKeys()
  }
  catch (err: unknown) {
    errorMsg.value = err instanceof Error ? err.message : 'Failed to create key'
  }
  finally {
    creating.value = false
  }
}

async function handleRevoke(keyId: string) {
  if (!confirm('Revoke this key? Requests using it will immediately fail.')) return
  revoking.value = keyId
  errorMsg.value = ''
  try {
    const headers = await authHeaders()
    await $fetch(`/api/v1/auth/api-keys/${keyId}/revoke`, { method: 'POST', headers })
    await fetchKeys()
  }
  catch (err: unknown) {
    errorMsg.value = err instanceof Error ? err.message : 'Failed to revoke key'
  }
  finally {
    revoking.value = null
  }
}

async function copyKey(key: string) {
  await navigator.clipboard.writeText(key)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString()
}

onMounted(fetchKeys)
</script>
