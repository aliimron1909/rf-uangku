export const APP_NAME = 'RF Uangku'
export const APP_VERSION = '1.1.0'
export const APP_TAGLINE = 'Kelola uang, tenang hidupmu.'

export const DEFAULT_PROFILE_NAME = 'RF'
export const PROFILE_NAME_MAX_LENGTH = 40

export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'

export const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
]

export const CHART_COLORS = {
  income: '#10b981',
  expense: '#f43f5e',
  net: '#0ea5e9',
  gridLight: '#e2e8f0',
  gridDark: '#1e293b',
  textLight: '#64748b',
  textDark: '#94a3b8',
}

export const STORAGE_KEYS = {
  theme: 'rf-uangku:theme',
  installDismissed: 'rf-uangku:install-dismissed',
  biometric: 'rf-uangku:biometric',
} as const
