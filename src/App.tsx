import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  Download,
  Globe2,
  HelpCircle,
  Home,
  Layers3,
  LogOut,
  Moon,
  MousePointer2,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
  Plus,
  RotateCcw,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
  Users,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent } from 'react'
import { getFields } from './schemas'
import { countLabel, t, text } from './i18n'
import { exitNativeApp, exportElementAsPdf, installAndroidBackButton, isAndroidPlatform, isNativePlatform, setAndroidScreenOrientation } from './platform/runtime'
import { readJson, writeJson } from './platform/storage'
import type {
  FieldGroup,
  Language,
  Mode,
  PersistedState,
  Profile,
  Ruleset,
  Screen,
  Session,
  Sheet,
  SheetField,
  SheetTemplate,
  Theme,
} from './types'
import './styles.css'

const STORAGE_KEY = 'codex-character-sheets-v1'

const initialState: PersistedState = {
  profiles: [],
  sessions: [],
  sheets: [],
  theme: 'dark',
  language: 'ru',
}

const groupLabels: Record<FieldGroup, Record<Language, string>> = {
  identity: { ru: 'Идентификация', en: 'Identity' },
  abilities: { ru: 'Характеристики', en: 'Ability scores' },
  combat: { ru: 'Бой и передвижение', en: 'Combat & movement' },
  saves: { ru: 'Спасброски', en: 'Saving throws' },
  skills: { ru: 'Навыки', en: 'Skills' },
  equipment: { ru: 'Снаряжение', en: 'Equipment' },
  features: { ru: 'Особенности', en: 'Features' },
  spells: { ru: 'Магия', en: 'Magic' },
  character: { ru: 'Характер', en: 'Character' },
  notes: { ru: 'Заметки', en: 'Notes' },
}

const groupOrder: FieldGroup[] = ['identity', 'abilities', 'combat', 'saves', 'skills', 'equipment', 'features', 'spells', 'character', 'notes']

type DeleteTarget = { kind: 'profile' | 'session' | 'sheet'; id: string } | null
type ModalKind = 'profile' | 'session' | 'delete' | 'exit' | null
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type TablePosition = 'top' | 'bottom' | 'left' | 'right' | 'center'
type CardDragState = { id: string; pointerId: number; startX: number; startY: number; originX: number; originY: number; x: number; y: number; moved: boolean }
type TablePointer = { x: number; y: number }
type PinchState = { distance: number; scale: number }

type Viewport = { x: number; y: number; scale: number }

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

type StoredSession = Omit<Session, 'mode' | 'profileId'> & {
  mode?: Mode
  profileId?: string
}

function migrateSession(session: StoredSession, sheets: Sheet[]): Session {
  if (session.mode === 'individual' || session.mode === 'shared') {
    return {
      ...session,
      mode: session.mode,
      profileId: session.mode === 'individual' ? session.profileId : undefined,
    }
  }

  const profileIds = [...new Set(sheets
    .filter((sheet) => sheet.sessionId === session.id && sheet.profileId)
    .map((sheet) => sheet.profileId))]
  if (profileIds.length === 1) {
    return { ...session, mode: 'individual', profileId: profileIds[0] }
  }

  return { ...session, mode: 'shared', profileId: undefined }
}

