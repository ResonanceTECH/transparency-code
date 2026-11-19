import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import FinancialProfileGate from './profile/FinancialProfileGate'
import './base.css'

// Один API-интерфейс для всех ролей. /prototype остаётся совместимой ссылкой.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FinancialProfileGate />
  </StrictMode>
)
