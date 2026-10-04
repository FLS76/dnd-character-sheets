export type Theme = 'dark' | 'light'
export type Language = 'ru' | 'en'
export type Mode = 'individual' | 'shared'
export type Ruleset = '2014' | '2024'
export type SheetTemplate = 'full' | 'compact'
export type Screen = 'start' | 'mode' | 'profiles' | 'sessions' | 'sheet' | 'table'
export type FieldType = 'text' | 'number' | 'textarea'

export interface LocalizedText {
  ru: string
  en: string
}

export interface SheetField {
  id: string
  label: LocalizedText
  description: LocalizedText
  type: FieldType
  group: FieldGroup
  placeholder?: LocalizedText
  rows?: number
  fullWidth?: boolean
}

export type FieldGroup =
  | 'identity'
  | 'abilities'
  | 'combat'
  | 'saves'
  | 'skills'
  | 'equipment'
  | 'features'
  | 'spells'
  | 'character'
  | 'notes'

export interface Profile {
  id: string
  name: string
  createdAt: string
}

export interface Session {
  id: string
  name: string
  ruleset: Ruleset
  template: SheetTemplate
  mode: Mode
  profileId?: string
  createdAt: string
}

export interface Sheet {
  id: string
  sessionId: string
  profileId?: string
  name: string
  values: Record<string, string>
  x: number
  y: number
  rotation: number
  createdAt: string
  updatedAt: string
}

export interface PersistedState {
  profiles: Profile[]
  sessions: Session[]
  sheets: Sheet[]
  theme: Theme
  language: Language
}
