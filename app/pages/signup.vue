<template>
  <div class="signup-page">
    <div class="signup-card">
      <h1>Chatlog Analysis</h1>

      <template v-if="!awaitingConfirmation">
        <p class="subtitle">Create your account</p>

        <form @submit.prevent="handleSignup">
          <div class="field">
            <label for="email">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              placeholder="you@example.com"
              autocomplete="email"
              required
            />
          </div>

          <div class="field">
            <label for="password">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              placeholder="••••••••"
              autocomplete="new-password"
              required
            />
          </div>

          <div class="field">
            <label for="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              v-model="confirmPassword"
              type="password"
              placeholder="••••••••"
              autocomplete="new-password"
              required
            />
          </div>

          <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

          <button type="submit" :disabled="loading" class="btn-primary">
            {{ loading ? 'Creating account…' : 'Sign up' }}
          </button>

          <p class="login-link">
            Already have an account? <NuxtLink to="/login">Sign in</NuxtLink>
          </p>
        </form>
      </template>

      <template v-else>
        <p class="subtitle">Check your email</p>
        <p class="confirm-info">We sent a verification code to <strong>{{ email }}</strong>. Enter it below to activate your account.</p>

        <form @submit.prevent="handleConfirm">
          <div class="field">
            <label for="code">Verification Code</label>
            <input
              id="code"
              v-model="confirmationCode"
              type="text"
              placeholder="123456"
              autocomplete="one-time-code"
              inputmode="numeric"
              required
            />
          </div>

          <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

          <button type="submit" :disabled="loading" class="btn-primary">
            {{ loading ? 'Verifying…' : 'Verify email' }}
          </button>
        </form>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { signup, confirmSignup, loading } = useAuth()
const router = useRouter()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const confirmationCode = ref('')
const errorMsg = ref('')
const awaitingConfirmation = ref(false)

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

<style scoped>
.signup-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
}

.signup-card {
  background: #fff;
  padding: 2.5rem;
  border-radius: 0.75rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  width: 100%;
  max-width: 400px;
}

h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
}

.subtitle {
  color: #6b7280;
  margin: 0 0 1.5rem;
  font-size: 0.9rem;
}

.confirm-info {
  color: #374151;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}

.field {
  margin-bottom: 1rem;
}

label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 1rem;
  box-sizing: border-box;
}

input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.error {
  color: #ef4444;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
}

.btn-primary {
  width: 100%;
  padding: 0.625rem;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 0.375rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary:hover:not(:disabled) {
  background: #4f46e5;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-link {
  margin-top: 1rem;
  text-align: center;
  font-size: 0.875rem;
  color: #6b7280;
}

.login-link a {
  color: #6366f1;
  text-decoration: none;
}

.login-link a:hover {
  text-decoration: underline;
}
</style>
