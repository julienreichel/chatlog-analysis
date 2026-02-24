<template>
  <div v-if="checkingSession" class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div class="text-sm text-gray-500 dark:text-gray-400">
      Checking session...
    </div>
  </div>
  <div v-else class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-xl font-bold">Chatlog Analysis</h1>
      </template>

      <template v-if="!awaitingConfirmation">
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Create your account</p>

        <form class="space-y-4" @submit.prevent="handleSignup">
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
              autocomplete="new-password"
              required
              class="w-full"
            />
          </UFormField>

          <UFormField label="Confirm Password" name="confirmPassword">
            <UInput
              v-model="confirmPassword"
              type="password"
              placeholder="••••••••"
              autocomplete="new-password"
              required
              class="w-full"
            />
          </UFormField>

          <UAlert v-if="errorMsg" color="error" :description="errorMsg" />

          <UButton type="submit" :loading="loading" block>
            Sign up
          </UButton>
        </form>
      </template>

      <template v-else>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">Check your email</p>
        <p class="text-sm text-gray-700 dark:text-gray-300 mb-4">
          We sent a verification code to <strong>{{ email }}</strong>. Enter it below to activate your account.
        </p>

        <form class="space-y-4" @submit.prevent="handleConfirm">
          <UFormField label="Verification Code" name="code">
            <UInput
              v-model="confirmationCode"
              type="text"
              placeholder="123456"
              autocomplete="one-time-code"
              inputmode="numeric"
              required
              class="w-full"
            />
          </UFormField>

          <UAlert v-if="errorMsg" color="error" :description="errorMsg" />

          <UButton type="submit" :loading="loading" block>
            Verify email
          </UButton>
        </form>
      </template>

      <template #footer>
        <p v-if="!awaitingConfirmation" class="text-sm text-center text-gray-500 dark:text-gray-400">
          Already have an account?
          <ULink to="/login" class="text-primary font-medium">Sign in</ULink>
        </p>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { signup, confirmSignup, loading, refresh, isLoggedIn } = useAuth()
const router = useRouter()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const confirmationCode = ref('')
const errorMsg = ref('')
const awaitingConfirmation = ref(false)
const checkingSession = ref(true)

onMounted(async () => {
  await refresh()
  if (isLoggedIn.value) {
    await router.replace('/history')
    return
  }
  checkingSession.value = false
})

async function handleSignup() {
  errorMsg.value = ''
  if (password.value !== confirmPassword.value) {
    errorMsg.value = 'Passwords do not match'
    return
  }
  try {
    await signup(email.value, password.value)
    awaitingConfirmation.value = true
  }
  catch (err: unknown) {
    errorMsg.value = err instanceof Error ? err.message : 'Sign up failed'
  }
}

async function handleConfirm() {
  errorMsg.value = ''
  try {
    await confirmSignup(email.value, confirmationCode.value)
    await router.push('/login')
  }
  catch (err: unknown) {
    errorMsg.value = err instanceof Error ? err.message : 'Verification failed'
  }
}
</script>
