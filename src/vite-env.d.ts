/// <reference types="vite/client" />

declare global {
  interface Window {
    desktop?: {
      close: () => void
      print: () => void
      printPdf: () => Promise<boolean>
      setLanguage: (language: 'ru' | 'en') => void
    }
  }
}

export {}
