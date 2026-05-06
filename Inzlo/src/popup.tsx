import { useEffect, useState } from "react"

type Prompt = {
  id: string
  content: string
  tag?: string
  source?: string // 👈 추가
  url?: string    // 👈 추가
  title?: string  // 👈 추가
  createdAt: number
}

export default function Popup() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTag, setSelectedTag] = useState("All") // 👈 Tag state

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

  const SUCCESS_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3"
  const TRASH_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2544/2544-preview.mp3"
  const CHECK_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3"

  const [copiedId, setCopiedId] = useState<string | null>(null)

  const playSuccessSound = () => {
    const audio = new Audio(SUCCESS_SOUND_URL)
    audio.volume = 0.4
    audio.play().catch(() => {})
  }

  const playDeleteSound = () => {
    const audio = new Audio(TRASH_SOUND_URL)
    audio.volume = 0.5
    audio.play().catch(() => {})
  }

  const playCheckSound = () => {
    const audio = new Audio(CHECK_SOUND_URL)
    audio.volume = 0.3
    audio.play().catch(() => {})
  }

  const playCopySound = async () => {
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)()
      const response = await fetch(SUCCESS_SOUND_URL)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await context.decodeAudioData(arrayBuffer)
      
      const source = context.createBufferSource()
      const gainNode = context.createGain()
      
      const channelCount = audioBuffer.numberOfChannels
      const newBuffer = context.createBuffer(channelCount, audioBuffer.length, audioBuffer.sampleRate)
      
      for (let i = 0; i < channelCount; i++) {
        const channelData = audioBuffer.getChannelData(i)
        const reversedData = newBuffer.getChannelData(i)
        for (let j = 0, k = channelData.length - 1; k >= 0; j++, k--) {
          reversedData[j] = channelData[k]
        }
      }
      
      source.buffer = newBuffer
      
      const duration = newBuffer.duration
      gainNode.gain.setValueAtTime(0.3, context.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration)
      
      source.connect(gainNode)
      gainNode.connect(context.destination)
      
      source.start()
    } catch (e) {
      console.error("Reverse audio failed", e)
    }
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    playCopySound()
    setTimeout(() => setCopiedId(null), 1000)
  }

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
      playCheckSound()
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

  // 👈 Enhanced filter logic (Tag + Search)
  const filteredPrompts = prompts.filter(p => {
    const itemTag = (p.tag || "General").toLowerCase()
    const targetTag = selectedTag.toLowerCase()
    
    const matchesTag = selectedTag === "All" || itemTag === targetTag
    const matchesSearch = p.content.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesTag && matchesSearch
  })

  const tags = ["All", "General", "AI", "Email", "Code"] // 👈 Reordered tags

  const handleTagClick = (tag: string) => {
    setSelectedTag(tag)
    playCheckSound() // 👈 Play sound on tag click
  }

  return (
    <div style={{ padding: "16px", width: "340px", fontFamily: "'Inter', sans-serif", color: "#333" }}>
      <style>
        {`
          @keyframes glow-animation {
            0% { border-color: #f0f0f0; box-shadow: 0 0 0px transparent; }
            30% { border-color: #ff00ea; box-shadow: 0 0 15px rgba(255, 0, 234, 0.5); }
            60% { border-color: #00d2ff; box-shadow: 0 0 15px rgba(0, 210, 255, 0.5); }
            100% { border-color: #f0f0f0; box-shadow: 0 0 0px transparent; }
          }
          @keyframes blink-animation {
            0% { opacity: 1; }
            50% { opacity: 0.3; }
            100% { opacity: 1; }
          }
          .glow-item {
            animation: glow-animation 1s ease forwards;
          }
          .blink-text {
            animation: blink-animation 0.5s ease infinite;
            font-weight: bold;
            color: #1890ff;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            min-height: 45px;
          }
          input::placeholder {
            color: #ccc;
          }
          .tag-btn {
            padding: 4px 10px;
            font-size: 11px;
            border-radius: 20px;
            border: 1px solid #eee;
            background: #fff;
            cursor: pointer;
            transition: all 0.2s;
            color: #666;
          }
          .tag-btn.active {
            background: #1890ff;
            color: #fff;
            border-color: #1890ff;
          }
          .copy-hint {
            position: absolute;
            right: 12px;
            bottom: 8px;
            font-size: 10px;
            color: #1890ff;
            opacity: 0;
            transition: opacity 0.2s;
            font-weight: 500;
          }
          .prompt-item:hover .copy-hint {
            opacity: 1;
          }
          .source-tooltip {
            position: absolute;
            bottom: 110%; /* 👈 조금 더 위로 띄움 */
            left: -20px;  /* 👈 본체를 왼쪽 밖으로 더 밀어냄 */
            background: rgba(0, 0, 0, 0.85);
            color: #fff;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 11px;
            white-space: nowrap;
            opacity: 0;
            pointer-events: none;
            transition: all 0.2s ease;
            z-index: 100;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .source-tooltip::after {
            content: '';
            position: absolute;
            top: 100%;
            left: auto;
            right: 15px; /* 👈 말풍선의 오른쪽 끝에서 꼬리가 나오게 함 */
            border-width: 5px;
            border-style: solid;
            border-color: rgba(0, 0, 0, 0.85) transparent transparent transparent;
          }
          .prompt-item:hover .source-tooltip {
            opacity: 1;
            transform: translateY(-2px);
          }
        `}
      </style>

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

      {/* 👈 Tag Filter Row */}
      <div style={{ display: "flex", gap: "6px", overflowX: "auto", marginBottom: "12px", paddingBottom: "4px" }}>
        {tags.map(t => (
          <button 
            key={t}
            className={`tag-btn ${selectedTag === t ? 'active' : ''}`}
            onClick={() => handleTagClick(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 👈 Search Bar */}
      <div style={{ marginBottom: "16px" }}>
        <input 
          type="text"
          placeholder={`Search in ${selectedTag}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            fontSize: "13px",
            border: "1px solid #eee",
            borderRadius: "8px",
            outline: "none",
            boxSizing: "border-box",
            transition: "border-color 0.2s",
            backgroundColor: "#fcfcfc"
          }}
          onFocus={(e) => e.target.style.borderColor = "#1890ff"}
          onBlur={(e) => e.target.style.borderColor = "#eee"}
        />
      </div>

      <hr style={{ border: "0", borderTop: "1px solid #eee", marginBottom: "16px" }} />

      {loading ? (
        <p style={{ textAlign: "center", color: "#999" }}>Loading...</p>
      ) : filteredPrompts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#999" }}>
          <p style={{ fontSize: "14px", marginBottom: "8px" }}>
            {searchTerm || selectedTag !== "All" ? "No matching prompts" : "No insights captured yet."}
          </p>
          {!searchTerm && selectedTag === "All" && <p style={{ fontSize: "12px" }}>Drag text on any page and click Save!</p>}
        </div>
      ) : (
        <div style={{ maxHeight: "360px", overflowY: "auto", paddingRight: "4px", paddingTop: "30px" }}>
          {filteredPrompts.map((p) => {
            const isSelected = selectedIds.has(p.id)
            const isCopied = copiedId === p.id
            return (
              <div
                key={p.id}
                onClick={() => handleCopy(p.id, p.content)}
                className={`prompt-item ${isCopied ? "glow-item" : ""}`}
                style={{
                  position: "relative",
                  border: isSelected ? "2px solid #1890ff" : "1px solid #f0f0f0",
                  borderRadius: "10px",
                  padding: "12px 12px 24px 36px", // 👈 하단 패딩을 24px로 대폭 확대
                  marginBottom: "10px",
                  cursor: "pointer",
                  fontSize: "13px",
                  lineHeight: "1.5",
                  backgroundColor: isSelected ? "#e6f7ff" : "#fff",
                  transition: "all 0.2s ease",
                  boxShadow: isCopied ? "none" : "0 2px 4px rgba(0,0,0,0.02)",
                  display: "flex",
                  alignItems: "center",
                  minHeight: "50px"
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
                    top: "50%",
                    transform: "translateY(-50%)",
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
                
                {isCopied ? (
                  <div className="blink-text">Copied!</div>
                ) : (
                  <>
                    <div style={{ width: "100%" }}>
                      <div style={{ 
                        fontSize: "10px", 
                        color: "#1890ff", 
                        fontWeight: "bold", 
                        marginBottom: "4px",
                        textTransform: "uppercase"
                      }}>
                        [{p.tag || "General"}]
                      </div>
                      <div style={{ 
                        overflow: "hidden", 
                        display: "-webkit-box", 
                        WebkitLineClamp: 2, // 👈 3줄에서 2줄로 변경
                        WebkitBoxOrient: "vertical",
                        wordBreak: "break-all",
                        marginBottom: "4px"
                      }}>
                        {p.content}
                      </div>
                    </div>

                    {/* 👈 Source Tooltip */}
                    {p.source && (
                      <div className="source-tooltip">
                        <span style={{ fontWeight: "bold", color: "#1890ff" }}>{p.source}</span>
                        <span>·</span>
                        <span style={{ opacity: 0.8 }}>
                          {p.url ? new URL(p.url).hostname : "local"}
                        </span>
                      </div>
                    )}
                    
                    <div className="copy-hint">Click to Copy</div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}