import { QRCodeSVG } from 'qrcode.react'
import './QRWidget.css'

function QRWidget({ size = 96, label = 'Scan to join' }) {
  const url = window.location.origin
  return (
    <div className='qr-widget'>
      <div className='qr-code-box'>
        <QRCodeSVG value={url} size={size} bgColor='#ffffff' fgColor='#000000' />
      </div>
      {label && <p className='qr-label'>{label}</p>}
    </div>
  )
}

export default QRWidget
