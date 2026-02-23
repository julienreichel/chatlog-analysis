import { defineFunction } from '@aws-amplify/backend'

export const apiFunction = defineFunction({
  name: 'api',
  entry: './handlers/index.ts',
  runtime: 20,
})
