import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

// HashRouter is needed for GitHub Pages (and RSK = history.back on Cloud Phone)
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter basename="">
      <App />
    </HashRouter>
  </StrictMode>,
)
