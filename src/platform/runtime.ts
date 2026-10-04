import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { ScreenOrientation, type OrientationLockType } from '@capacitor/screen-orientation'
import { Share } from '@capacitor/share'

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform()
}

export function isAndroidPlatform(): boolean {
  return Capacitor.getPlatform() === 'android'
}

type LandscapeOrientation = Extract<OrientationLockType, 'landscape-primary' | 'landscape-secondary'>
let orientationRequest = 0

function isLandscapeOrientation(value: string): value is LandscapeOrientation {
  return value === 'landscape-primary' || value === 'landscape-secondary'
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Keeps Android portrait everywhere except for the shared table. When the
 * table opens, first enter landscape and then lock the actual landscape side
 * chosen by Android, so the table cannot accidentally rotate by 180 degrees.
 */
export async function setAndroidScreenOrientation(tableVisible: boolean): Promise<void> {
  if (!isAndroidPlatform()) return

  const request = ++orientationRequest
  if (!tableVisible) {
    await ScreenOrientation.lock({ orientation: 'portrait' })
    return
  }

  await ScreenOrientation.lock({ orientation: 'landscape' })
  const deadline = Date.now() + 1600
  let landscapeType: LandscapeOrientation | null = null

  while (Date.now() < deadline) {
    const current = await ScreenOrientation.orientation()
    if (isLandscapeOrientation(current.type)) {
      landscapeType = current.type
      break
    }
    await wait(50)
  }

  if (request !== orientationRequest) return
  await ScreenOrientation.lock({ orientation: landscapeType ?? 'landscape-primary' })
}

export async function installAndroidBackButton(handler: () => void): Promise<() => void> {
  if (!isAndroidPlatform()) return () => undefined
  const listener = await CapacitorApp.addListener('backButton', () => handler())
  return () => {
    void listener.remove()
  }
}

export async function exitNativeApp(): Promise<void> {
  if (isNativePlatform()) await CapacitorApp.exitApp()
}

export async function exportElementAsPdf(element: HTMLElement, fileName: string, dialogTitle: string): Promise<boolean> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const elementWidth = Math.max(1, element.scrollWidth || element.clientWidth)
  const elementHeight = Math.max(1, element.scrollHeight || element.clientHeight)
  const maxCanvasPixels = 8_000_000
  const scale = Math.min(2, Math.max(0.1, Math.sqrt(maxCanvasPixels / (elementWidth * elementHeight))))
  const canvas = await html2canvas(element, {
    backgroundColor: '#f4ead6',
    scale,
    useCORS: true,
    logging: false,
  })
  const image = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imageHeight = (canvas.height * pageWidth) / canvas.width
  let heightLeft = imageHeight
  let position = 0

  pdf.addImage(image, 'PNG', 0, position, pageWidth, imageHeight)
  heightLeft -= pageHeight
  while (heightLeft > 0) {
    position = heightLeft - imageHeight
    pdf.addPage()
    pdf.addImage(image, 'PNG', 0, position, pageWidth, imageHeight)
    heightLeft -= pageHeight
  }

  const base64 = pdf.output('datauristring').split(',')[1] ?? ''
  const safeFileName = fileName.replace(/[\\/:*?"<>|]/g, '_').trim() || 'character-sheet'
  const result = await Filesystem.writeFile({
    path: `${safeFileName}.pdf`,
    data: base64,
    directory: Directory.Cache,
  })
  try {
    await Share.share({
      title: safeFileName,
      dialogTitle,
      url: result.uri,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/cancel|abort/i.test(message)) return false
    throw error
  }
  return true
}
