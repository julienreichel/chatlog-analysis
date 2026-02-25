<template>
  <div>
    <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <UContainer>
        <div class="flex items-center justify-between h-14">
          <NuxtLink to="/" class="font-bold text-gray-900 dark:text-white">Chatlog Analysis</NuxtLink>
          <nav class="flex items-center gap-1">
            <UButton to="/history" variant="ghost" color="neutral">History</UButton>
            <UButton to="/api" variant="ghost" color="neutral">API</UButton>
            <UButton to="/settings/api-keys" variant="ghost" color="neutral">API Keys</UButton>
            <UButton v-if="isLoggedIn" variant="outline" color="neutral" size="sm" @click="handleLogout">
              Sign out
            </UButton>
          </nav>
        </div>
      </UContainer>
    </header>
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
