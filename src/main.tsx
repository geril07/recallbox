import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { MotionConfig } from 'motion/react'
import { TooltipProvider } from './components/ui/tooltip'
import { ToastProvider } from './components/ui/toast'
import { router } from './router'
import './index.css'
import './pwa'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <TooltipProvider delay={350}>
        <ToastProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded focus:bg-card focus:p-3"
          >
            Skip to content
          </a>
          <RouterProvider router={router} />
        </ToastProvider>
      </TooltipProvider>
    </MotionConfig>
  </StrictMode>,
)
