import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SceneGallery from './components/SceneGallery.tsx'

const gallery = new URLSearchParams(location.search).get('gallery')
const galleryLook = gallery === 'pipboy' || gallery === 'parchment' ? gallery : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {galleryLook ? <SceneGallery look={galleryLook} /> : <App />}
  </StrictMode>,
)
