/**
 * useAuth composable
 *
 * Wraps AWS Amplify Auth to expose:
 * - currentUser  (reactive)
 * - isLoggedIn   (computed)
 * - login / logout helpers
 * - getIdToken   (returns the raw JWT for API calls)
 */
import {
  confirmSignUp,
  fetchAuthSession,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
  type AuthUser,
} from 'aws-amplify/auth'

interface UseAuth {
  currentUser: Ref<AuthUser | null>
  isLoggedIn: ComputedRef<boolean>
  loading: Ref<boolean>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  getIdToken: () => Promise<string | null>
  refresh: () => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  confirmSignup: (email: string, code: string) => Promise<void>
}

export function useAuth(): UseAuth {
  const currentUser = useState<AuthUser | null>('auth:user', () => null)
  const loading = ref(false)

  async function refresh() {
    try {
      currentUser.value = await getCurrentUser()
    }
    catch {
      currentUser.value = null
    }
  }

  async function login(email: string, password: string) {
    loading.value = true
    try {
      await signIn({ username: email, password })
      await refresh()
    }
    finally {
      loading.value = false
    }
  }

  async function logout() {
    loading.value = true
    try {
      await signOut()
      currentUser.value = null
    }
    finally {
      loading.value = false
    }
  }

  async function getIdToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession()
      return session.tokens?.idToken?.toString() ?? null
    }
    catch {
      return null
    }
  }

  async function signup(email: string, password: string) {
    loading.value = true
    try {
      // username is the Cognito login identifier; email attribute is required for the user pool
      await signUp({ username: email, password, options: { userAttributes: { email } } })
    }
    finally {
      loading.value = false
    }
  }

  async function confirmSignup(email: string, code: string) {
    loading.value = true
    try {
      await confirmSignUp({ username: email, confirmationCode: code })
    }
    finally {
      loading.value = false
    }
  }

  const isLoggedIn = computed(() => currentUser.value !== null)

  return { currentUser, isLoggedIn, loading, login, logout, getIdToken, refresh, signup, confirmSignup }
}
