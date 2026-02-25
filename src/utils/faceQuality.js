/**
 * Face Quality Validation Utilities
 */

/**
 * Calculate image brightness (0-100%)
 */
export const calculateBrightness = (imageData) => {
  const data = imageData.data
  let sum = 0
  let count = 0

  // Sample every 4th pixel for performance
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    sum += luminance
    count++
  }

  return (sum / count) * 100
}

/**
 * Calculate image contrast
 */
export const calculateContrast = (imageData) => {
  const data = imageData.data
  const values = []

  // Sample pixels for performance
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b
    values.push(luminance)
  }

  if (values.length === 0) return 0

  // Calculate standard deviation as contrast measure
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

/**
 * Calculate image sharpness using Laplacian variance
 */
export const calculateSharpness = (imageData) => {
  const width = imageData.width
  const height = imageData.height
  const data = imageData.data
  let sum = 0
  let count = 0

  // Sample center region for performance
  const startX = Math.floor(width * 0.25)
  const endX = Math.floor(width * 0.75)
  const startY = Math.floor(height * 0.25)
  const endY = Math.floor(height * 0.75)

  for (let y = startY; y < endY; y += 2) {
    for (let x = startX; x < endX; x += 2) {
      const idx = (y * width + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const gray = 0.299 * r + 0.587 * g + 0.114 * b

      // Calculate Laplacian (second derivative approximation)
      if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
        const idxLeft = ((y * width + (x - 1)) * 4)
        const idxRight = ((y * width + (x + 1)) * 4)
        const idxUp = (((y - 1) * width + x) * 4)
        const idxDown = (((y + 1) * width + x) * 4)
        
        const grayLeft = 0.299 * data[idxLeft] + 0.587 * data[idxLeft + 1] + 0.114 * data[idxLeft + 2]
        const grayRight = 0.299 * data[idxRight] + 0.587 * data[idxRight + 1] + 0.114 * data[idxRight + 2]
        const grayUp = 0.299 * data[idxUp] + 0.587 * data[idxUp + 1] + 0.114 * data[idxUp + 2]
        const grayDown = 0.299 * data[idxDown] + 0.587 * data[idxDown + 1] + 0.114 * data[idxDown + 2]

        const laplacian = Math.abs(4 * gray - grayLeft - grayRight - grayUp - grayDown)
        sum += laplacian
        count++
      }
    }
  }

  return count > 0 ? sum / count : 0
}

/**
 * Calculate face coverage percentage
 */
export const calculateFaceCoverage = (faceBox, imageWidth, imageHeight) => {
  const faceWidth = faceBox.width
  const faceHeight = faceBox.height
  const faceArea = faceWidth * faceHeight
  const imageArea = imageWidth * imageHeight
  return (faceArea / imageArea) * 100
}

/**
 * Calculate face angle from landmarks
 */
export const calculateFaceAngle = (landmarks) => {
  if (!landmarks || !landmarks.positions) return 0

  const positions = landmarks.positions
  const nose = positions[30] // Nose tip
  const leftEye = positions[36] // Left eye corner
  const rightEye = positions[45] // Right eye corner

  // Calculate horizontal angle
  const eyeCenterX = (leftEye.x + rightEye.x) / 2
  const noseX = nose.x
  const horizontalAngle = Math.atan2(noseX - eyeCenterX, Math.abs(rightEye.x - leftEye.x)) * (180 / Math.PI)

  return Math.abs(horizontalAngle)
}

/**
 * Validate all quality metrics
 */
export const validateFaceQuality = (imageData, faceDetection, faceLandmarks) => {
  const brightness = calculateBrightness(imageData)
  const contrast = calculateContrast(imageData)
  const sharpness = calculateSharpness(imageData)
  const faceCoverage = calculateFaceCoverage(
    faceDetection.detection.box,
    imageData.width,
    imageData.height
  )
  const faceAngle = calculateFaceAngle(faceLandmarks)

  const quality = {
    brightness,
    contrast,
    sharpness,
    faceCoverage,
    faceAngle,
    isValid: true,
    issues: []
  }

  // Validation thresholds
  if (brightness < 30 || brightness > 90) {
    quality.isValid = false
    quality.issues.push(`Brightness should be 30-90% (current: ${brightness.toFixed(1)}%)`)
  }

  if (contrast < 20) {
    quality.isValid = false
    quality.issues.push('Image contrast is too low')
  }

  if (sharpness < 50) {
    quality.isValid = false
    quality.issues.push('Image is too blurry')
  }

  if (faceCoverage < 15 || faceCoverage > 60) {
    quality.isValid = false
    quality.issues.push(`Face should be 15-60% of frame (current: ${faceCoverage.toFixed(1)}%)`)
  }

  if (faceAngle > 15) {
    quality.isValid = false
    quality.issues.push(`Face angle should be <15° (current: ${faceAngle.toFixed(1)}°)`)
  }

  return quality
}
