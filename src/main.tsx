import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { applyTheme, loadThemePref } from './lib/theme'
import './index.css'

// Apply the saved theme before the first paint so there is no flash.
applyTheme(loadThemePref().theme)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
