import '../styles/globals.css'
import { AuthProvider } from '../contexts/AuthContext'
import { CsrfProvider } from '../contexts/CsrfContext'

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <CsrfProvider>
        <Component {...pageProps} />
      </CsrfProvider>
    </AuthProvider>
  )
}
