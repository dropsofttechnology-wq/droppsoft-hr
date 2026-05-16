import { useState, useEffect } from 'react'

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Check if running on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    if (isIOS) {
      // On iOS, show install instructions
      setIsInstallable(true)
      return
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      // Store the event for later use (don't prevent default to allow browser banner)
      setDeferredPrompt(e)
      setIsInstallable(true)
      // Note: We don't preventDefault() here to allow browser's native install banner
      // The custom install button is an additional option
    }

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const installPWA = async () => {
    if (!deferredPrompt) {
      // If no prompt available, show instructions for iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
      if (isIOS) {
        alert('To install this app on iOS:\n1. Tap the Share button\n2. Tap "Add to Home Screen"\n3. Tap "Add"')
      } else {
        alert('Installation not available. Please use your browser\'s install option.')
      }
      return false
    }

    // Show the install prompt
    deferredPrompt.prompt()

    // Wait for the user to respond
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setIsInstalled(true)
      setIsInstallable(false)
    }

    // Clear the deferred prompt
    setDeferredPrompt(null)
    return outcome === 'accepted'
  }

  return {
    isInstallable,
    isInstalled,
    installPWA
  }
}
