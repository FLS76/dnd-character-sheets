import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Spawn node against electron-builder's own CLI entry point instead of the
// node_modules/.bin shim: the shim is a shell script on Linux and a .cmd on
// Windows, and Node refuses to spawn a .cmd without a shell.
const cli = path.join(root, 'node_modules', 'electron-builder', 'cli.js')

// Полная Linux-сборка (.AppImage и .deb) возможна только на Linux.
// Проверено на Windows 2026-09-26: сборка доходит до упаковки linux-unpacked,
// но затем требует запуска Linux-бинарников (mksquashfs) и создания символьных
// ссылок, что Windows не умеет ни при каких правах. Варианты: собрать в WSL
// либо на Windows использовать npm run package:linux:dir для linux-unpacked.
if (process.platform !== 'linux') {
  console.error('Полная Linux-сборка (.AppImage и .deb) запускается только в Linux.')
  console.error('Варианты: WSL, либо на Windows npm run package:linux:dir для linux-unpacked.')
  process.exit(1)
}

if (!existsSync(cli)) {
  throw new Error('Electron Builder не найден. Выполните npm install.')
}

try {
  execFileSync('which', ['fpm'], { stdio: 'ignore' })
} catch {
  throw new Error('Для .deb нужен fpm. Установите Ruby/fpm перед Linux-сборкой.')
}

const child = spawn(process.execPath, [cli, '--linux', '--config.directories.output=release/linux'], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
})

child.on('error', (error) => {
  console.error(error)
  process.exitCode = 1
})
child.on('exit', (code) => {
  process.exitCode = code ?? 1
})
