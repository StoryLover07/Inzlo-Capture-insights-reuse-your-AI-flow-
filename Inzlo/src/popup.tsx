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
  const [selectedTag, setSelectedTag] = useState("All")
  const [currentContext, setCurrentContext] = useState("ALL")
  const [showSettings, setShowSettings] = useState(false) // 👈 Settings view toggle
  const [isDarkMode, setIsDarkMode] = useState(false) // 👈 Dark mode state

  useEffect(() => {
    loadData()
    detectContext()
    loadSettings() // 👈 Load dark mode pref
  }, [])

  const loadSettings = () => {
    chrome.storage.local.get(["inzlo_darkmode"], (res) => {
      if (res.inzlo_darkmode !== undefined) {
        setIsDarkMode(res.inzlo_darkmode)
      }
    })
  }

  const toggleDarkMode = (val: boolean) => {
    setIsDarkMode(val)
    chrome.storage.local.set({ inzlo_darkmode: val })
  }

  const detectContext = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || ""
      let context = "ALL"
      if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) {
        context = "AI"
      } else if (url.includes("mail.google.com")) {
        context = "Email"
      }
      setCurrentContext(context)
    })
  }

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

  // 👈 Dual Filter Chain (Recommended / Others)
  const getFilteredItems = (items: Prompt[]) => {
    return items.filter(p => {
      const itemTag = (p.tag || "General").toLowerCase()
      const matchesTag = selectedTag === "All" || itemTag === selectedTag.toLowerCase()
      const matchesSearch = p.content.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesTag && matchesSearch
    })
  }

  const baseFiltered = getFilteredItems(prompts)
  
  const recommendedItems = baseFiltered.filter(p => {
    const itemTag = (p.tag || "General").toLowerCase()
    return currentContext === "ALL" || itemTag === currentContext.toLowerCase()
  })

  const otherItems = baseFiltered.filter(p => {
    const itemTag = (p.tag || "General").toLowerCase()
    return currentContext !== "ALL" && itemTag !== currentContext.toLowerCase()
  })

  const tags = ["All", "General", "AI", "Email", "Code"]

  const handleTagClick = (tag: string) => {
    setSelectedTag(tag)
    playCheckSound()
  }

  const renderPromptItem = (p: Prompt) => {
    const isSelected = selectedIds.has(p.id)
    const isCopied = copiedId === p.id
    
    return (
      <div
        key={p.id}
        onClick={() => handleCopy(p.id, p.content)}
        className={`prompt-item ${isCopied ? "glow-item" : ""}`}
        style={{
          position: "relative",
          border: isSelected ? "2px solid #1890ff" : (isDarkMode ? "1px solid #333" : "1px solid #f0f0f0"),
          borderRadius: "10px",
          padding: "12px 12px 24px 36px",
          marginBottom: "10px",
          cursor: "pointer",
          fontSize: "13px",
          lineHeight: "1.5",
          backgroundColor: isSelected ? (isDarkMode ? "#112233" : "#e6f7ff") : (isDarkMode ? "#1a1a1a" : "#fff"),
          transition: "all 0.2s ease",
          boxShadow: isCopied ? "none" : "0 2px 4px rgba(0,0,0,0.02)",
          display: "flex",
          alignItems: "center",
          minHeight: "50px"
        }}
      >
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
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                wordBreak: "break-all"
              }}>
                {p.content}
              </div>
            </div>

            {p.source && (
              <a 
                href={p.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="source-tooltip"
                onClick={(e) => e.stopPropagation()}
              >
                <span style={{ fontWeight: "bold", color: "#1890ff" }}>{p.source}</span>
                <span>·</span>
                <span style={{ opacity: 0.8 }}>
                  {p.url ? new URL(p.url).hostname : "local"}
                </span>
              </a>
            )}
            
            <div className="copy-hint">Click to Copy</div>
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ 
      width: "340px", 
      padding: "16px", 
      fontFamily: "'Inter', sans-serif",
      backgroundColor: isDarkMode ? "#121212" : "#fff",
      color: isDarkMode ? "#fff" : "#333",
      minHeight: "550px",
      transition: "all 0.3s ease"
    }}>
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
          .glow-item { animation: glow-animation 1s ease forwards; }
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
          .tag-btn {
            padding: 4px 10px;
            font-size: 11px;
            border-radius: 20px;
            border: 1px solid #eee;
            cursor: pointer;
            transition: all 0.2s;
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
          .prompt-item:hover .copy-hint { opacity: 1; }
          .source-tooltip {
            position: absolute;
            bottom: 110%;
            left: -20px;
            background: rgba(0, 0, 0, 0.85);
            color: #fff;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 11px;
            white-space: nowrap;
            opacity: 0;
            transition: all 0.2s ease;
            z-index: 100;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 6px;
            text-decoration: none;
            cursor: pointer;
          }
          .source-tooltip::after {
            content: '';
            position: absolute;
            top: 100%;
            right: 15px;
            border-width: 5px;
            border-style: solid;
            border-color: rgba(0, 0, 0, 0.85) transparent transparent transparent;
          }
          .prompt-item:hover .source-tooltip { opacity: 1; transform: translateY(-2px); }
          .prompt-item:hover .item-checkbox { opacity: 1 !important; }
          
          .apple-switch { position: relative; display: inline-block; width: 40px; height: 22px; }
          .apple-switch input { opacity: 0; width: 0; height: 0; }
          .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
          .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; }
          input:checked + .slider { background-color: #34C759; }
          input:checked + .slider:before { transform: translateX(18px); }
          
          .others-section {
            background-color: #000;
            border-radius: 12px;
            padding: 12px;
            margin-top: 15px;
          }
          .others-section .prompt-item {
            background-color: #1a1a1a !important;
            border-color: #333 !important;
            color: #ccc !important;
          }
          .others-section .prompt-item:hover {
            color: #1890ff !important;
          }
          .others-section .source-tooltip {
            background: rgba(255,255,255,0.9) !important;
            color: #000 !important;
          }
          
          .scroll-area {
            max-height: 250px;
            overflow-y: auto;
            padding-right: 4px;
          }
          .scroll-area::-webkit-scrollbar { width: 4px; }
          .scroll-area::-webkit-scrollbar-thumb { background: #eee; border-radius: 10px; }
        `}
      </style>

      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: "16px" 
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", letterSpacing: "-0.5px" }}>Inzlo</h2>
          {!showSettings && (
            <div style={{ fontSize: "10px", color: "#1890ff", fontWeight: "700" }}>Context: {currentContext}</div>
          )}
        </div>
        
        <div style={{ display: "flex", gap          {selectedIds.size > 0 ? (
            <button onClick={deleteSelected} style={{ backgroundColor: "#ff4d4f", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", cursor: "pointer", fontWeight: "600" }}>
              Delete ({selectedIds.size})
            </button>
          ) : (
            <>
              {!showSettings && (
                <button onClick={handleClearAll} style={{ backgroundColor: "transparent", border: `1px solid ${isDarkMode ? "#333" : "#ddd"}`, color: "#999", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", cursor: "pointer" }}>
                  Clear All
                </button>
              )}
              <div onClick={() => setShowSettings(!showSettings)} style={{ cursor: "pointer", fontSize: "18px", padding: "4px" }}>
                {showSettings ? "✕" : "⚙️"}
              </div>
            </>
          )}
        </div>
      </div>

      {showSettings ? (
        <div className="settings-view" style={{ animation: "fadeIn 0.3s" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "20px" }}>Settings</h3>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", backgroundColor: isDarkMode ? "#1a1a1a" : "#fafafa", borderRadius: "10px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600" }}>Dark Mode</span>
            <label className="apple-switch">
              <input type="checkbox" checked={isDarkMode} onChange={(e) => toggleDarkMode(e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
          <p style={{ fontSize: "11px", color: "#999", marginTop: "40px", textAlign: "center" }}>Inzlo v1.2 · Pro Edition</p>
        </div>
      ) : (
        <>
          {/* Search & Tags */}
          <div style={{ marginBottom: "16px" }}>
            <input 
              type="text" 
              placeholder={`Search in ${selectedTag}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: "8px", fontSize: "13px", outline: "none",
                border: isDarkMode ? "1px solid #333" : "1px solid #ddd",
                backgroundColor: isDarkMode ? "#1a1a1a" : "#fff",
                color: isDarkMode ? "#fff" : "#333",
                marginBottom: "10px"
              }}
            />
            <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
              {tags.map(t => (
                <button 
                  key={t}
                  onClick={() => handleTagClick(t)}
                  className={`tag-btn ${selectedTag === t ? 'active' : ''}`}
                  style={{
                    backgroundColor: selectedTag === t ? "#1890ff" : (isDarkMode ? "#1a1a1a" : "#fff"),
                    color: selectedTag === t ? "#fff" : (isDarkMode ? "#999" : "#666"),
                    borderColor: selectedTag === t ? "#1890ff" : (isDarkMode ? "#333" : "#eee")
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>Loading...</div>
          ) : prompts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>No insights yet!</div>
          ) : (
            <div style={{ height: "420px", overflowY: "auto", paddingRight: "4px" }}>
              {/* 🏆 Recommended */}
              {recommendedItems.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "800", color: "#1890ff", marginBottom: "10px", textTransform: "uppercase" }}>
                    Recommended for {currentContext}
                  </div>
                  {recommendedItems.map(p => renderPromptItem(p))}
                </div>
              )}

              {/* 🌑 Others */}
              {otherItems.length > 0 && (
                <div className="others-section">
                  <div style={{ fontSize: "11px", fontWeight: "800", color: "#999", marginBottom: "10px", textTransform: "uppercase" }}>
                    Others
                  </div>
                  <div className="scroll-area">
                    {otherItems.map(p => renderPromptItem(p))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}