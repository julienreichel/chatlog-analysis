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
  fetchAuthSession,
  getCurrentUser,
  signIn,
  signOut,
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

  const isLoggedIn = computed(() => currentUser.value !== null)

  return { currentUser, isLoggedIn, loading, login, logout, getIdToken, refresh }
}
