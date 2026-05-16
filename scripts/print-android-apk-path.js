#!/usr/bin/env node
/**
 * Prints where assembleDebug / assembleRelease puts the APK (renamed in app/build.gradle).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const dirDebug = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug')
const dirRelease = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release')

function firstApk(dir) {
  if (!fs.existsSync(dir)) return null
  const list = fs.readdirSync(dir).filter((f) => f.endsWith('.apk'))
  return list.length ? path.join(dir, list[0]) : null
}

const absDebug = firstApk(dirDebug)
const absRelease = firstApk(dirRelease)

console.log('Debug APK:')
if (absDebug) {
  const st = fs.statSync(absDebug)
  console.log(absDebug)
  console.log('  exists —', Math.round(st.size / 1024), 'KB')
} else {
  console.log('(not found — run build first)')
  console.log('  npm run build:android && cd android && .\\gradlew.bat assembleDebug')
}
console.log('')
console.log('Release APK:')
if (absRelease) {
  const st = fs.statSync(absRelease)
  console.log(absRelease)
  console.log('  exists —', Math.round(st.size / 1024), 'KB')
} else {
  console.log('(not found)')
}
