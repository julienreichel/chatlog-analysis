import { defineBackend } from '@aws-amplify/backend'
import { apiFunction } from './functions/api/resource.js'

export const backend = defineBackend({
  apiFunction,
})
