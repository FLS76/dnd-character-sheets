import { spawn } from 'node:child_process'
import { copyFile, mkdir, readdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const toolsRoot = process.env.OPENCODE_TOOLS_DIR || 'K:\\Приложения для open code'
const tempOutput = path.join(toolsRoot, 'Temp', 'project-builds', 'dnd-character-sheets-windows')
const projectOutput = path.join(root, 'release', 'windows')
const builderCli = path.join(root, 'node_modules', 'electron-builder', 'cli.js')

async function copyTree(source, destination) {
  await mkdir(destination, { recursive: true })
  const entries = await readdir(source, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name)
    const destinationPath = path.join(destination, entry.name)

    if (entry.isDirectory()) {
      await copyTree(sourcePath, destinationPath)
      continue
    }

    try {
      await copyFile(sourcePath, destinationPath)
    } catch (error) {
      // The network workspace can transiently deny overwriting a DLL by its
      // final name. Stage it under a temporary name, then replace the target.
      if (error?.code !== 'EPERM' && error?.code !== 'EACCES') throw error
      const stagedPath = `${destinationPath}.staged`
      await rm(stagedPath, { force: true })
      await copyFile(sourcePath, stagedPath)
      await rm(destinationPath, { force: true })
      await rename(stagedPath, destinationPath)
    }
  }
}

await rm(tempOutput, { recursive: true, force: true })
await mkdir(tempOutput, { recursive: true })

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [builderCli, '--win', `--config.directories.output=${tempOutput}`], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      ELECTRON_CACHE: path.join(toolsRoot, 'Caches', 'electron'),
      ELECTRON_BUILDER_CACHE: path.join(toolsRoot, 'Caches', 'electron-builder'),
      TEMP: path.join(toolsRoot, 'Temp', 'project-builds'),
      TMP: path.join(toolsRoot, 'Temp', 'project-builds'),
    },
  })
  child.on('error', reject)
  child.on('exit', (code) => {
    if (code === 0) resolve()
    else reject(new Error(`Windows build failed with code ${code}`))
  })
})

await rm(projectOutput, { recursive: true, force: true })
await copyTree(tempOutput, projectOutput)
console.log(`Windows artifacts copied to ${projectOutput}`)
