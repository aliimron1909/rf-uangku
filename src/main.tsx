import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { seedIfEmpty } from './db/seed'

async function start() {
  try {
    await seedIfEmpty()
  } catch (error) {
    console.error('Gagal menyiapkan data awal:', error)
  }

  const container = document.getElementById('root')
  if (!container) throw new Error('Elemen #root tidak ditemukan')

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void start()
