/**
 * Face Matching Utilities using face-api.js
 */

/**
 * Create FaceMatcher from descriptors
 * @param {Array} descriptors
 * @param {number} threshold - Matching threshold (default 0.35). Higher = looser match.
 */
export const createFaceMatcher = (descriptors, threshold = 0.35) => {
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

  return new window.faceapi.FaceMatcher(labeledDescriptors, threshold)
}

/**
 * Match face descriptor against FaceMatcher
 * @param {Object} faceMatcher
 * @param {Float32Array} descriptor
 * @param {number} minConfidence - Min confidence % to accept (default 65)
 */
export const matchFace = (faceMatcher, descriptor, minConfidence = 65) => {
  if (!faceMatcher || !descriptor) {
    return null
  }

  try {
    const bestMatch = faceMatcher.findBestMatch(descriptor)

    if (bestMatch && bestMatch.label !== 'unknown') {
      const confidence = (1 - bestMatch.distance) * 100

      if (confidence >= minConfidence) {
        return {
          userId: String(bestMatch.label),
          distance: bestMatch.distance,
          confidence: confidence
        }
      }
    }

    return null
  } catch (error) {
    console.error('Face matching error:', error)
    return null
  }
}
