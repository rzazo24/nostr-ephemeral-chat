// Reading a room's QR code with the camera. The picture never leaves the device: frames are read here, in the page.
// Chrome on Android has a built-in reader (BarcodeDetector); Safari does not, so jsQR is loaded then, only when the camera opens.

type Reader = (video: HTMLVideoElement) => Promise<string | null>

interface Detector { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> }
interface DetectorClass { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> }

async function makeReader(): Promise<Reader> {
  const BD = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector
  if (BD && (await BD.getSupportedFormats?.().catch((): string[] => []))?.includes('qr_code')) {
    const d = new BD({ formats: ['qr_code'] })
    return async (v) => (await d.detect(v).catch(() => []))[0]?.rawValue ?? null
  }
  const jsQR = (await import('jsqr')).default
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true })!
  return async (v) => {
    if (!v.videoWidth) return null
    const k = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight)) // a smaller frame is plenty for a QR and much faster
    canvas.width = Math.round(v.videoWidth * k); canvas.height = Math.round(v.videoHeight * k)
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null
  }
}

/** Opens the camera in `video` and resolves with the first QR text read, or null if `stop` is called first. The camera is always
 *  switched off before it resolves. Rejects if there is no camera or the permission is refused. */
export function scanQR(video: HTMLVideoElement): { result: Promise<string | null>; stop: () => void } {
  let stopped = false, stream: MediaStream | null = null, wake: (() => void) | null = null
  const stop = () => { stopped = true; stream?.getTracks().forEach((t) => t.stop()); stream = null; video.srcObject = null; wake?.() }
  const result = (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      if (stopped) return null
      video.srcObject = stream
      await video.play()
      const read = await makeReader()
      while (!stopped) {
        const text = await read(video)
        if (text) return text
        await new Promise<void>((r) => { wake = r; setTimeout(r, 150) })
      }
      return null
    } finally { stop() }
  })()
  return { result, stop }
}
