const { BrowserWindow } = require('electron')

/**
 * Render HTML in a headless window and return an A4 PDF buffer (Chromium print).
 * @param {string} html
 * @returns {Promise<Buffer>}
 */
function printTranscriptHtmlToPdfBuffer(html) {
  const htmlStr = String(html || '')
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true,
        sandbox: false
      }
    })

    const teardown = (err, buf) => {
      try {
        win.destroy()
      } catch (_) {}
      if (err) reject(err)
      else resolve(buf)
    }

    win.webContents.once('did-fail-load', (_e, code, desc, url) => {
      teardown(
        new Error(
          `Failed to load transcript HTML for PDF (${desc || 'unknown'} / code ${code || 'n/a'}) ${url || ''}`.trim()
        )
      )
    })

    win.webContents.once('did-finish-load', () => {
      win.webContents
        .printToPDF({
          printBackground: true,
          pageSize: 'A4',
          marginsType: 0
        })
        .then((data) => teardown(null, Buffer.from(data)))
        .catch((e) => teardown(e))
    })

    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlStr)}`
    win.loadURL(dataUrl).catch((e) => teardown(e))
  })
}

module.exports = { printTranscriptHtmlToPdfBuffer }
