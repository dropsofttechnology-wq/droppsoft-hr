/**
 * After npm install: create project-root .env.local from .env.example or server template
 * so developers do not need to copy manually.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const target = path.join(root, '.env.local')
const example = path.join(root, '.env.example')
const template = path.join(root, 'server', 'env', 'default.env.local.template')

if (fs.existsSync(target)) {
  process.exit(0)
}

let content = ''
if (fs.existsSync(example)) {
  content = fs.readFileSync(example, 'utf8')
} else if (fs.existsSync(template)) {
  content = fs.readFileSync(template, 'utf8')
} else {
  process.exit(0)
}

try {
  fs.writeFileSync(target, content, 'utf8')
  console.log('[ensure-env-local] Created .env.local — edit if needed.')
} catch (e) {
  console.warn('[ensure-env-local] Could not write .env.local:', e.message)
}