function loadState(): PersistedState {
  const parsed = readJson<Partial<PersistedState>>(STORAGE_KEY)
  if (!parsed) return initialState
  try {
    const sheets = Array.isArray(parsed.sheets) ? parsed.sheets : []
    const storedSessions = Array.isArray(parsed.sessions) ? parsed.sessions as StoredSession[] : []
    return {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      sessions: storedSessions.map((session) => migrateSession(session, sheets)),
      sheets,
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      language: parsed.language === 'en' ? 'en' : 'ru',
    }
  } catch {
    return initialState
  }
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function characterName(sheet: Sheet, language: Language): string {
  return sheet.values.characterName?.trim() || (language === 'ru' ? 'Новый персонаж' : 'New character')
}

function characterCountLabel(count: number, language: Language): string {
  return countLabel(language, count, 'character')
}

function characterClass(sheet: Sheet, language: Language): string {
  return sheet.values.classLevel?.trim() || (language === 'ru' ? 'Класс не указан' : 'Class not set')
}

function tablePosition(index: number, preferred?: TablePosition): { x: number; y: number; rotation: number } {
  const lane = Math.floor(index / 4)
  const offset = lane === 0 ? 0 : (lane % 2 === 0 ? 1 : -1) * (90 + (lane - 1) * 34)
  if (preferred === 'top') return { x: 720 + offset, y: 90, rotation: 180 }
  if (preferred === 'bottom') return { x: 720 - offset, y: 790, rotation: 0 }
  if (preferred === 'left') return { x: 185, y: 410 + offset, rotation: 90 }
  if (preferred === 'right') return { x: 1245, y: 410 - offset, rotation: -90 }
  if (index === 0) return { x: 710, y: 390, rotation: 0 }
  const gridIndex = index - 1
  const columns = 4
  return {
    x: 270 + (gridIndex % columns) * 320,
    y: 150 + Math.floor(gridIndex / columns) * 470,
    rotation: 0,
  }
}

function getGroupFields(fields: SheetField[], group: FieldGroup): SheetField[] {
  return fields.filter((item) => item.group === group)
}

function App() {
  const [state, setState] = useState<PersistedState>(loadState)
  const [screen, setScreen] = useState<Screen>('start')
  const [mode, setMode] = useState<Mode>('individual')
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalKind>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [exited, setExited] = useState(false)
  const [androidTableCurtainOpen, setAndroidTableCurtainOpen] = useState(false)
  const backActionRef = useRef<() => void>(() => undefined)
  const androidPlatform = isAndroidPlatform()

  const language = state.language
  const selectedProfile = state.profiles.find((item) => item.id === selectedProfileId)
  const selectedSession = state.sessions.find((item) => item.id === selectedSessionId)
  const activeSheet = state.sheets.find((item) => item.id === activeSheetId)

  useEffect(() => {
    const persisted = writeJson(STORAGE_KEY, state)
    setSaveStatus(persisted ? 'saving' : 'error')
    if (!persisted) return undefined
    const timer = window.setTimeout(() => setSaveStatus('saved'), 260)
    return () => window.clearTimeout(timer)
  }, [state])

  useEffect(() => {
    document.documentElement.lang = language
    window.desktop?.setLanguage?.(language)
  }, [language])

  useEffect(() => {
    let disposed = false
    let dispose: (() => void) | undefined
    void installAndroidBackButton(() => backActionRef.current())
      .then((cleanup) => {
        if (disposed) cleanup()
        else dispose = cleanup
      })
      .catch(() => undefined)
    return () => {
      disposed = true
      dispose?.()
    }
  }, [])

  useEffect(() => {
    if (!androidPlatform) return
    void setAndroidScreenOrientation(screen === 'table').catch(() => undefined)
  }, [androidPlatform, screen])

  useEffect(() => {
    if (!androidPlatform || screen !== 'table') setAndroidTableCurtainOpen(false)
  }, [androidPlatform, screen])

  useEffect(() => {
    backActionRef.current = () => {
      if (modal) {
        setModal(null)
        setDeleteTarget(null)
        return
      }
      if (screen === 'start') {
        void exitNativeApp()
        return
      }
      goBack()
    }
  }, [screen, mode, selectedProfileId, selectedSessionId, modal])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  function notify(message: string) {
    setToast(message)
  }

  function openMode(nextMode: Mode) {
    setMode(nextMode)
    setSelectedProfileId(null)
    setSelectedSessionId(null)
    setActiveSheetId(null)
    setScreen(nextMode === 'individual' ? 'profiles' : 'sessions')
  }

  function goBack() {
    if (screen === 'mode') setScreen('start')
    else if (screen === 'profiles') setScreen('mode')
    else if (screen === 'sessions') setScreen(mode === 'individual' && selectedProfile ? 'profiles' : 'mode')
    else if (screen === 'sheet') setScreen(mode === 'shared' ? 'table' : 'sessions')
    else if (screen === 'table') setScreen('sessions')
  }

  function goHome() {
    setScreen('start')
    setActiveSheetId(null)
    setSelectedProfileId(null)
    setSelectedSessionId(null)
  }

  function toggleTheme() {
    setState((current) => ({ ...current, theme: current.theme === 'dark' ? 'light' : 'dark' }))
  }

  function toggleLanguage() {
    setState((current) => ({ ...current, language: current.language === 'ru' ? 'en' : 'ru' }))
  }

  function createProfile(name: string) {
    const cleanName = normalizeName(name)
    if (!cleanName) return
    const profile: Profile = { id: makeId('profile'), name: cleanName, createdAt: new Date().toISOString() }
    setState((current) => ({ ...current, profiles: [...current.profiles, profile] }))
    setSelectedProfileId(profile.id)
    setModal(null)
    notify(t(language, 'profileName') + ': ' + cleanName)
  }

  function createSession(name: string, ruleset: Ruleset, template: SheetTemplate) {
    const cleanName = normalizeName(name)
    if (!cleanName) return
    const session: Session = {
      id: makeId('session'),
      name: cleanName,
      ruleset,
      template,
      mode,
      profileId: mode === 'individual' ? selectedProfileId ?? undefined : undefined,
      createdAt: new Date().toISOString(),
    }
    setState((current) => ({ ...current, sessions: [...current.sessions, session] }))
    setSelectedSessionId(session.id)
    setModal(null)
    notify(cleanName + ' · ' + (ruleset === '2014' ? t(language, 'rules2014') : t(language, 'rules2024')))
  }

  function openProfile(id: string) {
    setSelectedProfileId(id)
    setSelectedSessionId(null)
    setActiveSheetId(null)
    setScreen('sessions')
  }

  function createSheetForSession(sessionId: string, profileId?: string, preferred?: TablePosition, index = 0): string {
    const id = makeId('sheet')
    const position = tablePosition(index, preferred)
    const sheet: Sheet = {
      id,
      sessionId,
      profileId,
      name: 'Новый персонаж',
      values: {},
      x: position.x,
      y: position.y,
      rotation: position.rotation,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setState((current) => ({ ...current, sheets: [...current.sheets, sheet] }))
    return id
  }

  function openSession(id: string) {
    const session = state.sessions.find((item) => item.id === id)
    if (!session) return
    if (mode === 'shared' && session.mode !== 'shared') return
    if (mode === 'individual' && (session.mode !== 'individual' || session.profileId !== selectedProfileId)) return
    setSelectedSessionId(id)
    if (mode === 'shared') {
      setActiveSheetId(null)
      setScreen('table')
      return
    }
    if (!selectedProfile) return
    const existing = state.sheets.find((item) => item.sessionId === id && item.profileId === selectedProfile.id)
    const sheetId = existing?.id ?? createSheetForSession(id, selectedProfile.id, 'center')
    setActiveSheetId(sheetId)
    setScreen('sheet')
  }

  function addSharedSheet(preferred: TablePosition = 'center') {
    if (!selectedSession) return
    const index = state.sheets.filter((item) => item.sessionId === selectedSession.id).length
    createSheetForSession(selectedSession.id, undefined, preferred, index)
    notify(t(language, 'addSheet'))
  }

  function updateSheetValue(sheetId: string, fieldId: string, value: string) {
    setState((current) => ({
      ...current,
      sheets: current.sheets.map((sheet) => sheet.id === sheetId
        ? { ...sheet, values: { ...sheet.values, [fieldId]: value }, updatedAt: new Date().toISOString() }
        : sheet),
    }))
  }

  function updateSheetPosition(sheetId: string, patch: Partial<Pick<Sheet, 'x' | 'y' | 'rotation'>>) {
    setState((current) => ({
      ...current,
      sheets: current.sheets.map((sheet) => sheet.id === sheetId ? { ...sheet, ...patch, updatedAt: new Date().toISOString() } : sheet),
    }))
  }

  function requestDelete(kind: 'profile' | 'session' | 'sheet', id: string) {
    setDeleteTarget({ kind, id })
    setModal('delete')
  }

  function confirmDelete() {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'profile') {
      const profileId = deleteTarget.id
      const ownedSessionIds = new Set(state.sessions
        .filter((session) => session.mode === 'individual' && session.profileId === profileId)
        .map((session) => session.id))
      setState((current) => ({
        ...current,
        profiles: current.profiles.filter((item) => item.id !== profileId),
        sessions: current.sessions.filter((session) => !(session.mode === 'individual' && session.profileId === profileId)),
        sheets: current.sheets.filter((sheet) => sheet.profileId !== profileId && !ownedSessionIds.has(sheet.sessionId)),
      }))
      if (selectedProfileId === profileId) setSelectedProfileId(null)
      if (selectedSessionId && ownedSessionIds.has(selectedSessionId)) {
        setSelectedSessionId(null)
        setActiveSheetId(null)
        setScreen('profiles')
      }
    } else if (deleteTarget.kind === 'session') {
      setState((current) => ({
        ...current,
        sessions: current.sessions.filter((item) => item.id !== deleteTarget.id),
        sheets: current.sheets.filter((item) => item.sessionId !== deleteTarget.id),
      }))
      if (selectedSessionId === deleteTarget.id) setSelectedSessionId(null)
      if (activeSheetId && state.sheets.find((item) => item.id === activeSheetId)?.sessionId === deleteTarget.id) {
        setActiveSheetId(null)
        setScreen('sessions')
      }
    } else {
      setState((current) => ({
        ...current,
        sheets: current.sheets.filter((item) => item.id !== deleteTarget.id),
      }))
      if (activeSheetId === deleteTarget.id) {
        setActiveSheetId(null)
        setScreen(mode === 'shared' ? 'table' : 'sessions')
      }
    }
    setDeleteTarget(null)
    setModal(null)
    notify(t(language, 'delete'))
  }

  async function handleExport() {
    if (window.desktop?.printPdf) {
      const saved = await window.desktop.printPdf()
      if (saved) notify(t(language, 'pdfSaved'))
      return
    }
    if (isNativePlatform()) {
      const paper = document.querySelector<HTMLElement>('.paper-sheet')
      const element = paper ?? document.querySelector<HTMLElement>('.table-screen')
      if (!element) {
        notify(t(language, 'openSheetForExport'))
        return
      }
      try {
        const saved = await exportElementAsPdf(
          element,
          paper
            ? `DND-${characterName(activeSheet ?? state.sheets[0], language) || 'character-sheet'}`
            : 'DND-shared-table',
          t(language, 'pdfShare'),
        )
        if (saved) notify(t(language, 'pdfSaved'))
      } catch {
        notify(t(language, 'pdfError'))
      }
      return
    }
    notify(t(language, 'windowPrintHint'))
    window.setTimeout(() => window.print(), 80)
  }

  function handleExit() {
    if (window.desktop?.close) {
      window.desktop.close()
      return
    }
    if (isNativePlatform()) {
      void exitNativeApp()
      return
    }
    setModal('exit')
  }

  if (exited) {
    return <ExitScreen language={language} onClose={() => setExited(false)} />
  }

  const canGoBack = screen !== 'start'
  const contextLabel = mode === 'individual' && selectedProfile && selectedSession
    ? `${selectedProfile.name} / ${selectedSession.name}`
    : selectedSession?.name
  const tableSheetCount = selectedSession
    ? state.sheets.filter((sheet) => sheet.sessionId === selectedSession.id).length
    : 0
  const visibleSessions = state.sessions.filter((session) => mode === 'shared'
    ? session.mode === 'shared'
    : session.mode === 'individual' && session.profileId === selectedProfileId)
  // The session name only belongs in the TopBar on the sheet and the table.
  // On the start / mode / sessions / profiles screens there is no session yet,
  // and a leftover selection used to leak its name into those screens.
  const showTopbarContext = screen === 'sheet' || screen === 'table'
  const topbarContext = !showTopbarContext
    ? undefined
    : screen === 'table'
      ? selectedSession?.name
      : contextLabel
  const topbarContextDetails = screen === 'table' && selectedSession
    ? `${selectedSession.ruleset === '2014' ? t(language, 'rules2014') : t(language, 'rules2024')} · ${characterCountLabel(tableSheetCount, language)}`
    : undefined
  const androidTable = androidPlatform && screen === 'table'

  return (
    <div
      className={`app theme-${state.theme}`}
      data-screen={screen}
      data-platform={androidPlatform ? 'android' : 'other'}
      data-table-curtain={androidTable ? (androidTableCurtainOpen ? 'open' : 'closed') : undefined}
    >
      <TopBar
        screen={screen}
        theme={state.theme}
        language={language}
        canGoBack={canGoBack}
        contextLabel={topbarContext}
        contextDetails={topbarContextDetails}
        onBack={goBack}
        onHome={goHome}
        onAddSheet={screen === 'table' ? () => addSharedSheet('center') : undefined}
        onExport={screen === 'table' || screen === 'sheet' ? handleExport : undefined}
        saveStatus={screen === 'sheet' ? saveStatus : undefined}
        ariaHidden={androidTable && !androidTableCurtainOpen}
        onToggleTheme={toggleTheme}
        onToggleLanguage={toggleLanguage}
      />
      {androidTable && (
        <>
          {androidTableCurtainOpen && (
            <button
              type="button"
              className="android-table-curtain-backdrop"
              aria-label={t(language, 'hideTableBar')}
              onClick={() => setAndroidTableCurtainOpen(false)}
            />
          )}
          <AndroidTableCurtain
            open={androidTableCurtainOpen}
            language={language}
            onOpen={() => setAndroidTableCurtainOpen(true)}
            onClose={() => setAndroidTableCurtainOpen(false)}
          />
        </>
      )}
      <main className="app-main">
        {screen === 'start' && <StartScreen language={language} onStart={() => setScreen('mode')} onExit={handleExit} />}
        {screen === 'mode' && <ModeScreen language={language} onChoose={openMode} />}
        {screen === 'profiles' && (
          <ProfileScreen
            language={language}
            profiles={state.profiles}
            selectedId={selectedProfileId}
            onSelect={setSelectedProfileId}
            onOpen={openProfile}
            onCreate={() => setModal('profile')}
            onDelete={(id) => requestDelete('profile', id)}
          />
        )}
        {screen === 'sessions' && (
          <SessionScreen
            language={language}
            mode={mode}
            profile={selectedProfile}
            sessions={visibleSessions}
            selectedId={selectedSessionId}
            onSelect={setSelectedSessionId}
            onOpen={openSession}
            onCreate={() => setModal('session')}
            onDelete={(id) => requestDelete('session', id)}
          />
        )}
        {screen === 'sheet' && activeSheet && selectedSession && (
          <SheetEditor
            language={language}
            sheet={activeSheet}
            session={selectedSession}
            profile={selectedProfile}
            onBack={goBack}
            onChange={(fieldId, value) => updateSheetValue(activeSheet.id, fieldId, value)}
          />
        )}
        {screen === 'table' && selectedSession && (
          <TableScreen
            language={language}
            sheets={state.sheets.filter((sheet) => sheet.sessionId === selectedSession.id)}
            onAdd={addSharedSheet}
            onOpen={(id) => { setActiveSheetId(id); setScreen('sheet') }}
            onMove={(id, position) => updateSheetPosition(id, position)}
            onDelete={(id) => requestDelete('sheet', id)}
          />
        )}
      </main>
      {toast && <Toast language={language} message={toast} />}
      {modal === 'profile' && <CreateProfileModal language={language} onCancel={() => setModal(null)} onCreate={createProfile} />}
      {modal === 'session' && <CreateSessionModal language={language} onCancel={() => setModal(null)} onCreate={createSession} />}
      {modal === 'delete' && deleteTarget && (
        <ConfirmDeleteModal
          language={language}
          kind={deleteTarget.kind}
          onCancel={() => { setModal(null); setDeleteTarget(null) }}
          onConfirm={confirmDelete}
        />
      )}
      {modal === 'exit' && <ExitModal language={language} onCancel={() => setModal(null)} onExit={() => { setExited(true); setModal(null) }} />}
    </div>
  )
}

function AndroidTableCurtain({ open, language, onOpen, onClose }: { open: boolean; language: Language; onOpen: () => void; onClose: () => void }) {
  const startY = useRef<number | null>(null)

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    startY.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (startY.current === null) return
    const delta = event.clientY - startY.current
    if (!open && delta > 24) {
      startY.current = null
      onOpen()
    } else if (open && delta < -24) {
      startY.current = null
      onClose()
    }
  }

  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    startY.current = null
  }

  function keyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    if (open) onClose()
    else onOpen()
  }

  return (
    <div
      className={`android-table-curtain-handle ${open ? 'is-open' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={t(language, open ? 'hideTableBar' : 'showTableBar')}
      aria-expanded={open}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
      onKeyDown={keyDown}
    >
      <span className="android-table-curtain-grip" aria-hidden="true" />
    </div>
  )
}

function SaveIndicator({ language, status }: { language: Language; status: SaveStatus }) {
  const label = t(language, status === 'saving' ? 'saving' : status === 'error' ? 'saveError' : 'saved')
  return <span className={`save-indicator topbar-save-indicator ${status}`} title={label} aria-label={label}><span className="save-dot" /><span className="save-label">{label}</span></span>
}

function TopBar({
  screen,
  theme,
  language,
  canGoBack,
  contextLabel,
  contextDetails,
  onBack,
  onHome,
  onAddSheet,
  onExport,
  saveStatus,
  ariaHidden,
  onToggleTheme,
  onToggleLanguage,
}: {
  screen: Screen
  theme: Theme
  language: Language
  canGoBack: boolean
  contextLabel?: string
  contextDetails?: string
  onBack: () => void
  onHome: () => void
  onAddSheet?: () => void
  onExport?: () => void
  saveStatus?: SaveStatus
  ariaHidden?: boolean
  onToggleTheme: () => void
  onToggleLanguage: () => void
}) {
  return (
    <header className="topbar" aria-hidden={ariaHidden || undefined}>
      <div className="topbar-left">
        {canGoBack && (
          <button className="icon-button topbar-nav" onClick={onBack} title={t(language, 'back')} aria-label={t(language, 'back')}>
            <ChevronLeft size={19} />
          </button>
        )}
        <div className="brand-lockup">
          <div className="brand-mark"><D20PageMark /></div>
          <div>
            <div className="brand-name">{t(language, 'appName')}</div>
            <div className="brand-subtitle">{t(language, 'appTagline')}</div>
          </div>
        </div>
      </div>
      <div className="topbar-center">
        {contextLabel && <span className="topbar-context">{contextLabel}</span>}
        {contextDetails && <><span className="topbar-separator topbar-context-separator">·</span><span className="topbar-context-details">{contextDetails}</span></>}
        {screen !== 'start' && (contextLabel || contextDetails) && <span className="topbar-separator">·</span>}
        {screen !== 'start' && <span className="topbar-hint">{t(language, 'localOnly')}</span>}
      </div>
      <div className="topbar-actions">
        {saveStatus && <SaveIndicator language={language} status={saveStatus} />}
        {onAddSheet && <button className="icon-button" onClick={onAddSheet} title={t(language, 'addSheet')} aria-label={t(language, 'addSheet')}><Plus size={18} /></button>}
        {onExport && <button className="icon-button" onClick={onExport} title={t(language, 'exportPdf')} aria-label={t(language, 'exportPdf')}><Download size={18} /></button>}
        <button className="icon-button" onClick={onHome} title={t(language, 'home')} aria-label={t(language, 'home')}>
          <Home size={18} />
        </button>
        <button className="icon-button" onClick={onToggleTheme} title={theme === 'dark' ? t(language, 'lightTheme') : t(language, 'darkTheme')} aria-label={t(language, 'theme')}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button className="language-button" onClick={onToggleLanguage} title={t(language, 'language')} aria-label={t(language, 'language')}>
          <Globe2 size={17} />
          <span>{language.toUpperCase()}</span>
        </button>
      </div>
    </header>
  )
}

const AUTHOR_NAME = 'F Works'

function StartScreen({ language, onStart, onExit }: { language: Language; onStart: () => void; onExit: () => void }) {
  return (
    <section className="start-screen page-enter">
      <div className="start-stars stars-one" />
      <div className="start-stars stars-two" />
      <div className="start-content">
        <div className="sigil large-sigil"><D20Mark /></div>
        <div className="eyebrow"><span className="eyebrow-line" /> D&D · 5e <span className="eyebrow-line" /></div>
        <h1>{t(language, 'appName')}</h1>
        <p className="start-lead">{t(language, 'appTagline')}</p>
        <div className="start-rule" />
        <p className="start-description">{language === 'ru' ? 'Создавайте листы, собирайте партию и держите всё важное под рукой.' : 'Create sheets, gather your party and keep everything important close at hand.'}</p>
        <div className="start-actions">
          <button className="button button-primary button-large" onClick={onStart}>
            <span>{t(language, 'start')}</span><ArrowRight size={18} />
          </button>
          <button className="button button-ghost button-large" onClick={onExit}>
            <LogOut size={17} /><span>{t(language, 'exit')}</span>
          </button>
        </div>
      </div>
      <div className="start-footer">D&D character workspace <span>•</span> local-first <span>•</span> {t(language, 'author')}: {AUTHOR_NAME}</div>
    </section>
  )
}

function D20Mark() {
  return (
    <svg viewBox="0 0 100 100" className="d20-mark" aria-hidden="true">
      <path d="M50 5 91 27v46L50 95 9 73V27L50 5Z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m50 5 9 22-9 68-9-68 9-22ZM9 27l32 0 9 22-41-4 0-18ZM91 27 59 27 50 49l41-4V27ZM9 73l41-4-9 22-32 4V73ZM91 73 59 73 50 95l41-22v0Z" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".72" />
      <circle cx="50" cy="49" r="5" fill="currentColor" opacity=".9" />
    </svg>
  )
}

function D20PageMark() {
  return (
    <svg viewBox="0 0 48 48" className="brand-mark-svg" aria-hidden="true">
      <path d="M11 9.5h20a3 3 0 0 1 3 3v21.2a2.8 2.8 0 0 1-3.1 2.8L11 33.3V9.5Z" fill="#f4ead6" />
      <path d="M15 15h14M15 19h12M15 23h13M15 27h9" stroke="#9b896e" strokeWidth="1.5" strokeLinecap="round" opacity=".75" />
      <path d="m31.5 14.5 8 4.6v9.2l-8 4.7-8-4.7v-9.2l8-4.6Z" fill="#d7a85d" stroke="#fff1c8" strokeWidth="1.3" />
      <path d="m31.5 14.5v9.3m0 0 8-4.6m-8 4.6-8-4.6m8 4.6v9.2" fill="none" stroke="#704326" strokeWidth="1" />
      <circle cx="31.5" cy="23.8" r="1.5" fill="#6c3e2d" />
    </svg>
  )
}

function ModeScreen({ language, onChoose }: { language: Language; onChoose: (mode: Mode) => void }) {
  return (
    <section className="center-page page-enter">
      <div className="page-heading mode-heading">
        <div className="heading-icon"><Layers3 size={21} /></div>
        <div>
          <div className="eyebrow compact">CODEx / 01</div>
          <h1>{t(language, 'chooseMode')}</h1>
          <p>{t(language, 'chooseModeHint')}</p>
        </div>
      </div>
      <div className="mode-grid">
        <ModeCard
          icon={<UserRound size={27} />}
          badge={t(language, 'individualModeBadge')}
          title={t(language, 'individualMode')}
          description={t(language, 'individualModeHint')}
          accent="violet"
          onClick={() => onChoose('individual')}
          language={language}
        />
        <ModeCard
          icon={<Users size={27} />}
          badge={t(language, 'sharedModeBadge')}
          title={t(language, 'sharedMode')}
          description={t(language, 'sharedModeHint')}
          accent="amber"
          onClick={() => onChoose('shared')}
          language={language}
        />
      </div>
      <div className="flow-note"><Sparkles size={15} /> {language === 'ru' ? 'Выбор режима можно изменить позже — данные останутся на устройстве.' : 'You can choose another mode later — your data stays on this device.'}</div>
    </section>
  )
}

function ModeCard({ icon, badge, title, description, accent, onClick, language }: { icon: ReactNode; badge: string; title: string; description: string; accent: string; onClick: () => void; language: Language }) {
  return (
    <button className={`mode-card accent-${accent}`} onClick={onClick}>
      <div className="mode-card-top"><span className="mode-icon">{icon}</span><span className="mode-badge">{badge}</span><ArrowRight className="mode-arrow" size={19} /></div>
      <div className="mode-card-copy"><h2>{title}</h2><p>{description}</p></div>
      <div className="mode-card-footer"><span>{language === 'ru' ? 'Открыть режим' : 'Open mode'}</span><span className="mini-line" /></div>
    </button>
  )
}

function PageHeader({ icon, eyebrow, title, description, language }: { icon: ReactNode; eyebrow: string; title: string; description: string; language: Language }) {
  return (
    <div className="page-heading">
      <div className="heading-icon">{icon}</div>
      <div><div className="eyebrow compact">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>
    </div>
  )
}

function ProfileScreen({ language, profiles, selectedId, onSelect, onOpen, onCreate, onDelete }: { language: Language; profiles: Profile[]; selectedId: string | null; onSelect: (id: string) => void; onOpen: (id: string) => void; onCreate: () => void; onDelete: (id: string) => void }) {
  return (
    <section className="center-page page-enter selection-page">
      <PageHeader icon={<UserRound size={21} />} eyebrow="CODEx / 02" title={t(language, 'chooseProfile')} description={t(language, 'chooseProfileHint')} language={language} />
      <div className="selection-meta"><span className="meta-dot" /> {countLabel(language, profiles.length, 'profile')} <span className="meta-divider" /> <span>{t(language, 'localOnly')}</span></div>
      {profiles.length === 0 ? <EmptyState icon={<UserRound size={28} />} title={t(language, 'noProfiles')} description={t(language, 'noProfilesHint')} /> : <div className="entity-grid">{profiles.map((profile) => <EntityCard key={profile.id} kind="profile" item={profile} language={language} selected={selectedId === profile.id} onSelect={onSelect} onOpen={onOpen} onDelete={onDelete} />)}</div>}
      <button className="add-tile" onClick={onCreate}><span className="add-tile-icon"><Plus size={21} /></span><span><strong>{t(language, 'createProfile')}</strong><small>{language === 'ru' ? 'Добавьте нового игрока' : 'Add a new player'}</small></span><ArrowRight size={17} /></button>
    </section>
  )
}

function SessionScreen({ language, mode, profile, sessions, selectedId, onSelect, onOpen, onCreate, onDelete }: { language: Language; mode: Mode; profile?: Profile; sessions: Session[]; selectedId: string | null; onSelect: (id: string) => void; onOpen: (id: string) => void; onCreate: () => void; onDelete: (id: string) => void }) {
  const title = t(language, 'chooseSession')
  const description = mode === 'individual' && profile ? `${profile.name} · ${t(language, 'doubleClickHint')}` : t(language, 'doubleClickHint')
  return (
    <section className="center-page page-enter selection-page">
      <PageHeader icon={<BookOpen size={21} />} eyebrow={mode === 'individual' ? 'CODEx / 03' : 'CODEx / 02'} title={title} description={description} language={language} />
      {profile && <div className="active-context-chip"><UserRound size={14} /><span>{t(language, 'activeProfile')}: <strong>{profile.name}</strong></span></div>}
      <div className="selection-meta"><span className="meta-dot amber" /> {countLabel(language, sessions.length, 'session')} <span className="meta-divider" /> <span>{t(language, 'localOnly')}</span></div>
      {sessions.length === 0 ? <EmptyState icon={<BookOpen size={28} />} title={t(language, 'noSessions')} description={t(language, 'noSessionsHint')} /> : <div className="entity-grid">{sessions.map((session) => <EntityCard key={session.id} kind="session" item={session} language={language} selected={selectedId === session.id} onSelect={onSelect} onOpen={onOpen} onDelete={onDelete} />)}</div>}
      <button className="add-tile" onClick={onCreate}><span className="add-tile-icon"><Plus size={21} /></span><span><strong>{t(language, 'createSession')}</strong><small>{language === 'ru' ? 'Настройте правила и формат листа' : 'Choose rules and sheet format'}</small></span><ArrowRight size={17} /></button>
    </section>
  )
}

function EntityCard({ kind, item, language, selected, onSelect, onOpen, onDelete }: { kind: 'profile' | 'session'; item: Profile | Session; language: Language; selected: boolean; onSelect: (id: string) => void; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  const isProfile = kind === 'profile'
  const name = item.name
  return (
    <div className={`entity-card ${selected ? 'is-selected' : ''}`} role="button" tabIndex={0} onClick={() => onSelect(item.id)} onDoubleClick={() => onOpen(item.id)} onKeyDown={(event) => { if (event.key === 'Enter') onOpen(item.id) }}>
      <div className={`entity-avatar ${isProfile ? 'profile-avatar' : 'session-avatar'}`}>{isProfile ? initials(name) : <BookOpen size={23} />}</div>
      <div className="entity-copy"><span className="entity-type">{isProfile ? t(language, 'profile') : t(language, 'session')}</span><strong>{name}</strong>{!isProfile && <span className="entity-badges"><span className={`badge badge-${(item as Session).ruleset}`}>{t(language, (item as Session).ruleset === '2014' ? 'rules2014' : 'rules2024')}</span><span className="badge badge-template">{t(language, (item as Session).template === 'full' ? 'fullTemplate' : 'compactTemplate')}</span></span>}</div>
      {selected ? <button className="entity-delete" onClick={(event) => { event.stopPropagation(); onDelete(item.id) }} title={t(language, 'delete')} aria-label={t(language, 'delete')}><Trash2 size={17} /></button> : <span className="entity-placeholder" />}
      {selected && <span className="selected-check"><Check size={13} /></span>}
    </div>
  )
}

function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h2>{title}</h2><p>{description}</p></div>
}

function ModalShell({ children, title, eyebrow, onCancel, wide = false, language }: { children: ReactNode; title: string; eyebrow?: string; onCancel: () => void; wide?: boolean; language: Language }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <div className={`modal-card ${wide ? 'modal-wide' : ''} page-enter`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header"><div>{eyebrow && <div className="eyebrow compact">{eyebrow}</div>}<h2>{title}</h2></div><button className="icon-button" onClick={onCancel} title={t(language, 'close')} aria-label={t(language, 'close')}><X size={18} /></button></div>
        {children}
      </div>
    </div>
  )
}

function CreateProfileModal({ language, onCancel, onCreate }: { language: Language; onCancel: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])
  function submit(event: FormEvent) { event.preventDefault(); if (normalizeName(name)) onCreate(name) }
  return <ModalShell language={language} title={t(language, 'newProfile')} eyebrow="CODEx / CREATE" onCancel={onCancel}><form className="modal-form" onSubmit={submit}><label>{t(language, 'profileName')}<input ref={inputRef} value={name} onChange={(event) => setName(event.target.value)} placeholder={t(language, 'profileNamePlaceholder')} maxLength={40} /></label><div className="modal-actions"><button type="button" className="button button-ghost" onClick={onCancel}>{t(language, 'cancel')}</button><button type="submit" className="button button-primary" disabled={!normalizeName(name)}>{t(language, 'create')} <ArrowRight size={16} /></button></div></form></ModalShell>
}

function CreateSessionModal({ language, onCancel, onCreate }: { language: Language; onCancel: () => void; onCreate: (name: string, ruleset: Ruleset, template: SheetTemplate) => void }) {
  const [name, setName] = useState('')
  const [ruleset, setRuleset] = useState<Ruleset>('2014')
  const [template, setTemplate] = useState<SheetTemplate>('full')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])
  function submit(event: FormEvent) { event.preventDefault(); if (normalizeName(name)) onCreate(name, ruleset, template) }
  return <ModalShell language={language} title={t(language, 'newSession')} eyebrow="CODEx / CREATE" onCancel={onCancel} wide><form className="modal-form" onSubmit={submit}><label>{t(language, 'sessionName')}<input ref={inputRef} value={name} onChange={(event) => setName(event.target.value)} placeholder={t(language, 'sessionNamePlaceholder')} maxLength={60} /></label><div className="form-section"><span className="form-label">{t(language, 'rulesVersion')}</span><div className="choice-row"><ChoiceButton active={ruleset === '2014'} onClick={() => setRuleset('2014')} title={t(language, 'rules2014')} description={language === 'ru' ? 'Классическая редакция' : 'Classic edition'} /><ChoiceButton active={ruleset === '2024'} onClick={() => setRuleset('2024')} title={t(language, 'rules2024')} description={language === 'ru' ? 'Обновлённая редакция' : 'Revised edition'} /></div></div><div className="form-section"><span className="form-label">{t(language, 'sheetFormat')}</span><div className="choice-row"><ChoiceButton active={template === 'full'} onClick={() => setTemplate('full')} title={t(language, 'fullTemplate')} description={t(language, 'fullTemplateHint')} /><ChoiceButton active={template === 'compact'} onClick={() => setTemplate('compact')} title={t(language, 'compactTemplate')} description={t(language, 'compactTemplateHint')} /></div></div><div className="modal-actions"><button type="button" className="button button-ghost" onClick={onCancel}>{t(language, 'cancel')}</button><button type="submit" className="button button-primary" disabled={!normalizeName(name)}>{t(language, 'create')} <ArrowRight size={16} /></button></div></form></ModalShell>
}

function ChoiceButton({ active, onClick, title, description }: { active: boolean; onClick: () => void; title: string; description: string }) {
  return <button type="button" className={`choice-button ${active ? 'is-active' : ''}`} onClick={onClick}><span className="choice-radio">{active && <Check size={12} />}</span><span><strong>{title}</strong><small>{description}</small></span></button>
}

function ConfirmDeleteModal({ language, kind, onCancel, onConfirm }: { language: Language; kind: 'profile' | 'session' | 'sheet'; onCancel: () => void; onConfirm: () => void }) {
  const title = kind === 'profile' ? 'deleteProfile' : kind === 'session' ? 'deleteSession' : 'deleteSheet'
  const text = kind === 'profile' ? 'deleteProfileText' : kind === 'session' ? 'deleteSessionText' : 'deleteSheetText'
  return <ModalShell language={language} title={t(language, title)} eyebrow="CODE X / WARNING" onCancel={onCancel}><div className="warning-copy"><div className="warning-icon"><Trash2 size={21} /></div><p>{t(language, text)}</p></div><div className="modal-actions"><button className="button button-ghost" onClick={onCancel}>{t(language, 'cancel')}</button><button className="button button-danger" onClick={onConfirm}>{t(language, 'delete')} <Trash2 size={16} /></button></div></ModalShell>
}

function ExitModal({ language, onCancel, onExit }: { language: Language; onCancel: () => void; onExit: () => void }) {
  return <ModalShell language={language} title={t(language, 'exit')} eyebrow="CODE X" onCancel={onCancel}><div className="exit-copy">{language === 'ru' ? 'Приложение готово закрыть это окно.' : 'The application is ready to close this window.'}</div><div className="modal-actions"><button className="button button-ghost" onClick={onCancel}>{t(language, 'cancel')}</button><button className="button button-primary" onClick={onExit}>{t(language, 'exit')} <LogOut size={16} /></button></div></ModalShell>
}

function SheetEditor({ language, sheet, session, profile, onBack, onChange }: { language: Language; sheet: Sheet; session: Session; profile?: Profile; onBack: () => void; onChange: (fieldId: string, value: string) => void }) {
  const [openHelp, setOpenHelp] = useState<Record<string, boolean>>({})
  const fields = useMemo(() => getFields(session.template, session.ruleset, language), [session.template, session.ruleset, language])
  const rulesLabel = t(language, session.ruleset === '2014' ? 'rules2014' : 'rules2024')
  const templateLabel = t(language, session.template === 'full' ? 'full' : 'compact')
  return (
    <section className="sheet-screen page-enter">
      <div className="paper-sheet printable-sheet">
        <div className="paper-topline"><span>{t(language, 'sheet')}</span><span>{rulesLabel} · {templateLabel}</span></div>
        <div className="paper-identity">
          <div className="paper-name-block"><div className="paper-kicker">{t(language, 'character')}</div><input className="paper-name-input" value={sheet.values.characterName ?? ''} onChange={(event) => onChange('characterName', event.target.value)} placeholder={t(language, 'untitledCharacter')} /></div>
          <div className="paper-identity-meta">
            <span>{t(language, 'session')}: <strong>{session.name}</strong></span>
            <span>{t(language, 'rules')}: <strong>{rulesLabel}</strong></span>
            <span>{t(language, 'sheetFormat')}: <strong>{templateLabel}</strong></span>
          </div>
        </div>
        <div className="paper-sections">{groupOrder.map((group) => { const groupFields = getGroupFields(fields, group); if (!groupFields.length) return null; return <PaperSection key={group} group={group} fields={groupFields} language={language} values={sheet.values} openHelp={openHelp} onToggleHelp={(id) => setOpenHelp((current) => ({ ...current, [id]: !current[id] }))} onChange={onChange} /> })}</div>
        <div className="paper-footer"><span>{t(language, 'localOnly')}</span><span>{t(language, 'appName')} · D&D 5e</span></div>
      </div>
      <div className="sheet-bottom-bar">
        <button className="back-pill" onClick={onBack}><ArrowLeft size={15} /> {profile ? t(language, 'back') : t(language, 'exitSheet')}</button>
        <div className="sheet-help-hint"><HelpCircle size={15} /> {t(language, 'helpTitle')}: {t(language, 'sheetHelpText')}</div>
      </div>
    </section>
  )
}

function PaperSection({ group, fields, language, values, openHelp, onToggleHelp, onChange }: { group: FieldGroup; fields: SheetField[]; language: Language; values: Record<string, string>; openHelp: Record<string, boolean>; onToggleHelp: (id: string) => void; onChange: (id: string, value: string) => void }) {
  const compactGroup = fields.length <= 6
  return <section className={`paper-section ${compactGroup ? 'compact-section' : ''}`}><div className="paper-section-title"><span>{groupLabels[group][language]}</span><span className="paper-section-line" /></div><div className="field-grid">{fields.map((item) => <FieldRow key={item.id} item={item} language={language} value={values[item.id] ?? ''} helpOpen={Boolean(openHelp[item.id])} onToggleHelp={() => onToggleHelp(item.id)} onChange={(value) => onChange(item.id, value)} />)}</div></section>
}

function FieldRow({ item, language, value, helpOpen, onToggleHelp, onChange }: { item: SheetField; language: Language; value: string; helpOpen: boolean; onToggleHelp: () => void; onChange: (value: string) => void }) {
  return <div className={`field-row ${item.fullWidth ? 'field-full' : ''} ${helpOpen ? 'help-open' : ''}`}><label className="field-label" htmlFor={`field-${item.id}`}>{text(item.label, language)}</label><div className="field-control">{helpOpen ? <div className="field-help" id={`field-${item.id}`}><HelpCircle size={15} /><span>{text(item.description, language)}</span></div> : item.type === 'textarea' ? <textarea id={`field-${item.id}`} value={value} onChange={(event) => onChange(event.target.value)} placeholder={item.placeholder ? text(item.placeholder, language) : ''} rows={item.rows ?? 3} /> : <input id={`field-${item.id}`} type={item.type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={item.placeholder ? text(item.placeholder, language) : ''} />}</div><button type="button" className={`field-help-button ${helpOpen ? 'is-active' : ''}`} onClick={onToggleHelp} title={helpOpen ? t(language, 'closeHelp') : t(language, 'help')} aria-label={helpOpen ? t(language, 'closeHelp') : `${t(language, 'help')}: ${text(item.label, language)}`}>{helpOpen ? <X size={15} /> : <HelpCircle size={16} />}</button></div>
}

function TableScreen({ language, sheets, onAdd, onOpen, onMove, onDelete }: { language: Language; sheets: Sheet[]; onAdd: (position: TablePosition) => void; onOpen: (id: string) => void; onMove: (id: string, position: { x: number; y: number }) => void; onDelete: (id: string) => void }) {
  const worldWidth = 1500
  const defaultScale = 0.72
  const minScale = 0.15
  const maxScale = 1.35
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: defaultScale })
  const viewportRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ lastX: number; lastY: number } | null>(null)
  const activePointers = useRef(new Map<number, TablePointer>())
  const pinch = useRef<PinchState | null>(null)
  const cardDrag = useRef<CardDragState | null>(null)
  const draggedCardIds = useRef(new Set<string>())
  const [dragging, setDragging] = useState(false)
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)
  const [draftPositions, setDraftPositions] = useState<Record<string, { x: number; y: number }>>({})
  const worldHeight = Math.max(980, 260 + Math.ceil(Math.max(sheets.length, 1) / 4) * 470)
  const worldStyle: CSSProperties = {
    height: worldHeight,
    marginLeft: -worldWidth / 2,
    marginTop: -worldHeight / 2,
    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
  }

  function clampViewport(next: Viewport): Viewport {
    const bounds = viewportRef.current?.getBoundingClientRect()
    const viewportWidth = bounds?.width ?? 1200
    const viewportHeight = bounds?.height ?? 700
    const horizontalLimit = Math.max(260, (worldWidth * next.scale - viewportWidth) / 2 + 280)
    const verticalLimit = Math.max(220, (worldHeight * next.scale - viewportHeight) / 2 + 240)
    return {
      ...next,
      x: Math.min(horizontalLimit, Math.max(-horizontalLimit, next.x)),
      y: Math.min(verticalLimit, Math.max(-verticalLimit, next.y)),
    }
  }

  function updateViewport(updater: (current: Viewport) => Viewport) {
    setViewport((current) => clampViewport(updater(current)))
  }

  function zoom(delta: number) {
    updateViewport((current) => ({ ...current, scale: Math.min(maxScale, Math.max(minScale, current.scale + delta)) }))
  }

  function reset() {
    updateViewport(() => ({ x: 0, y: 0, scale: defaultScale }))
  }

  function center() {
    updateViewport((current) => ({ ...current, x: 0, y: 0 }))
  }

  function pointerDistance(): number {
    const points = [...activePointers.current.values()]
    if (points.length < 2) return 0
    const [first, second] = points
    return Math.hypot(second.x - first.x, second.y - first.y)
  }

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest('.table-sheet-card, .empty-table-card, .edge-add, .zoom-controls, .table-instruction')) return
    if (event.pointerType === 'touch') {
      activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (activePointers.current.size >= 2) {
        pinch.current = { distance: pointerDistance(), scale: viewport.scale }
        drag.current = null
        setDragging(false)
        event.currentTarget.setPointerCapture(event.pointerId)
        return
      }
    }
    drag.current = { lastX: event.clientX, lastY: event.clientY }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch' && activePointers.current.has(event.pointerId)) {
      activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (activePointers.current.size >= 2 && pinch.current) {
        const nextDistance = pointerDistance()
        const nextScale = Math.min(maxScale, Math.max(minScale, pinch.current.scale * (nextDistance / Math.max(1, pinch.current.distance))))
        updateViewport((view) => ({ ...view, scale: nextScale }))
        return
      }
    }
    if (!drag.current) return
    const current = drag.current
    const deltaX = event.clientX - current.lastX
    const deltaY = event.clientY - current.lastY
    drag.current = { lastX: event.clientX, lastY: event.clientY }
    updateViewport((view) => ({ ...view, x: view.x + deltaX, y: view.y + deltaY }))
  }

  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    activePointers.current.delete(event.pointerId)
    if (activePointers.current.size < 2) pinch.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    drag.current = null
    setDragging(false)
  }

  function wheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault()
    zoom(event.deltaY > 0 ? -0.06 : 0.06)
  }

  function cardPointerDown(event: ReactPointerEvent<HTMLDivElement>, sheet: Sheet) {
    if (event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    cardDrag.current = {
      id: sheet.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: sheet.x,
      originY: sheet.y,
      x: sheet.x,
      y: sheet.y,
      moved: false,
    }
    setDraggingCardId(sheet.id)
  }

  function cardPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = cardDrag.current
    if (!current || current.pointerId !== event.pointerId) return
    const x = current.originX + (event.clientX - current.startX) / viewport.scale
    const y = current.originY + (event.clientY - current.startY) / viewport.scale
    const moved = current.moved || Math.abs(event.clientX - current.startX) + Math.abs(event.clientY - current.startY) > 4
    cardDrag.current = { ...current, x, y, moved }
    if (moved) draggedCardIds.current.add(current.id)
    setDraftPositions((positions) => ({ ...positions, [current.id]: { x, y } }))
  }

  function cardPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const current = cardDrag.current
    if (!current || current.pointerId !== event.pointerId) return
    if (current.moved) onMove(current.id, { x: current.x, y: current.y })
    else if (event.pointerType === 'touch') {
      draggedCardIds.current.add(current.id)
      onOpen(current.id)
    }
    setDraftPositions((positions) => {
      const next = { ...positions }
      delete next[current.id]
      return next
    })
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    cardDrag.current = null
    setDraggingCardId(null)
  }

  function cardDoubleClick(sheet: Sheet) {
    if (draggedCardIds.current.has(sheet.id)) {
      draggedCardIds.current.delete(sheet.id)
      return
    }
    onOpen(sheet.id)
  }

  const displayedSheets = sheets.map((sheet) => {
    const draft = draftPositions[sheet.id]
    return draft ? { ...sheet, ...draft } : sheet
  })

  return (
    <section className="table-screen page-enter">
      <div ref={viewportRef} className={`table-viewport ${dragging ? 'is-dragging' : ''} ${draggingCardId ? 'is-card-dragging' : ''}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onWheel={wheel}>
        <div className="table-grid-glow" />
        <div className="table-world" style={worldStyle}>
          {displayedSheets.map((sheet, index) => <TableSheetCard key={sheet.id} sheet={sheet} language={language} index={index} dragging={sheet.id === draggingCardId} onOpen={() => cardDoubleClick(sheet)} onDelete={() => onDelete(sheet.id)} onPointerDown={(event) => cardPointerDown(event, sheet)} onPointerMove={cardPointerMove} onPointerUp={cardPointerUp} />)}
          {sheets.length === 0 && <button className="empty-table-card" onPointerDown={(event) => event.stopPropagation()} onClick={() => onAdd('center')}><Plus size={22} /><strong>{t(language, 'emptyTable')}</strong><span>{t(language, 'emptyTableHint')}</span></button>}
        </div>
        <div className="edge-add edge-add-top"><button onClick={() => onAdd('top')}><PanelTop size={15} /><Plus size={13} /> {t(language, 'addTop')}</button></div>
        <div className="edge-add edge-add-bottom"><button onClick={() => onAdd('bottom')}><PanelBottom size={15} /><Plus size={13} /> {t(language, 'addBottom')}</button></div>
        <div className="edge-add edge-add-left"><button onClick={() => onAdd('left')}><PanelLeft size={15} /><Plus size={13} /> {t(language, 'addLeft')}</button></div>
        <div className="edge-add edge-add-right"><button onClick={() => onAdd('right')}><PanelRight size={15} /><Plus size={13} /> {t(language, 'addRight')}</button></div>
        <div className="zoom-controls"><button onClick={() => zoom(-0.08)} title={t(language, 'zoomOut')}><ZoomOut size={16} /></button><span>{Math.round(viewport.scale * 100)}%</span><button onClick={() => zoom(0.08)} title={t(language, 'zoomIn')}><ZoomIn size={16} /></button><button onClick={center} title={t(language, 'centerTable')}><Home size={15} /></button><button onClick={reset} title={t(language, 'resetZoom')}><RotateCcw size={15} /></button></div>
        <div className="table-instruction"><MousePointer2 size={15} /> {t(language, 'tableHint')}</div>
      </div>
    </section>
  )
}

