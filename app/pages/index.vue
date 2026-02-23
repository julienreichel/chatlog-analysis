<template>
  <div class="home-page">
    <h1>Chatlog Analysis</h1>
    <p>Welcome! Use the navigation to manage your API keys and view analysis history.</p>
    <div class="btn-group">
      <NuxtLink to="/history" class="btn-primary">View History →</NuxtLink>
      <NuxtLink to="/settings/api-keys" class="btn-secondary">Manage API Keys →</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
</script>

<style scoped>
.home-page {
  max-width: 600px;
  margin: 4rem auto;
  text-align: center;
  padding: 0 1rem;
}

h1 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

p {
  color: #6b7280;
  margin-bottom: 2rem;
}

.btn-group {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-primary {
  display: inline-block;
  padding: 0.625rem 1.25rem;
  background: #6366f1;
  color: #fff;
  text-decoration: none;
  border-radius: 0.375rem;
  font-weight: 500;
}

.btn-primary:hover {
  background: #4f46e5;
}

.btn-secondary {
  display: inline-block;
  padding: 0.625rem 1.25rem;
  background: #e5e7eb;
  color: #374151;
  text-decoration: none;
  border-radius: 0.375rem;
  font-weight: 500;
}

.btn-secondary:hover {
  background: #d1d5db;
}
</style>
