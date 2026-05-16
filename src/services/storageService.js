import { storage } from '../config/appwrite'
import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'

const LOGO_BUCKET_ID = import.meta.env.VITE_APPWRITE_LOGO_BUCKET_ID || '69a4811d0001ad17b643'

/**
 * Upload company logo to Appwrite Storage or local API (standalone).
 */
export const uploadCompanyLogo = async (file, companyId) => {
  try {
    if (isLocalDataSource()) {
      const form = new FormData()
      form.append('file', file)
      const res = await localApiFetch('/api/storage/company-logo', {
        method: 'POST',
        body: form
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.warn('Logo upload failed:', err.error || res.status)
        return null
      }
      const data = await res.json()
      return data.url || null
    }
    const response = await storage.createFile(
      LOGO_BUCKET_ID,
      'unique()',
      file,
      []
    )

    try {
      const fileUrl = storage.getFileView(LOGO_BUCKET_ID, response.$id)
      return fileUrl
    } catch (error) {
      const previewUrl = storage.getFilePreview(LOGO_BUCKET_ID, response.$id)
      return previewUrl
    }
  } catch (error) {
    if (error.message?.includes('could not be found') || error.message?.includes('404') || error.code === 404) {
      if (!window.__logoBucketWarningShown) {
        console.info('ℹ️ Storage bucket not configured. Logo upload skipped. Company will be saved without logo. To enable logos, create a storage bucket named "company_logos" in Appwrite Console.')
        window.__logoBucketWarningShown = true
      }
      return null
    }

    if (!window.__logoUploadErrorShown) {
      console.warn('Logo upload failed:', error.message)
      window.__logoUploadErrorShown = true
    }
    return null
  }
}

export const deleteCompanyLogo = async (fileId) => {
  try {
    if (isLocalDataSource()) {
      if (!fileId) return
      const res = await localApiFetch(`/api/storage/logos/${encodeURIComponent(fileId)}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        console.warn('Logo delete failed:', await res.text().catch(() => ''))
      }
      return
    }
    await storage.deleteFile(LOGO_BUCKET_ID, fileId)
  } catch (error) {
    console.error('Error deleting logo:', error)
  }
}

/**
 * Get file ID from URL (Appwrite or local /api/storage/logos/:filename).
 */
export const getFileIdFromUrl = (url) => {
  if (!url) return null
  const local = url.match(/\/api\/storage\/logos\/([^/?#]+)/)
  if (local) return local[1]
  const match = url.match(/\/files\/([^/]+)\//)
  return match ? match[1] : null
}