function TableSheetCard({ sheet, language, index, dragging, onOpen, onDelete, onPointerDown, onPointerMove, onPointerUp }: { sheet: Sheet; language: Language; index: number; dragging: boolean; onOpen: () => void; onDelete: () => void; onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void; onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void; onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void }) {
  const name = characterName(sheet, language)
  const classLevel = characterClass(sheet, language)
  const hp = sheet.values.currentHitPoints || '—'
  const armor = sheet.values.armorClass || '—'
  const accent = ['violet', 'amber', 'teal', 'rose'][index % 4]
  return (
    <div
      className={`table-sheet-card accent-${accent} ${dragging ? 'is-dragging' : ''}`}
      role="button"
      tabIndex={0}
      draggable={false}
      style={{ left: sheet.x, top: sheet.y, transform: `translate(-50%, -50%) rotate(${sheet.rotation}deg)` }}
      onDoubleClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <button
        className="table-card-delete"
        type="button"
        title={t(language, 'deleteSheet')}
        aria-label={t(language, 'deleteSheet')}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onDelete()
        }}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <Trash2 size={15} />
      </button>
      <div className="table-card-inner">
        <div className="table-card-top"><span className="table-card-dot" /><span>{sheet.profileId ? 'PLAYER' : 'SHEET'}</span></div>
        <div className="table-card-name">{name}</div>
        <div className="table-card-class">{classLevel}</div>
        <div className="table-card-rule" />
        <div className="table-card-stats"><span><small>HP</small><strong>{hp}</strong></span><span><small>AC</small><strong>{armor}</strong></span><span><small>{language === 'ru' ? 'УР.' : 'LVL'}</small><strong>{sheet.values.classLevel?.match(/\d+/)?.[0] ?? '—'}</strong></span></div>
        <div className="table-card-footer"><span>{isNativePlatform() ? (language === 'ru' ? 'Нажмите' : 'Tap') : (language === 'ru' ? 'Двойной щелчок' : 'Double-click')}</span><ArrowRight size={14} /></div>
      </div>
    </div>
  )
}

function Toast({ language, message }: { language: Language; message: string }) {
  return <div className="toast" role="status"><span className="toast-icon"><Check size={15} /></span><span>{message}</span><span className="toast-language">{language.toUpperCase()}</span></div>
}

function ExitScreen({ language, onClose }: { language: Language; onClose: () => void }) {
  return <div className="exit-screen"><D20Mark /><h1>{t(language, 'exit')}</h1><p>{language === 'ru' ? 'Окно приложения можно закрыть.' : 'You can close the application window.'}</p><button className="button button-primary" onClick={onClose}>{language === 'ru' ? 'Вернуться' : 'Go back'}</button></div>
}

export default App
