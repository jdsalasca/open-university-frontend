import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getPublicBranding } from './api/brandingClient'
import type { PublicBranding } from './contracts'
import { DEFAULT_BRANDING } from './contracts'
import { BrandingContext } from './BrandingContext'
import type { BrandingContextValue, BrandingStatus } from './BrandingContext'

interface BrandingProviderProps {
  children: ReactNode
  loader?: (signal: AbortSignal) => Promise<PublicBranding>
  timeoutMs?: number
}

export function BrandingProvider({ children, loader = getPublicBranding, timeoutMs = 3000 }: BrandingProviderProps) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING)
  const [status, setStatus] = useState<BrandingStatus>('loading')
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let timer: number | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = window.setTimeout(() => {
        controller.abort()
        reject(new Error('Branding request timed out.'))
      }, timeoutMs)
    })

    Promise.race([loader(controller.signal), timeout])
      .then((configuration) => {
        if (!active) return
        setBranding(configuration)
        setStatus('ready')
      })
      .catch(() => {
        if (!active) return
        setBranding(DEFAULT_BRANDING)
        setStatus('fallback')
      })
      .finally(() => {
        if (timer !== undefined) window.clearTimeout(timer)
      })

    return () => {
      active = false
      if (timer !== undefined) window.clearTimeout(timer)
      controller.abort()
    }
  }, [loader, timeoutMs, requestVersion])

  useEffect(() => {
    const root = document.documentElement
    Object.entries(branding.colors).forEach(([key, value]) => {
      root.style.setProperty(`--brand-${key}`, value)
    })
  }, [branding.colors])

  const contextValue: BrandingContextValue = {
    branding,
    status,
    refresh: () => setRequestVersion((current) => current + 1),
  }

  return <BrandingContext.Provider value={contextValue}>{children}</BrandingContext.Provider>
}
