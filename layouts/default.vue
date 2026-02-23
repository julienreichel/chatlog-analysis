<template>
  <div>
    <nav class="navbar">
      <NuxtLink to="/" class="brand">Chatlog Analysis</NuxtLink>
      <div class="nav-actions">
        <NuxtLink to="/api-keys">API Keys</NuxtLink>
        <button v-if="isLoggedIn" class="btn-logout" @click="handleLogout">
          Sign out
        </button>
      </div>
    </nav>
    <main>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const { isLoggedIn, logout } = useAuth()
const router = useRouter()

async function handleLogout() {
  await logout()
  await router.push('/login')
}
</script>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1.5rem;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.brand {
  font-weight: 700;
  font-size: 1rem;
  color: #111827;
  text-decoration: none;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.nav-actions a {
  color: #374151;
  text-decoration: none;
  font-size: 0.9rem;
}

.nav-actions a:hover {
  color: #6366f1;
}

.btn-logout {
  background: none;
  border: 1px solid #d1d5db;
  padding: 0.25rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
  color: #374151;
}

.btn-logout:hover {
  background: #f9fafb;
}
</style>
