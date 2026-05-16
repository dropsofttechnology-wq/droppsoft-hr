import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'

function parseDescriptor(raw) {
  if (raw == null) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }
  return raw
}

export const saveFaceDescriptor = async (userId, companyId, descriptor, qualityScore, captureMethod = 'auto') => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch('/api/face', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          company_id: companyId,
          descriptor: typeof descriptor === 'string' ? descriptor : JSON.stringify(descriptor),
          quality_score: qualityScore || 0,
          capture_method: captureMethod
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to save face descriptor')
      }
      return await res.json()
    }
    const existing = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.FACE_DESCRIPTORS,
      [
        Query.equal('user_id', userId),
        Query.limit(1)
      ]
    )

    const now = new Date().toISOString()
    const descriptorData = {
      user_id: userId,
      company_id: companyId,
      descriptor: JSON.stringify(descriptor),
      quality_score: qualityScore || 0,
      capture_method: captureMethod,
      registered_at: now,
      created_at: now
    }

    if (existing.documents.length > 0) {
      return await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.FACE_DESCRIPTORS,
        existing.documents[0].$id,
        descriptorData
      )
    }
    return await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.FACE_DESCRIPTORS,
      'unique()',
      descriptorData
    )
  } catch (error) {
    console.error('Error saving face descriptor:', error)
    throw error
  }
}

export const getFaceDescriptor = async (userId) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/face/user/${encodeURIComponent(userId)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to fetch face descriptor')
      }
      const data = await res.json()
      return data
    }
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.FACE_DESCRIPTORS,
      [
        Query.equal('user_id', userId),
        Query.limit(1)
      ]
    )
    return response.documents[0] || null
  } catch (error) {
    console.error('Error fetching face descriptor:', error)
    throw error
  }
}

export const checkFaceData = async (userId) => {
  try {
    const descriptor = await getFaceDescriptor(userId)
    return {
      has_face: !!descriptor,
      registered_at: descriptor?.registered_at || null
    }
  } catch (error) {
    console.error('Error checking face data:', error)
    return { has_face: false, registered_at: null }
  }
}

export const deleteFaceDescriptor = async (userId) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/face/user/${encodeURIComponent(userId)}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to delete face descriptor')
      }
      const data = await res.json()
      return !!data.deleted
    }
    const existing = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.FACE_DESCRIPTORS,
      [
        Query.equal('user_id', userId),
        Query.limit(1)
      ]
    )

    if (existing.documents.length > 0) {
      await databases.deleteDocument(
        DATABASE_ID,
        COLLECTIONS.FACE_DESCRIPTORS,
        existing.documents[0].$id
      )
      return true
    }
    return false
  } catch (error) {
    console.error('Error deleting face descriptor:', error)
    throw error
  }
}

export const getAllFaceDescriptors = async (companyId) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/face/company/${encodeURIComponent(companyId)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to load face descriptors')
      }
      const docs = await res.json()
      return docs.map((doc) => ({
        user_id: doc.user_id,
        descriptor: parseDescriptor(doc.descriptor),
        quality_score: doc.quality_score,
        registered_at: doc.registered_at
      }))
    }
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.FACE_DESCRIPTORS,
      [
        Query.equal('company_id', companyId),
        Query.limit(5000)
      ]
    )
    return response.documents.map((doc) => ({
      user_id: doc.user_id,
      descriptor: JSON.parse(doc.descriptor),
      quality_score: doc.quality_score,
      registered_at: doc.registered_at
    }))
  } catch (error) {
    console.error('Error fetching all face descriptors:', error)
    throw error
  }
}
