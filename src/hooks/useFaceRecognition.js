import { useState, useEffect, useRef } from 'react'
import * as faceapi from '@vladmandic/face-api'

const MODELS_PATH = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.6.9/model'

export const useFaceRecognition = (options = {}) => {
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const faceApiLoaded = useRef(false)
  const detectionCache = useRef(null)
  const lastDetectionTime = useRef(0)

  const minConfidence = options.face_detection_confidence ?? 0.4
  const throttleMs = options.face_detection_throttle_ms ?? 150

  useEffect(() => {
    loadFaceAPI()
  }, [])

  const loadFaceAPI = async () => {
    if (faceApiLoaded.current) return

    try {
      setLoading(true)
      setError(null)

      // Load SSD Mobilenet for better accuracy (faster and more accurate than TinyFaceDetector)
      // Also load landmarks and recognition models
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_PATH),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_PATH),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_PATH)
      ])

      faceApiLoaded.current = true
      setModelsLoaded(true)
      setLoading(false)
      console.log('Face API models loaded successfully (SSD Mobilenet - Fast & Accurate)')
    } catch (err) {
      console.error('Error loading face-api:', err)
      setError(err.message || 'Failed to load face recognition models')
      setLoading(false)
    }
  }

  const detectFace = async (videoElement) => {
    if (!modelsLoaded || !faceApiLoaded.current) {
      throw new Error('Face API models not loaded')
    }

    if (!videoElement || videoElement.readyState !== 4) {
      return null
    }

    const now = Date.now()
    if (now - lastDetectionTime.current < throttleMs) {
      return detectionCache.current
    }
    lastDetectionTime.current = now

    try {
      const detection = await faceapi
        .detectSingleFace(videoElement, new faceapi.SsdMobilenetv1Options({
          minConfidence: minConfidence,
          maxResults: 1,
          inputSize: 224
        }))
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (detection && detection.detection && detection.detection.score >= minConfidence) {
        // Cache the result
        detectionCache.current = detection
        return detection
      }
      
      return null
    } catch (err) {
      console.error('Face detection error:', err)
      return null
    }
  }

  return {
    modelsLoaded,
    loading,
    error,
    detectFace
  }
}
