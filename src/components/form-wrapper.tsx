'use client'

import { useEffect, useState } from 'react'

interface FormWrapperProps {
  children: React.ReactNode
  className?: string
}

export function FormWrapper({ children, className = '' }: FormWrapperProps) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Prevent hydration mismatch by only rendering on client
  if (!isClient) {
    return <div className={className} style={{ visibility: 'hidden' }} />
  }

  return <div className={className}>{children}</div>
} 