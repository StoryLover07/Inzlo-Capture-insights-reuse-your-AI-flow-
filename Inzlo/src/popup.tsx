import { useEffect, useState } from "react"

type Prompt = {
  id: string
  content: string
  createdAt: number
}

export default function Popup() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    chrome.storage.local.get(["inzlo_prompts"], (result) => {
      const data: Prompt[] = result.inzlo_prompts || []
      const sorted = data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      setPrompts(sorted)
      setLoading(false)
    })
  }

  const playSuccessSound = () => {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3")
    audio.volume = 0.5
    audio.play().catch(() => {})
  }

  const playDeleteSound = () => {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3")
    audio.volume = 0.5
    audio.play().catch(() => {})
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    // Removed alert for cleaner UX
  }

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation() // 👈 Blocks handleCopy
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const deleteSelected = () => {
    if (selectedIds.size === 0) return
    if (confirm(`Delete ${selectedIds.size} selected items?`)) {
      const updated = prompts.filter((p) => !selectedIds.has(p.id))
      chrome.storage.local.set({ inzlo_prompts: updated }, () => {
        setPrompts(updated)
        setSelectedIds(new Set())
        playDeleteSound()
      })
    }
  }

  const handleClearAll = () => {
    if (confirm("Clear all saved prompts?")) {
      chrome.storage.local.set({ inzlo_prompts: [] }, () => {
        setPrompts([])
        setSelectedIds(new Set())
        playDeleteSound()
      })
    }
  }

  return (
    <div style={{ padding: "16px", width: "340px", fontFamily: "'Inter', sans-serif", color: "#333" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>Inzlo</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          {selectedIds.size > 0 && (
            <button 
              onClick={deleteSelected}
              style={{ 
                fontSize: "11px", 
                padding: "4px 8px", 
                backgroundColor: "#ff4d4f", 
                color: "white", 
                border: "none", 
                borderRadius: "4px", 
                cursor: "pointer" 
              }}
            >
              Delete ({selectedIds.size})
            </button>
          )}
          <button 
            onClick={handleClearAll}
            style={{ 
              fontSize: "11px", 
              padding: "4px 8px", 
              backgroundColor: "#f5f5f5", 
              border: "1px solid #d9d9d9", 
              borderRadius: "4px", 
              cursor: "pointer" 
            }}
          >
            Clear All
          </button>
        </div>
      </div>

      <hr style={{ border: "0", borderTop: "1px solid #eee", marginBottom: "16px" }} />

      {loading ? (
        <p style={{ textAlign: "center", color: "#999" }}>Loading...</p>
      ) : prompts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#999" }}>
          <p style={{ fontSize: "14px", marginBottom: "8px" }}>No insights captured yet.</p>
          <p style={{ fontSize: "12px" }}>Drag text on any page and click Save!</p>
        </div>
      ) : (
        <div style={{ maxHeight: "420px", overflowY: "auto", paddingRight: "4px" }}>
          {prompts.map((p) => {
            const isSelected = selectedIds.has(p.id)
            return (
              <div
                key={p.id}
                onClick={() => handleCopy(p.content)}
                style={{
                  position: "relative",
                  border: isSelected ? "1px solid #1890ff" : "1px solid #f0f0f0",
                  borderRadius: "10px",
                  padding: "12px 12px 12px 36px",
                  marginBottom: "10px",
                  cursor: "pointer",
                  fontSize: "13px",
                  lineHeight: "1.5",
                  backgroundColor: isSelected ? "#e6f7ff" : "#fff",
                  transition: "all 0.2s ease",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = "#fafafa"
                  const checkbox = e.currentTarget.querySelector(".item-checkbox") as HTMLElement
                  if (checkbox) checkbox.style.opacity = "1"
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = "#fff"
                  const checkbox = e.currentTarget.querySelector(".item-checkbox") as HTMLElement
                  if (checkbox && !isSelected) checkbox.style.opacity = "0"
                }}
              >
                {/* Custom Checkbox Container */}
                <div
                  className="item-checkbox"
                  onClick={(e) => toggleSelect(p.id, e)}
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "12px", // 👈 Better alignment
                    width: "18px",
                    height: "18px",
                    borderRadius: "4px",
                    border: isSelected ? "none" : "2px solid #d9d9d9",
                    backgroundColor: isSelected ? "#1890ff" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s",
                    opacity: isSelected ? "1" : "0",
                    zIndex: 10
                  }}
                >
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                
                <div style={{ 
                  overflow: "hidden", 
                  display: "-webkit-box", 
                  WebkitLineClamp: 3, 
                  WebkitBoxOrient: "vertical",
                  wordBreak: "break-all"
                }}>
                  {p.content}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}