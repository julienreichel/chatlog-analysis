<template>
  <div class="api-keys-page">
    <header class="page-header">
      <div>
        <h1>API Keys</h1>
        <p class="subtitle">Use these keys in the <code>X-API-Key</code> header to call analysis endpoints.</p>
      </div>
      <button class="btn-primary" :disabled="creating" @click="createKey">
        {{ creating ? 'Generating…' : '+ Generate new key' }}
      </button>
    </header>

    <!-- New key banner (shown once) -->
    <div v-if="newKey" class="new-key-banner">
      <p class="new-key-label">
        🔑 Copy your new API key now — it will not be shown again.
      </p>
      <div class="key-copy-row">
        <code class="key-value">{{ newKey.key }}</code>
        <button class="btn-copy" @click="copyKey(newKey.key)">
          {{ copied ? 'Copied!' : 'Copy' }}
        </button>
      </div>
      <button class="btn-dismiss" @click="newKey = null">Dismiss</button>
    </div>

    <!-- Error -->
    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

    <!-- Keys table -->
    <div v-if="loading" class="loading">Loading keys…</div>

    <div v-else-if="keys.length === 0" class="empty">
      No API keys yet. Generate one above.
    </div>

    <table v-else class="keys-table">
      <thead>
        <tr>
          <th>Key ID</th>
          <th>Label</th>
          <th>Created</th>
          <th>Last used</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="k in keys" :key="k.keyId">
          <td><code class="key-id">{{ k.keyId.slice(0, 8) }}…</code></td>
          <td>{{ k.label || '—' }}</td>
          <td>{{ formatDate(k.createdAt) }}</td>
          <td>{{ k.lastUsedAt ? formatDate(k.lastUsedAt) : 'Never' }}</td>
          <td>
            <span :class="['badge', k.isActive ? 'badge-active' : 'badge-revoked']">
              {{ k.isActive ? 'Active' : 'Revoked' }}
            </span>
          </td>
          <td>
            <button
              v-if="k.isActive"
              class="btn-danger-sm"
              :disabled="revoking === k.keyId"
              @click="revokeKey(k.keyId)"
            >
              {{ revoking === k.keyId ? 'Revoking…' : 'Revoke' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
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

const { getIdToken } = useAuth()

const keys = ref<ApiKeyMeta[]>([])
const loading = ref(false)
const creating = ref(false)
const revoking = ref<string | null>(null)
const errorMsg = ref('')
const newKey = ref<NewKeyResult | null>(null)
const copied = ref(false)

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

async function createKey() {
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

async function revokeKey(keyId: string) {
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

<style scoped>
.api-keys-page {
  max-width: 900px;
  margin: 2rem auto;
  padding: 0 1rem;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  gap: 1rem;
  flex-wrap: wrap;
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

.new-key-banner {
  background: #ecfdf5;
  border: 1px solid #6ee7b7;
  border-radius: 0.5rem;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
}

.new-key-label {
  font-weight: 600;
  margin: 0 0 0.75rem;
}

.key-copy-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.key-value {
  background: #fff;
  border: 1px solid #a7f3d0;
  padding: 0.375rem 0.625rem;
  border-radius: 0.25rem;
  font-size: 0.85rem;
  word-break: break-all;
}

.btn-copy {
  padding: 0.375rem 0.875rem;
  background: #10b981;
  color: #fff;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-copy:hover {
  background: #059669;
}

.btn-dismiss {
  margin-top: 0.75rem;
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  font-size: 0.875rem;
  text-decoration: underline;
  padding: 0;
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

.keys-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.keys-table th {
  text-align: left;
  padding: 0.625rem 0.75rem;
  border-bottom: 2px solid #e5e7eb;
  font-weight: 600;
  color: #374151;
}

.keys-table td {
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid #f3f4f6;
}

.key-id {
  font-size: 0.8rem;
  color: #6b7280;
}

.badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-active {
  background: #d1fae5;
  color: #065f46;
}

.badge-revoked {
  background: #fee2e2;
  color: #991b1b;
}

.btn-primary {
  padding: 0.5rem 1rem;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}

.btn-primary:hover:not(:disabled) {
  background: #4f46e5;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-danger-sm {
  padding: 0.25rem 0.625rem;
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fca5a5;
  border-radius: 0.25rem;
  font-size: 0.8rem;
  cursor: pointer;
}

.btn-danger-sm:hover:not(:disabled) {
  background: #fecaca;
}

.btn-danger-sm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
