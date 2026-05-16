import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

/**
 * better-sqlite3 is a native addon and cannot load from inside app.asar.
 * electron-builder unpacks it to resources/app.asar.unpacked/node_modules/better-sqlite3.
 * Hoisted deps (e.g. bindings, file-uri-to-path) must also be unpacked — see package.json asarUnpack.
 * ESM import resolution still points at the copy inside app.asar, so we load explicitly from unpacked.
 */
export function loadBetterSqlite3() {
  const resourcesPath = process.resourcesPath || ''
  const unpackedPkgDir = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'better-sqlite3')
  const unpackedPkgJson = path.join(unpackedPkgDir, 'package.json')

  if (resourcesPath && fs.existsSync(unpackedPkgJson)) {
    const req = createRequire(unpackedPkgJson)
    const mod = req('./lib/index.js')
    return mod.default ?? mod
  }

  const packaged =
    Boolean(process.versions?.electron) &&
    Boolean(resourcesPath) &&
    fs.existsSync(path.join(resourcesPath, 'app.asar'))

  if (packaged) {
    throw new Error(
      'SQLite native module is missing from the installation (expected under app.asar.unpacked). ' +
        'Reinstall Dropsoft HR, or install from a freshly built setup package.'
    )
  }

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const req = createRequire(path.join(repoRoot, 'package.json'))
  const mod = req('better-sqlite3')
  return mod.default ?? mod
}
