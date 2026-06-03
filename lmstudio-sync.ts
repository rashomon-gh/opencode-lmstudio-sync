import type { Plugin } from "@opencode-ai/plugin"

const LMS_BASE_URL = "http://127.0.0.1:1234/v1"
const TIMEOUT_MS   = 6000

// LM Studio /v1/models response shape
interface LMSModel {
  id:   string
  type: string
  object: string
  publisher?: string
  capabilities?: {
    vision?:              boolean
    trained_for_tool_use?: boolean
    reasoning?:           { allowed_options: string[]; default: string } | boolean
  }
  max_context_length?: number
}

interface LMSModelsResponse {
  data: LMSModel[]
}

// Opencode provider config shape (what the config hook receives)
interface ModelEntry {
  name?: string
  contextLength?: number
  reasoning?: boolean
  vision?: boolean
  [key: string]: unknown
}

interface ProviderConfig {
  npm?:     string
  name?:    string
  options?: { baseURL?: string; [key: string]: unknown }
  models?:  Record<string, ModelEntry>
  [key: string]: unknown
}

interface OpenCodeConfig {
  provider?: Record<string, ProviderConfig>
  [key: string]: unknown
}

// Slugify a raw model ID into a human-readable display name.
// "qwen/qwen3.6-35b-a3b-4bit" → "Qwen3.6 35B A3B 4bit"
function toDisplayName(modelId: string): string {
  const bare = modelId.includes("/") ? modelId.split("/").pop()! : modelId
  return bare
    .replace(/[-_.]/g, " ")
    .replace(/\b(\d+)b\b/gi, "$1B")
    .replace(/\b(a\d+b)\b/gi, (m) => m.toUpperCase())
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

export const LMStudioSyncPlugin: Plugin = async ({ client }) => {
  return {
    config: async (config: OpenCodeConfig) => {
      // ── 1. Probe LM Studio ────────────────────────────────────────────
      let models: LMSModel[] = []
      try {
        const res = await fetch(`${LMS_BASE_URL}/models`, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        if (!res.ok) {
          await client.app.log({
            body: {
              service: "lmstudio-sync",
              level:   "warn",
              message: `LM Studio returned HTTP ${res.status} — skipping model sync`,
            },
          })
          return
        }
        const json = (await res.json()) as LMSModelsResponse
        models = (json.data ?? []).filter(
          (m) => m.type === "llm" || (!m.type && !m.id.toLowerCase().includes("embed")),
        )
      } catch {
        // LM Studio isn't running — silently skip, don't break opencode startup
        return
      }

      if (models.length === 0) {
        await client.app.log({
          body: {
            service: "lmstudio-sync",
            level:   "info",
            message: "LM Studio is up but no LLM models are loaded — nothing to sync",
          },
        })
        return
      }

      // ── 2. Ensure the lmstudio provider exists in config ──────────────
      config.provider ??= {}
      config.provider.lmstudio ??= {
        npm:     "@ai-sdk/openai-compatible",
        name:    "LM Studio",
        options: { baseURL: LMS_BASE_URL },
        models:  {},
      }

      const provider = config.provider.lmstudio
      provider.options       ??= {}
      provider.options.baseURL ??= LMS_BASE_URL
      provider.models        ??= {}

      // ── 3. Merge discovered models (never overwrite manually set entries)
      let added = 0
      for (const m of models) {
        if (provider.models[m.id]) continue           // already configured — leave it alone

        const entry: ModelEntry = {
          name: toDisplayName(m.id),
        }

        if (m.max_context_length) {
          entry.contextLength = m.max_context_length
        }

        if (m.capabilities?.vision) {
          entry.vision = true
        }

        // reasoning: LM Studio exposes this as an object or bool
        const r = m.capabilities?.reasoning
        if (r === true || (typeof r === "object" && r !== null)) {
          entry.reasoning = true
        }

        provider.models[m.id] = entry
        added++
      }

      await client.app.log({
        body: {
          service: "lmstudio-sync",
          level:   "info",
          message: `Synced ${models.length} model(s) from LM Studio (${added} new, ${models.length - added} already configured)`,
        },
      })
    },
  }
}

export default LMStudioSyncPlugin
