import { useEffect, useState } from 'react'

function PlatformsDebug() {
  const [data, setData] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/v1/config/platforms')
      .then(r => r.json())
      .then(setData)
      .catch(e => setError(String(e)))
  }, [])

  if (error) return <pre style={{ color: 'red' }}>Error: {error}</pre>
  if (!data) return <p>Loading platforms...</p>
  return <pre>{JSON.stringify(data, null, 2)}</pre>
}

function App() {
  return (
    <div>
      <h1>Listing Manager</h1>
      <details>
        <summary>Platform Profiles</summary>
        <PlatformsDebug />
      </details>
    </div>
  )
}

export default App
