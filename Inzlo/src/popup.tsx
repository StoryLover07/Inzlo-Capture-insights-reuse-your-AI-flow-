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
  const [showSettings, setShowSettings] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [recExpanded, setRecExpanded] = useState(true)
  const [othersExpanded, setOthersExpanded] = useState(true)
  const [recHeight, setRecHeight] = useState(200) // 👈 추천 목록 높이 상태
  const [isDragging, setIsDragging] = useState(false) // 👈 드래그 상태

  useEffect(() => {
    loadData()
    detectContext()
    loadSettings()
  }, [])

  // 👈 드래그 로직
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      // 팝업 내 마우스 위치 계산 (최소 50px ~ 최대 400px 제한)
      const newHeight = Math.max(50, Math.min(400, e.clientY - 150))
      setRecHeight(newHeight)
    }
    const handleMouseUp = () => setIsDragging(false)

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging])

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
    playCheckSound() // 👈 효과음 추가
  }

  const detectContext = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || ""
      let context = "ALL"
      if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) {
        context = "AI"
      } else if (url.includes("claude.ai")) {
        context = "AI"
      } else if (url.includes("gemini.google.com")) {
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
  
  // 👈 Logic Fix: Separate Recommended vs Non-recommended
  const recommendedItems = baseFiltered.filter(p => {
    const itemTag = (p.tag || "General").toLowerCase()
    // AI 사이트면 AI 태그, Email 사이트면 Email 태그, ALL이면 General 태그를 추천
    if (currentContext === "AI") return itemTag === "ai"
    if (currentContext === "Email") return itemTag === "email"
    return itemTag === "general" // ALL context일 때
  })

  const otherItems = baseFiltered.filter(p => {
    const itemTag = (p.tag || "General").toLowerCase()
    if (currentContext === "AI") return itemTag !== "ai"
    if (currentContext === "Email") return itemTag !== "email"
    return itemTag !== "general" // ALL context일 때
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
          border: isSelected ? "1px solid #1890ff" : (isDarkMode ? "1px solid #333" : "1px solid #f0f0f0"),
          borderRadius: "10px",
          padding: "12px 16px 28px 16px",
          marginBottom: "10px",
          cursor: "pointer",
          fontSize: "13px",
          lineHeight: "1.5",
          backgroundColor: isSelected ? (isDarkMode ? "#112233" : "#f0f7ff") : (isDarkMode ? "#1a1a1a" : "#fff"),
          transition: "all 0.2s ease",
          boxShadow: isSelected ? "0 4px 12px rgba(24, 144, 255, 0.1)" : "0 2px 4px rgba(0,0,0,0.02)",
          display: "flex",
          alignItems: "center",
          minHeight: "50px",
          overflow: "hidden"
        }}
      >
        {/* ⚡ Left Edge Highlight Bar (Visual Only) */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "6px",
            height: "100%",
            backgroundColor: isSelected ? "#1890ff" : "transparent",
            transition: "all 0.2s",
            zIndex: 10
          }}
        />

        {/* 🔘 Corner Floating Badge (Interaction) */}
        <div
          onClick={(e) => toggleSelect(p.id, e)}
          style={{
            position: "absolute",
            right: "10px",
            top: "10px",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            border: isSelected ? "none" : "1px solid #d9d9d9",
            backgroundColor: isSelected ? "#1890ff" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
            opacity: isSelected ? "1" : "0", // 👈 선택되지 않았을 때는 hover 시에만 보이도록 CSS에서 처리
            zIndex: 30
          }}
          className="corner-badge"
        >
          {isSelected && (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
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
                color: isSelected ? "#1890ff" : "#888", 
                fontWeight: "bold", 
                marginBottom: "4px",
                textTransform: "uppercase",
                transition: "color 0.2s"
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
                className="source-layer"
                onClick={(e) => e.stopPropagation()}
              >
                <span style={{ fontWeight: "bold", color: "#1890ff" }}>{p.source}</span>
                <span style={{ opacity: 0.5 }}>·</span>
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
          .source-layer {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 28px;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(4px);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 11px;
            transform: translateY(100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 20;
            text-decoration: none;
            border-bottom-left-radius: 8px;
            border-bottom-right-radius: 8px;
          }
          .prompt-item:hover .source-layer { transform: translateY(0); }
          .prompt-item:hover .item-checkbox { opacity: 1 !important; }
          .prompt-item:hover .corner-badge { opacity: 1 !important; }
          
          .arrow-icon {
            font-size: 10px;
            color: #1890ff;
            transition: transform 0.3s ease;
            margin-left: 6px;
          }
          .arrow-right { transform: rotate(-90deg); }
          .arrow-down { transform: rotate(0deg); }
          
          .section-header {
            display: flex;
            align-items: center;
            cursor: pointer;
            user-select: none;
            margin-bottom: 10px;
            padding: 0 4px; /* 👈 align with content */
          }
          
          .scroll-area {
            overflow-y: auto;
            padding-right: 4px;
            transition: all 0.3s ease;
          }
          .scroll-area::-webkit-scrollbar { width: 4px; }
          .scroll-area::-webkit-scrollbar-thumb { background: #eee; border-radius: 10px; }
          
          .apple-switch { position: relative; display: inline-block; width: 40px; height: 22px; }
          .apple-switch input { opacity: 0; width: 0; height: 0; }
          .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
          .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; }
          input:checked + .slider { background-color: #34C759; }
          input:checked + .slider:before { transform: translateX(18px); }
          input { box-sizing: border-box; }
          
          .others-section {
            border-radius: 12px;
            padding: 4px 0;
            margin-top: 5px;
          }
          .others-section .prompt-item {
            background: linear-gradient(145deg, #434343, #121212) !important;
            border-color: #333 !important;
            color: #e0e0e0 !important;
            box-shadow: inset 0 1px 1px rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.2) !important;
          }
          .others-section .prompt-item:hover {
            background: linear-gradient(145deg, #4d4d4d, #1a1a1a) !important;
            color: #1890ff !important;
            border-color: #444 !important;
          }

          body, html {
            margin: 0;
            padding: 0;
            border: none;
            background-color: transparent;
          }
          .resizer-bar {
            height: 10px; /* 👈 클릭 영역을 더 넓게 확장 */
            width: 100%;
            cursor: row-resize;
            background: transparent;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 2px 0;
            transition: all 0.2s;
            z-index: 50;
          }
          .resizer-bar:hover { background: rgba(24, 144, 255, 0.05); }
          .resizer-bar::after {
            content: "";
            width: 40px; /* 👈 핸들 길이 확장 */
            height: 3px; /* 👈 기본 두께 */
            background: ${isDarkMode ? "#444" : "#ddd"};
            border-radius: 4px;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .resizer-bar:hover::after { 
            background: #1890ff; 
            width: 60px; /* 👈 호버 시 더 길어짐 */
            height: 5px; /* 👈 호버 시 더 두꺼워짐 */
            box-shadow: 0 0 8px rgba(24, 144, 255, 0.3);
          }
        `}
      </style>

      {/* 🚀 Header */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: "16px",
        borderBottom: isDarkMode ? "1px solid #222" : "none",
        paddingBottom: isDarkMode ? "8px" : "0"
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", letterSpacing: "-0.5px" }}>Inzlo</h2>
          {!showSettings && (
            <div style={{ fontSize: "10px", color: "#1890ff", fontWeight: "700" }}>Context: {currentContext}</div>
          )}
        </div>
        
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {selectedIds.size > 0 ? (
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
              <div 
                onClick={() => {
                  setShowSettings(!showSettings)
                  playCheckSound()
                }} 
                style={{ cursor: "pointer", fontSize: "18px", padding: "4px", color: isDarkMode ? "#fff" : "#333" }}
              >
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
        <div style={{ height: "460px", display: "flex", flexDirection: "column" }}>
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
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "5px", minHeight: 0 }}>
              {/* 🏆 Recommended Section */}
              {(recommendedItems.length > 0 || currentContext !== "ALL") && (
                <div style={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  flex: recExpanded ? (othersExpanded ? "none" : 1) : "none",
                  height: recExpanded && othersExpanded ? `${recHeight}px` : "auto",
                  minHeight: recExpanded ? "80px" : "auto"
                }}>
                  <div className="section-header" onClick={() => { setRecExpanded(!recExpanded); playCheckSound(); }}>
                    <div style={{ fontSize: "11px", fontWeight: "800", color: "#1890ff", textTransform: "uppercase" }}>
                      Recommended for {currentContext}
                    </div>
                    <span className={`arrow-icon ${recExpanded ? 'arrow-down' : 'arrow-right'}`}>▼</span>
                  </div>
                  {recExpanded && (
                    <div className="scroll-area" style={{ flex: 1 }}>
                      {recommendedItems.map(p => renderPromptItem(p))}
                      {recommendedItems.length === 0 && <div style={{ fontSize: "11px", color: "#999", padding: "10px" }}>No context matches.</div>}
                    </div>
                  )}
                </div>
              )}

              {/* 📏 Resizer Bar */}
              {recExpanded && othersExpanded && recommendedItems.length > 0 && otherItems.length > 0 && (
                <div 
                  className="resizer-bar" 
                  onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }}
                />
              )}

              {/* 🌑 Non-recommended Section */}
              {otherItems.length > 0 && (
                <div className="others-section" style={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  flex: 1,
                  minHeight: othersExpanded ? "100px" : "auto"
                }}>
                  <div className="section-header" onClick={() => { setOthersExpanded(!othersExpanded); playCheckSound(); }}>
                    <div style={{ fontSize: "11px", fontWeight: "800", color: "#999", textTransform: "uppercase" }}>
                      Non-recommended for {currentContext}
                    </div>
                    <span className={`arrow-icon ${othersExpanded ? 'arrow-down' : 'arrow-right'}`}>▼</span>
                  </div>
                  {othersExpanded && (
                    <div className="scroll-area" style={{ flex: 1 }}>
                      {otherItems.map(p => renderPromptItem(p))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}