import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { getDataDir } from './paths.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const bundledTemplate = path.join(__dirname, 'env', 'default.env.local.template')

/** Minimal defaults if the bundled template is missing (e.g. broken package). */
const FALLBACK_TEMPLATE = `# Dropsoft HR — edit HR_API_PORT or HR_API_BIND as needed
HR_API_PORT=32100
HR_API_BIND=0.0.0.0
`

/**
 * Creates %AppData%/DropsoftHR/.env.local (Windows) or ~/.config/DropsoftHR/.env.local on first run.
 * Then loads: project .env → project .env.local → user .env.local (override).
 */
export function loadHrEnv() {
  const userEnvPath = path.join(getDataDir(), '.env.local')
  try {
    if (!fs.existsSync(userEnvPath)) {
      fs.mkdirSync(getDataDir(), { recursive: true })
      let body = FALLBACK_TEMPLATE
      if (fs.existsSync(bundledTemplate)) {
        body = fs.readFileSync(bundledTemplate, 'utf8')
      }
      fs.writeFileSync(userEnvPath, body, 'utf8')
    }
  } catch (e) {
    console.warn('[HR] Could not create user .env.local:', e && e.message ? e.message : e)
  }

  dotenv.config({ path: path.join(projectRoot, '.env') })
  dotenv.config({ path: path.join(projectRoot, '.env.local') })
  dotenv.config({ path: userEnvPath, override: true })
}

loadHrEnv()
