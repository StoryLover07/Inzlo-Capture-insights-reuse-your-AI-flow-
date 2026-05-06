import { useEffect, useState } from "react"

type Prompt = {
  id: string
  content: string
  createdAt: number
}

export default function Popup() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log("Popup opened, fetching data...")
    chrome.storage.local.get(["inzlo_prompts"], (result) => {
      console.log("Storage result:", result)
      const data: Prompt[] = result.inzlo_prompts || []
      
      // Ensure each item has createdAt for sorting
      const sorted = data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      
      setPrompts(sorted)
      setLoading(false)
      console.log("Prompts loaded:", sorted.length)
    })
  }, [])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    alert("Copied to clipboard!")
  }

  const handleClear = () => {
    if (confirm("Clear all saved prompts?")) {
      chrome.storage.local.set({ inzlo_prompts: [] }, () => {
        setPrompts([])
      })
    }
  }

  return (
    <div style={{ padding: 15, width: 320, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Saved Prompts</h3>
        <button onClick={handleClear} style={{ fontSize: 10, cursor: "pointer" }}>Clear</button>
      </div>

      <hr />

      {loading ? (
        <p>Loading...</p>
      ) : prompts.length === 0 ? (
        <p style={{ color: "#666" }}>No saved prompts yet. Drag text and click Save!</p>
      ) : (
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {prompts.map((p) => (
            <div
              key={p.id}
              onClick={() => handleCopy(p.content)}
              style={{
                border: "1px solid #eee",
                borderRadius: 8,
                padding: "10px",
                marginBottom: 10,
                cursor: "pointer",
                fontSize: "13px",
                lineHeight: "1.4",
                background: "#f9f9f9",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f0f0")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#f9f9f9")}
            >
              {p.content}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}