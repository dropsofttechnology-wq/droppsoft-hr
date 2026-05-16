import { startServer } from './app.js'

startServer()
  .then(({ port }) => {
    const bind = (process.env.HR_API_BIND || '127.0.0.1').trim() || '127.0.0.1'
    const show = bind === '0.0.0.0' ? '127.0.0.1' : bind
    console.log(`Dropsoft HR API listening on ${bind}:${port}`)
    console.log(`Health (this machine): http://${show}:${port}/api/health`)
    if (bind === '0.0.0.0') {
      console.log('LAN: use http://<this-computer-LAN-IP>:' + port + ' from other PCs (open firewall for TCP ' + port + ').')
    } else {
      console.warn(
        '[HR API] HR_API_BIND is ' +
          bind +
          ' — phones on Wi‑Fi cannot reach this API. Set HR_API_BIND=0.0.0.0 in .env.local and restart.'
      )
    }
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
