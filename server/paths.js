import os from 'os'
import path from 'path'

/**
 * Local data directory for standalone mode (mirrors typical Windows layout).
 * Windows: %APPDATA%\\DropsoftHR
 * macOS/Linux: ~/.config/DropsoftHR
 */
export function getDataDir() {
  if (process.platform === 'win32') {
    const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    return path.join(base, 'DropsoftHR')
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'DropsoftHR')
  }
  return path.join(os.homedir(), '.config', 'DropsoftHR')
}

export function getDbPath() {
  return path.join(getDataDir(), 'hr.db')
}

export function getApiPortFilePath() {
  return path.join(getDataDir(), 'api-port.txt')
}

export function getUploadsRoot() {
  return path.join(getDataDir(), 'uploads')
}

export function getLogosDir() {
  return path.join(getUploadsRoot(), 'logos')
}
