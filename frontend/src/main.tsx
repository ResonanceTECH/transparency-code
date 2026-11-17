import '@fontsource/lato/400.css'
import '@fontsource/lato/400-italic.css'
import '@fontsource/lato/700.css'
import '@fontsource/lato/900.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import FinancialProfileGate from './profile/FinancialProfileGate'

createRoot(document.getElementById('root')!).render(<StrictMode>{window.location.pathname === '/prototype' ? <FinancialProfileGate /> : <App />}</StrictMode>)
