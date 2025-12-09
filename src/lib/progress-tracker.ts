export interface ProgressUpdate {
  id: string
  step: string
  progress: number // 0-100
  message: string
  timestamp: number
}

class ProgressTracker {
  private progressMap = new Map<string, ProgressUpdate>()
  private listeners = new Map<string, Set<(update: ProgressUpdate) => void>>()

  updateProgress(id: string, step: string, progress: number, message: string) {
    const update: ProgressUpdate = {
      id,
      step,
      progress,
      message,
      timestamp: Date.now()
    }
    
    console.log(`Progress update for ${id}:`, update)
    this.progressMap.set(id, update)
    
    // Notify listeners
    const stepListeners = this.listeners.get(id)
    console.log(`Notifying ${stepListeners?.size || 0} listeners for ${id}`)
    if (stepListeners) {
      stepListeners.forEach(listener => listener(update))
    }
  }

  getProgress(id: string): ProgressUpdate | undefined {
    return this.progressMap.get(id)
  }

  subscribe(id: string, callback: (update: ProgressUpdate) => void) {
    if (!this.listeners.has(id)) {
      this.listeners.set(id, new Set())
    }
    this.listeners.get(id)!.add(callback)
    
    // Send current progress if available
    const current = this.progressMap.get(id)
    if (current) {
      callback(current)
    }
  }

  unsubscribe(id: string, callback: (update: ProgressUpdate) => void) {
    const stepListeners = this.listeners.get(id)
    if (stepListeners) {
      stepListeners.delete(callback)
      if (stepListeners.size === 0) {
        this.listeners.delete(id)
      }
    }
  }

  cleanup(id: string) {
    this.progressMap.delete(id)
    this.listeners.delete(id)
  }
}

export const progressTracker = new ProgressTracker()