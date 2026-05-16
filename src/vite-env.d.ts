/// <reference types="vite/client" />

interface DroppsoftDesktopBridge {
  readonly isDesktop: boolean
  getApiPort: () => Promise<string>
  getApiBaseUrl: () => Promise<string>
}

interface ImportMetaEnv {
  readonly VITE_USE_LOCAL_API?: string
  readonly VITE_LOCAL_API_URL?: string
  /** LAN URL for mobile pairing QR when dev uses 127.0.0.1 (e.g. http://192.168.1.50:32100) */
  readonly VITE_PAIRING_LAN_URL?: string
  readonly VITE_CAPACITOR?: string
  readonly VITE_ANDROID_API_URL?: string
  readonly VITE_APPWRITE_ENDPOINT?: string
  readonly VITE_APPWRITE_PROJECT_ID?: string
  readonly VITE_APPWRITE_DATABASE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    droppsoftDesktop?: DroppsoftDesktopBridge
  }
}

export {}
