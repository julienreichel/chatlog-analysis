<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <UCard class="w-full max-w-md">
      <template #header>
        <div>
          <h1 class="text-xl font-bold">Chatlog Analysis</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Sign in to manage your API keys</p>
        </div>
      </template>

      <form class="space-y-4" @submit.prevent="handleLogin">
        <UFormField label="Email" name="email">
          <UInput
            v-model="email"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            required
            class="w-full"
          />
        </UFormField>

        <UFormField label="Password" name="password">
          <UInput
            v-model="password"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            required
            class="w-full"
          />
        </UFormField>

        <UAlert v-if="errorMsg" color="error" :description="errorMsg" />

        <UButton type="submit" :loading="loading" block>
          Sign in
        </UButton>
      </form>

      <template #footer>
        <p class="text-sm text-center text-gray-500 dark:text-gray-400">
          Don't have an account?
          <ULink to="/signup" class="text-primary font-medium">Sign up</ULink>
        </p>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { login, loading } = useAuth()
const router = useRouter()

const email = ref('')
const password = ref('')
const errorMsg = ref('')

async function handleLogin() {
  errorMsg.value = ''
  try {
    await login(email.value, password.value)
    await router.push('/history')
  }
  catch (err: unknown) {
    errorMsg.value = err instanceof Error ? err.message : 'Login failed'
  }
}
</script>
