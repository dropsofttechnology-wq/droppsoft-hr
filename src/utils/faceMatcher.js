/**
 * Face Matching Utilities using face-api.js
 */

/**
 * Create FaceMatcher from descriptors
 */
export const createFaceMatcher = (descriptors) => {
  if (!window.faceapi) {
    throw new Error('face-api.js not loaded')
  }

  if (!descriptors || descriptors.length === 0) {
    return null
  }

  const labeledDescriptors = descriptors.map(desc => {
    const descriptor = Array.isArray(desc.descriptor) 
      ? desc.descriptor 
      : JSON.parse(desc.descriptor || '[]')
    
    if (!descriptor || descriptor.length !== 128) {
      return null
    }

    return new window.faceapi.LabeledFaceDescriptors(
      String(desc.user_id),
      [new Float32Array(descriptor)]
    )
  }).filter(Boolean)

  if (labeledDescriptors.length === 0) {
    return null
  }

  return new window.faceapi.FaceMatcher(labeledDescriptors, 0.4)
}

/**
 * Match face descriptor against FaceMatcher
 */
export const matchFace = (faceMatcher, descriptor) => {
  if (!faceMatcher || !descriptor) {
    return null
  }

  try {
    const bestMatch = faceMatcher.findBestMatch(descriptor)
    
    if (bestMatch && bestMatch.label !== 'unknown' && bestMatch.distance < 0.4) {
      return {
        // Appwrite IDs are strings; keep label as string
        userId: String(bestMatch.label),
        distance: bestMatch.distance,
        confidence: (1 - bestMatch.distance) * 100
      }
    }
    
    return null
  } catch (error) {
    console.error('Face matching error:', error)
    return null
  }
}
