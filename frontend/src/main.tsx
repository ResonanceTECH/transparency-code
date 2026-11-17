import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import FinancialProfile from './profile/FinancialProfile'

createRoot(document.getElementById('root')!).render(<StrictMode>{window.location.pathname === '/prototype' ? <FinancialProfile /> : <App />}</StrictMode>)
