import { mkdir, copyFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pngToIco from 'png-to-ico'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const iconSvg = path.join(root, 'assets', 'icon.svg')
const foregroundSvg = path.join(root, 'assets', 'icon-foreground.svg')
const buildDir = path.join(root, 'build')
const publicDir = path.join(root, 'public')
const androidRes = path.join(root, 'android', 'app', 'src', 'main', 'res')

await mkdir(buildDir, { recursive: true })
await mkdir(publicDir, { recursive: true })
await copyFile(iconSvg, path.join(publicDir, 'icon.svg'))

await sharp(iconSvg).resize(1024, 1024).png().toFile(path.join(buildDir, 'icon.png'))
await sharp(foregroundSvg).resize(1024, 1024).png().toFile(path.join(buildDir, 'icon-foreground.png'))

// A multi-resolution ICO is required by Windows for the executable, taskbar,
// shortcuts, installer, and uninstaller. A single 256px image is not enough.
const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const icoImages = await Promise.all(
  icoSizes.map((size) => sharp(iconSvg).resize(size, size).png().toBuffer()),
)
const ico = await pngToIco(icoImages)
await writeFile(path.join(buildDir, 'icon.ico'), ico)
await copyFile(path.join(buildDir, 'icon.ico'), path.join(buildDir, 'installerIcon.ico'))
await copyFile(path.join(buildDir, 'icon.ico'), path.join(buildDir, 'uninstallerIcon.ico'))

// Linux packagers expect an icon set whose filenames contain the pixel size.
const linuxIconDir = path.join(buildDir, 'icons')
await mkdir(linuxIconDir, { recursive: true })
for (const size of [...icoSizes, 512]) {
  await sharp(iconSvg).resize(size, size).png().toFile(path.join(linuxIconDir, `${size}x${size}.png`))
}

const densities = [
  ['mdpi', 48, 108],
  ['hdpi', 72, 162],
  ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324],
  ['xxxhdpi', 192, 432],
]

for (const [density, legacySize, foregroundSize] of densities) {
  const targetDir = path.join(androidRes, `mipmap-${density}`)
  await mkdir(targetDir, { recursive: true })
  await sharp(iconSvg).resize(legacySize, legacySize).png().toFile(path.join(targetDir, 'ic_launcher.png'))
  await sharp(iconSvg).resize(legacySize, legacySize).png().toFile(path.join(targetDir, 'ic_launcher_round.png'))
  await sharp(foregroundSvg).resize(foregroundSize, foregroundSize).png().toFile(path.join(targetDir, 'ic_launcher_foreground.png'))
}

console.log('Icons generated: build/icon.ico, build/icons, public/icon.svg, Android mipmap resources')
