import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { chmod, cp, mkdir, readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const androidDir = path.join(root, 'android')
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const outputDir = path.join(root, 'release', 'android')
const toolsRoot = process.env.OPENCODE_TOOLS_DIR || 'K:\\Приложения для open code'
const preferredJavaHome = path.join(toolsRoot, 'Java', 'jdk-21.0.12.101-hotspot')
const javaHome = isJavaHome(process.env.JAVA_HOME) ? process.env.JAVA_HOME : isJavaHome(preferredJavaHome) ? preferredJavaHome : findJavaHome()
const javaCommand = javaHome ? undefined : findCommand('java')
const androidHome = findAndroidHome()
const hasReleaseSigning = existsSync(path.join(androidDir, 'keystore.properties'))
const versionCode = Number.isInteger(packageJson.androidVersionCode) ? packageJson.androidVersionCode : 1

if (!javaHome && !javaCommand) {
  throw new Error('Java/JDK 21 не найден. Установите JDK 21 и добавьте java в PATH или задайте JAVA_HOME.')
}
if (!androidHome) {
  throw new Error('Android SDK не найден. Установите Android SDK и задайте ANDROID_HOME или ANDROID_SDK_ROOT.')
}
assertAndroidSdk(androidHome)
await rm(outputDir, { recursive: true, force: true })

function isJavaHome(candidate) {
  if (!candidate) return false
  const executable = process.platform === 'win32' ? 'java.exe' : 'java'
  return existsSync(path.join(candidate, 'bin', executable))
}

function findCommand(command) {
  const finder = process.platform === 'win32' ? 'where' : 'which'
  try {
    const output = execFileSync(finder, [command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return output.split(/\r?\n/).map((value) => value.trim()).find(Boolean)
  } catch {
    return undefined
  }
}

function findJavaHome() {
  if (isJavaHome(process.env.JAVA_HOME)) return process.env.JAVA_HOME
  const javaPath = findCommand('java')
  if (javaPath) {
    const binDirectory = path.dirname(javaPath)
    if (path.basename(binDirectory).toLowerCase() === 'bin') {
      const home = path.dirname(binDirectory)
      if (isJavaHome(home)) return home
    }
  }

  const roots = process.platform === 'win32'
    ? [
      process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Microsoft') : undefined,
      process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Java') : undefined,
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs') : undefined,
    ]
    : [
      '/usr/lib/jvm',
      '/Library/Java/JavaVirtualMachines',
      process.env.HOME ? path.join(process.env.HOME, '.sdkman', 'candidates', 'java') : undefined,
    ]

  for (const root of roots) {
    if (!root || !existsSync(root)) continue
    try {
      for (const entry of readdirSync(root, { withFileTypes: true })) {
        const candidate = path.join(root, entry.name)
        if (isJavaHome(candidate)) return candidate
      }
    } catch {
      // Ignore unreadable SDK directories and continue searching.
    }
  }
  return undefined
}

function findAndroidHome() {
  const candidates = [
    path.join(toolsRoot, 'Android', 'Sdk'),
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.platform === 'win32' && process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : undefined,
    process.platform === 'darwin' && process.env.HOME ? path.join(process.env.HOME, 'Library', 'Android', 'sdk') : undefined,
    process.platform === 'linux' && process.env.HOME ? path.join(process.env.HOME, 'Android', 'Sdk') : undefined,
    process.platform === 'linux' ? '/opt/android-sdk' : undefined,
    process.platform === 'linux' ? '/usr/lib/android-sdk' : undefined,
  ]
  return candidates.find((candidate) => candidate && existsSync(candidate))
}

function assertAndroidSdk(sdkPath) {
  const platformPath = path.join(sdkPath, 'platforms', 'android-36')
  const buildToolsPath = path.join(sdkPath, 'build-tools')
  if (!existsSync(platformPath)) {
    throw new Error(`Android Platform API 36 не найден в ${sdkPath}. Установите его через SDK Manager.`)
  }
  if (!existsSync(buildToolsPath)) {
    throw new Error(`Android Build Tools не найдены в ${sdkPath}. Установите их через SDK Manager.`)
  }
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const executable = process.platform === 'win32' && command === 'gradlew.bat'
      ? process.env.ComSpec || 'cmd.exe'
      : command
    const commandArgs = process.platform === 'win32' && command === 'gradlew.bat'
      ? ['/d', '/s', '/c', `${command} ${args.join(' ')}`]
      : args
    const env = { ...process.env }
    if (javaHome) {
      env.JAVA_HOME = javaHome
      const pathKey = process.platform === 'win32' ? 'Path' : 'PATH'
      env[pathKey] = `${path.join(javaHome, 'bin')}${path.delimiter}${env[pathKey] || ''}`
    } else {
      delete env.JAVA_HOME
    }
    env.ANDROID_HOME = androidHome
    env.ANDROID_SDK_ROOT = androidHome
    env.ANDROID_USER_HOME = process.env.ANDROID_USER_HOME || path.join(toolsRoot, 'Android', 'user-data')
    env.GRADLE_USER_HOME = process.env.GRADLE_USER_HOME || path.join(toolsRoot, 'Gradle')
    env.TEMP = path.join(toolsRoot, 'Temp', 'project-builds')
    env.TMP = env.TEMP
    const child = spawn(executable, commandArgs, {
      cwd,
      stdio: 'inherit',
      env,
      shell: false,
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} завершился с кодом ${code}`))
    })
  })
}

async function copyArtifacts(sourceDir, extension, targetName) {
  let files = []
  try {
    files = await readdir(sourceDir)
  } catch {
    return false
  }
  const artifact = files.find((file) => file.endsWith(extension))
  if (!artifact) return false
  await mkdir(outputDir, { recursive: true })
  const destination = path.join(outputDir, targetName || artifact)
  await cp(path.join(sourceDir, artifact), destination, { force: true })
  console.log(`Скопировано: ${destination}`)
  return true
}

const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
if (process.platform !== 'win32') {
  await chmod(path.join(androidDir, 'gradlew'), 0o755)
}
await run(gradle, [
  '--no-daemon',
  '--max-workers=1',
  `-PappVersion=${packageJson.version}`,
  `-PappVersionCode=${versionCode}`,
  'assembleDebug',
  'assembleRelease',
  'bundleRelease',
], androidDir)

const releaseSuffix = hasReleaseSigning ? '' : '-unsigned'
const artifacts = [
  ['debug', '.apk', `DND Character Sheets-${packageJson.version}-debug.apk`],
  ['release', '.apk', `DND Character Sheets-${packageJson.version}${releaseSuffix}.apk`],
  ['bundle', '.aab', `DND Character Sheets-${packageJson.version}${releaseSuffix}.aab`],
]
const copied = []
for (const [directory, extension, targetName] of artifacts) {
  const sourceDir = directory === 'bundle'
    ? path.join(androidDir, 'app', 'build', 'outputs', 'bundle', 'release')
    : path.join(androidDir, 'app', 'build', 'outputs', 'apk', directory)
  copied.push(await copyArtifacts(sourceDir, extension, targetName))
}

if (copied.some((value) => !value)) {
  throw new Error('Ожидаемые Android-артефакты не найдены. Проверьте вывод Gradle.')
}

console.log(`Release signing: ${hasReleaseSigning ? 'configured' : 'not configured (unsigned artifacts)'}`)
