/**
 * Client-side route middleware: redirect unauthenticated users to /login.
 * Applied globally so every page that needs auth just uses definePageMeta.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // Skip the login page itself
  if (to.path === '/login') return

  const { isLoggedIn, refresh } = useAuth()

  // Hydrate the auth state if not yet done
  if (!isLoggedIn.value) {
    await refresh()
  }

  if (!isLoggedIn.value) {
    return navigateTo('/login')
  }
})
