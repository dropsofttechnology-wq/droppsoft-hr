import { useState, useEffect, useRef } from 'react'

const FACE_API_CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.6.9/dist/face-api.min.js'
const MODELS_PATH = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.6.9/model'

export const useFaceRecognition = () => {
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const faceApiLoaded = useRef(false)

  useEffect(() => {
    loadFaceAPI()
  }, [])

  const loadFaceAPI = async () => {
    if (faceApiLoaded.current) return

    try {
      // Load face-api.js library
      if (typeof window.faceapi === 'undefined') {
        await loadScript(FACE_API_CDN)
      }

      // Load models
      await Promise.all([
        window.faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_PATH),
        window.faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_PATH),
        window.faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_PATH)
      ])

      faceApiLoaded.current = true
      setModelsLoaded(true)
      setLoading(false)
    } catch (err) {
      console.error('Error loading face-api:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = src
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  const detectFace = async (videoElement) => {
    if (!modelsLoaded || !window.faceapi) {
      throw new Error('Face API models not loaded')
    }

    const detection = await window.faceapi
      .detectSingleFace(videoElement, new window.faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.5
      }))
      .withFaceLandmarks()
      .withFaceDescriptor()

    return detection
  }

  return {
    modelsLoaded,
    loading,
    error,
    detectFace
  }
}
