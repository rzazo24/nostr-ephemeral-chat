import qrcode from 'qrcode-generator'

/** A QR code for `text` as a data: URL (GIF), drawn by the library, so it can go in an <img> under a strict CSP. */
export function qrDataUrl(text: string): string {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  return qr.createDataURL(8, 4)
}
