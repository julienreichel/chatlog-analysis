/**
 * Tests for the LLM preset definitions and schema detection helper.
 */

import { describe, it, expect } from 'vitest'
import { LLM_PRESETS, detectPreset } from '../utils/llmPresets'
import type { PresetId } from '../utils/llmPresets'

// ─── LLM_PRESETS structure ────────────────────────────────────────────────────

describe('LLM_PRESETS', () => {
  it('contains exactly 5 presets', () => {
    expect(LLM_PRESETS).toHaveLength(5)
  })

  it('includes all required preset ids', () => {
    const ids = LLM_PRESETS.map(p => p.id)
    expect(ids).toContain('hate-speech')
    expect(ids).toContain('jailbreak')
    expect(ids).toContain('hallucination')
    expect(ids).toContain('relevance')
    expect(ids).toContain('addiction')
  })

  it('every preset has non-empty name, prompt, and outputSchema', () => {
    for (const preset of LLM_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0)
      expect(preset.prompt.length).toBeGreaterThan(0)
      expect(preset.outputSchema.length).toBeGreaterThan(0)
    }
  })

  it('every preset outputSchema is valid JSON', () => {
    for (const preset of LLM_PRESETS) {
      expect(() => JSON.parse(preset.outputSchema)).not.toThrow()
    }
  })

  it('every preset has a non-empty label', () => {
    for (const preset of LLM_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0)
    }
  })
})

// ─── detectPreset ─────────────────────────────────────────────────────────────

describe('detectPreset', () => {
  it('returns null for null input', () => {
    expect(detectPreset(null)).toBeNull()
  })

  it('returns null for non-object input', () => {
    expect(detectPreset('string')).toBeNull()
    expect(detectPreset(42)).toBeNull()
    expect(detectPreset([])).toBeNull()
  })

  it('returns null for unrecognised object', () => {
    expect(detectPreset({ compliant: true, issues: [] })).toBeNull()
  })

  it('detects hate-speech schema', () => {
    const result = { hasSpeech: false, score: 0.1, categories: { violence: false }, flags: [] }
    expect(detectPreset(result)).toBe<PresetId>('hate-speech')
  })

  it('detects jailbreak schema', () => {
    const result = { isJailbreak: false, score: 0.05, techniques: [], summary: 'None' }
    expect(detectPreset(result)).toBe<PresetId>('jailbreak')
  })

  it('detects hallucination schema', () => {
    const result = { hasHallucination: false, score: 0.0, instances: [], summary: 'Clean' }
    expect(detectPreset(result)).toBe<PresetId>('hallucination')
  })

  it('detects relevance schema', () => {
    const result = { relevant: true, score: 0.9, helpful: true, issues: [], summary: 'Good' }
    expect(detectPreset(result)).toBe<PresetId>('relevance')
  })

  it('detects addiction schema', () => {
    const result = { hasDependency: false, score: 0.0, patterns: [], summary: 'None' }
    expect(detectPreset(result)).toBe<PresetId>('addiction')
  })

  it('prioritises hate-speech when hasSpeech + categories + flags are present', () => {
    // A weird edge-case object that could match multiple presets
    const result = { hasSpeech: true, categories: {}, flags: [], hasDependency: false, patterns: [] }
    expect(detectPreset(result)).toBe<PresetId>('hate-speech')
  })
})
