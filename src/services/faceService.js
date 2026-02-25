import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'

export const saveFaceDescriptor = async (userId, companyId, descriptor, qualityScore, captureMethod = 'auto') => {
  try {
    // Check if face descriptor already exists
    const existing = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.FACE_DESCRIPTORS,
      [
        Query.equal('user_id', userId),
        Query.limit(1)
      ]
    )

    const descriptorData = {
      user_id: userId,
      company_id: companyId,
      descriptor: JSON.stringify(descriptor), // Store as JSON string
      quality_score: qualityScore || 0,
      capture_method: captureMethod,
      registered_at: new Date().toISOString()
    }

    if (existing.documents.length > 0) {
      // Update existing
      return await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.FACE_DESCRIPTORS,
        existing.documents[0].$id,
        descriptorData
      )
    } else {
      // Create new
      return await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.FACE_DESCRIPTORS,
        'unique()',
        descriptorData
      )
    }
  } catch (error) {
    console.error('Error saving face descriptor:', error)
    throw error
  }
}

export const getFaceDescriptor = async (userId) => {
  try {
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
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.FACE_DESCRIPTORS,
      [
        Query.equal('company_id', companyId),
        Query.limit(5000)
      ]
    )
    return response.documents.map(doc => ({
      user_id: doc.user_id,
      descriptor: JSON.parse(doc.descriptor), // Parse JSON string back to array
      quality_score: doc.quality_score,
      registered_at: doc.registered_at
    }))
  } catch (error) {
    console.error('Error fetching all face descriptors:', error)
    throw error
  }
}
