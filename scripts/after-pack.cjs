const fs = require('node:fs')
const path = require('node:path')

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const iconPath = path.resolve(__dirname, '..', 'build', 'icon.ico')
  const executablePath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.exe`,
  )

  if (!fs.existsSync(iconPath)) {
    throw new Error(`Windows icon not found: ${iconPath}`)
  }
  if (!fs.existsSync(executablePath)) {
    throw new Error(`Packaged executable not found: ${executablePath}`)
  }

  // electron-builder's built-in Windows resource editor requires winCodeSign,
  // which cannot be extracted on this Windows host because symbolic links are
  // disabled. rcedit is a small, local post-pack editor and applies the icon
  // without downloading or signing tools.
  const { rcedit } = await import('rcedit')
  await rcedit(executablePath, { icon: iconPath })
  console.log(`Applied Windows icon: ${executablePath}`)
}
