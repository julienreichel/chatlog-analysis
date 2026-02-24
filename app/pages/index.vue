<template>
  <div class="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
    <h1 class="text-3xl font-bold mb-2">Chatlog Analysis</h1>
    <p class="text-gray-500 dark:text-gray-400 mb-8">Welcome! Use the navigation to manage your API keys and view analysis history.</p>
    <div class="flex gap-3 flex-wrap justify-center">
      <UButton to="/history" size="lg">View History</UButton>
      <UButton to="/settings/api-keys" size="lg" color="neutral" variant="outline">Manage API Keys</UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
</script>
