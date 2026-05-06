import { useEffect, useState } from "react"

type Prompt = {
  id: string
  content: string
  createdAt: number
}

export default function Popup() {
  const [prompts, setPrompts] = useState<Prompt[]>([])

  useEffect(() => {
    chrome.storage.local.get(["inzlo_prompts"], (result) => {
      const data: Prompt[] = result.inzlo_prompts || []
      const sorted = data.sort((a, b) => b.createdAt - a.createdAt)
      setPrompts(sorted)
    })
  }, [])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    console.log("Copied:", text)
  }

  return (
    <div style={{ padding: 10, width: 300 }}>
      <h3>Saved Prompts</h3>

      {prompts.length === 0 ? (
        <p>No saved prompts</p>
      ) : (
        prompts.map((p) => (
          <div
            key={p.id}
            onClick={() => handleCopy(p.content)}
            style={{
              border: "1px solid #ccc",
              borderRadius: 6,
              padding: 8,
              marginBottom: 8,
              cursor: "pointer"
            }}
          >
            {p.content}
          </div>
        ))
      )}
    </div>
  )
}