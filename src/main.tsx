import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import CarApp from './car/CarApp.tsx'
import SceneGallery from './components/SceneGallery.tsx'
import { startNative } from './lib/native.ts'

const gallery = new URLSearchParams(location.search).get('gallery')
const galleryLook = gallery === 'pipboy' || gallery === 'parchment' ? gallery : null
// the car's screen (CarPlay) loads the site this way: just the map, fed by the phone app (see src/car/CarApp.tsx)
const carMode = new URLSearchParams(location.search).get('car') === '1'

// the Pip-Boy's plastic shell round the edge of the screen (see index.css): set this to false to take it away at once
const PIP_SHELL = true
document.documentElement.classList.toggle('rm-shell', PIP_SHELL)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {carMode ? <CarApp /> : galleryLook ? <SceneGallery look={galleryLook} /> : <App />}
  </StrictMode>,
)

void startNative()
