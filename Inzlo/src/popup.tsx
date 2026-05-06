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
  const [currentUrl, setCurrentUrl] = useState("") // 👈 현재 탭 URL 상태 추가
  const [showSettings, setShowSettings] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isSuggestEnabled, setIsSuggestEnabled] = useState(true)
  const [suggestDuration, setSuggestDuration] = useState(10) // 👈 노출 시간 (초)
  const [isTaggedOnly, setIsTaggedOnly] = useState(false) // 👈 특정 태그 사이트 전용 상태
  const [recExpanded, setRecExpanded] = useState(true)
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, tag: string } | null>(null) // 👈 우클릭 메뉴 상태
  const [othersExpanded, setOthersExpanded] = useState(true)
  const [recHeight, setRecHeight] = useState(200) // 👈 추천 목록 높이 상태
  const [isDragging, setIsDragging] = useState(false) // 👈 드래그 상태

  useEffect(() => {
    loadData()
    detectContext()
    loadSettings()
  }, [])

  // 👈 드래그 로직 및 메뉴 닫기 로직
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const newHeight = Math.max(50, Math.min(400, e.clientY - 150))
      setRecHeight(newHeight)
    }
    const handleMouseUp = () => setIsDragging(false)
    const closeMenu = () => setContextMenu(null)

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    }
    window.addEventListener("mousedown", closeMenu)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
      window.removeEventListener("mousedown", closeMenu)
    }
  }, [isDragging])

  const loadSettings = () => {
    chrome.storage.local.get(["inzlo_darkmode", "inzlo_suggest_enabled", "inzlo_suggest_duration", "inzlo_suggest_tagged_only"], (res) => {
      if (res.inzlo_darkmode !== undefined) setIsDarkMode(res.inzlo_darkmode)
      if (res.inzlo_suggest_enabled !== undefined) setIsSuggestEnabled(res.inzlo_suggest_enabled)
      if (res.inzlo_suggest_duration !== undefined) setSuggestDuration(res.inzlo_suggest_duration)
      if (res.inzlo_suggest_tagged_only !== undefined) setIsTaggedOnly(res.inzlo_suggest_tagged_only)
    })
  }

  const toggleDarkMode = (val: boolean) => {
    setIsDarkMode(val)
    chrome.storage.local.set({ inzlo_darkmode: val })
    playCheckSound()
  }

  const toggleSuggest = (val: boolean) => {
    setIsSuggestEnabled(val)
    chrome.storage.local.set({ inzlo_suggest_enabled: val })
    playCheckSound()
  }

  const toggleTaggedOnly = (val: boolean) => {
    setIsTaggedOnly(val)
    chrome.storage.local.set({ inzlo_suggest_tagged_only: val })
    playCheckSound()
  }

  const handleDurationChange = (val: number) => {
    setSuggestDuration(val)
    chrome.storage.local.set({ inzlo_suggest_duration: val })
  }

  const detectContext = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || ""
      setCurrentUrl(url)
      let context = "ALL"
      if (url.includes("chatgpt.com") || url.includes("chat.openai.com") || url.includes("claude.ai") || url.includes("gemini.google.com")) {
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
      setPrompts(data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
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
      const channelCount = audioBuffer.numberOfChannels
      const newBuffer = context.createBuffer(channelCount, audioBuffer.length, audioBuffer.sampleRate)
      for (let i = 0; i < channelCount; i++) {
        const channelData = audioBuffer.getChannelData(i)
        const reversedData = newBuffer.getChannelData(i)
        for (let j = 0, k = channelData.length - 1; k >= 0; j++, k--) {
          reversedData[j] = channelData[k]
        }
      }
      const source = context.createBufferSource()
      source.buffer = newBuffer
      const gainNode = context.createGain()
      gainNode.gain.setValueAtTime(0.3, context.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + newBuffer.duration)
      source.connect(gainNode)
      gainNode.connect(context.destination)
      source.start()
    } catch (e) {}
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
    if (newSelected.has(id)) newSelected.delete(id)
    else newSelected.add(id)
    playCheckSound()
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

  const getFilteredItems = (items: Prompt[]) => {
    return items.filter(p => {
      const itemTag = (p.tag || "General").toLowerCase()
      const matchesTag = selectedTag === "All" || itemTag === selectedTag.toLowerCase()
      const matchesSearch = p.content.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesTag && matchesSearch
    })
  }

  const getDomain = (u: string) => {
    try { return new URL(u).hostname.replace("www.", "") } catch(e) { return "" }
  }

  const baseFiltered = getFilteredItems(prompts)
  const activeDomain = getDomain(currentUrl)

  const recommendedItems = (() => {
    const siteSpecific = baseFiltered.filter(p => p.url && getDomain(p.url) === activeDomain)
    const contextSpecific = baseFiltered.filter(p => {
      const itemTag = (p.tag || "General").toLowerCase()
      const isContextMatch = (currentContext === "AI" && itemTag === "ai") ||
                           (currentContext === "Email" && itemTag === "email") ||
                           (currentContext === "ALL" && itemTag === "general")
      return isContextMatch && !siteSpecific.find(s => s.id === p.id)
    })
    return [...siteSpecific, ...contextSpecific]
  })()

  const otherItems = baseFiltered.filter(p => !recommendedItems.find(r => r.id === p.id))

  const defaultTags = ["All", "General", "AI", "Email", "Code"]
  const customTags = Array.from(new Set(prompts.map(p => p.tag).filter(t => t && !defaultTags.includes(t))))
  const dynamicTags = [...defaultTags, ...customTags]

  const handleTagClick = (tag: string) => {
    setSelectedTag(tag)
    playCheckSound()
    setContextMenu(null)
  }

  const handleContextMenu = (e: React.MouseEvent, tag: string) => {
    if (defaultTags.includes(tag)) return
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, tag })
  }

  const handleDeleteTag = (tag: string) => {
    if (confirm(`⚠️ WARNING: Are you sure you want to delete all items tagged with "${tag}"?\n\nThis action cannot be undone.`)) {
      const updated = prompts.filter(p => p.tag !== tag)
      chrome.storage.local.set({ inzlo_prompts: updated }, () => {
        setPrompts(updated)
        if (selectedTag === tag) setSelectedTag("All")
        setContextMenu(null)
        playDeleteSound()
      })
    }
  }

  const renderPromptItem = (p: Prompt) => {
    const isSelected = selectedIds.has(p.id)
    const isCopied = copiedId === p.id
    return (
      <div key={p.id} onClick={() => handleCopy(p.id, p.content)} className={`prompt-item ${isCopied ? "glow-item" : ""}`}
        style={{
          position: "relative", border: isSelected ? "1px solid #1890ff" : (isDarkMode ? "1px solid #333" : "1px solid #f0f0f0"),
          borderRadius: "10px", padding: "12px 16px 28px 16px", marginBottom: "10px", cursor: "copy", fontSize: "13px",
          lineHeight: "1.5", backgroundColor: isSelected ? (isDarkMode ? "#112233" : "#f0f7ff") : (isDarkMode ? "#1a1a1a" : "#fff"),
          transition: "all 0.2s ease", boxShadow: isSelected ? "0 4px 12px rgba(24, 144, 255, 0.1)" : "0 2px 4px rgba(0,0,0,0.02)",
          display: "flex", alignItems: "center", minHeight: "50px", overflow: "hidden"
        }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: "6px", height: "100%", backgroundColor: isSelected ? "#1890ff" : "transparent", transition: "all 0.2s", zIndex: 10 }} />
        <div onClick={(e) => toggleSelect(p.id, e)} style={{ position: "absolute", right: "10px", top: "10px", width: "16px", height: "16px", borderRadius: "50%", border: isSelected ? "none" : "1px solid #d9d9d9", backgroundColor: isSelected ? "#1890ff" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", opacity: isSelected ? "1" : "0", zIndex: 30 }} className="corner-badge">
          {isSelected && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
        {isCopied ? <div className="blink-text">Copied!</div> : (
          <div style={{ width: "100%" }}>
            <div style={{ fontSize: "10px", color: isSelected ? "#1890ff" : "#888", fontWeight: "bold", marginBottom: "4px", textTransform: "uppercase" }}>[{p.tag || "General"}]</div>
            <div style={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", wordBreak: "break-all" }}>{p.content}</div>
            {p.source && (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="source-layer" onClick={(e) => e.stopPropagation()}>
                <span style={{ fontWeight: "bold", color: "#1890ff" }}>{p.source}</span>
                <span style={{ opacity: 0.5 }}>·</span>
                <span style={{ opacity: 0.8 }}>{p.url ? new URL(p.url).hostname : "local"}</span>
              </a>
            )}
            <div className="copy-hint">Click to Copy</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ width: "340px", padding: "16px", fontFamily: "'Inter', sans-serif", backgroundColor: isDarkMode ? "#121212" : "#fff", color: isDarkMode ? "#fff" : "#333", minHeight: "550px", transition: "all 0.3s ease" }}>
      <style>{`
        @keyframes glow-animation { 0% { border-color: #f0f0f0; } 30% { border-color: #ff00ea; } 60% { border-color: #00d2ff; } 100% { border-color: #f0f0f0; } }
        @keyframes blink-animation { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
        .glow-item { animation: glow-animation 1s ease forwards; }
        .blink-text { animation: blink-animation 0.5s ease infinite; font-weight: bold; color: #1890ff; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; min-height: 45px; }
        .tag-btn { padding: 6px 12px; font-size: 11px; border-radius: 20px; border: 1px solid #eee; cursor: pointer; transition: all 0.2s; white-space: nowrap; font-weight: 700; }
        .copy-hint { position: absolute; right: 12px; bottom: 8px; font-size: 10px; color: #1890ff; opacity: 0; transition: opacity 0.2s; }
        .prompt-item:hover .copy-hint { opacity: 1; }
        .source-layer { position: absolute; bottom: 0; left: 0; width: 100%; height: 28px; background: rgba(0, 0, 0, 0.75); color: #fff; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 11px; transform: translateY(100%); transition: transform 0.3s; z-index: 20; text-decoration: none; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; }
        .prompt-item:hover .source-layer { transform: translateY(0); }
        .prompt-item:hover .corner-badge { opacity: 1 !important; }
        .tag-filter-container::-webkit-scrollbar { display: none; }
        .arrow-icon { font-size: 10px; color: #1890ff; transition: transform 0.3s; margin-left: 6px; }
        .arrow-right { transform: rotate(-90deg); }
        .scroll-area { overflow-y: auto; padding-right: 4px; }
        .scroll-area::-webkit-scrollbar { width: 4px; }
        .scroll-area::-webkit-scrollbar-thumb { background: #eee; border-radius: 10px; }
        .apple-switch { position: relative; display: inline-block; width: 40px; height: 22px; }
        .apple-switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background-color: #34C759; }
        input:checked + .slider:before { transform: translateX(18px); }
        .section-header { display: flex; align-items: center; cursor: pointer; user-select: none; margin-bottom: 10px; padding: 0 4px; }
        .resizer-bar { height: 10px; width: 100%; cursor: row-resize; background: transparent; display: flex; align-items: center; justify-content: center; margin: 2px 0; }
        .resizer-bar::after { content: ""; width: 40px; height: 3px; background: #ddd; border-radius: 4px; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800" }}>Inzlo</h2>
          {!showSettings && <div style={{ fontSize: "10px", color: "#1890ff", fontWeight: "700" }}>Context: {currentContext}</div>}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {selectedIds.size > 0 ? (
            <>
              <button onClick={() => setSelectedIds(new Set())} style={{ backgroundColor: "transparent", color: "#999", border: "1px solid #ddd", borderRadius: "20px", padding: "4px 10px", fontSize: "11px", cursor: "pointer" }}>Cancel</button>
              <button onClick={deleteSelected} style={{ backgroundColor: "#ff4d4f", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", cursor: "pointer" }}>Delete ({selectedIds.size})</button>
            </>
          ) : (
            <>
              {!showSettings && <button onClick={handleClearAll} style={{ backgroundColor: "transparent", border: "1px solid #ddd", color: "#999", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", cursor: "pointer" }}>Clear All</button>}
              <div onClick={() => setShowSettings(!showSettings)} style={{ cursor: "pointer", fontSize: "18px", padding: "4px" }}>{showSettings ? "✕" : "⚙️"}</div>
            </>
          )}
        </div>
      </div>

      {showSettings ? (
        <div style={{ animation: "fadeIn 0.3s" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "20px" }}>Settings</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", backgroundColor: isDarkMode ? "#1a1a1a" : "#fafafa", borderRadius: "10px" }}>
              <span style={{ fontSize: "13px", fontWeight: "600" }}>Dark Mode</span>
              <label className="apple-switch"><input type="checkbox" checked={isDarkMode} onChange={(e) => toggleDarkMode(e.target.checked)} /><span className="slider"></span></label>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", backgroundColor: isDarkMode ? "#1a1a1a" : "#fafafa", borderRadius: "10px" }}>
              <span style={{ fontSize: "13px", fontWeight: "600" }}>Show Suggestions</span>
              <label className="apple-switch"><input type="checkbox" checked={isSuggestEnabled} onChange={(e) => toggleSuggest(e.target.checked)} /><span className="slider"></span></label>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", backgroundColor: isDarkMode ? "#1a1a1a" : "#fafafa", borderRadius: "10px" }}>
              <span style={{ fontSize: "13px", fontWeight: "600" }}>Only on AI/Email Sites</span>
              <label className="apple-switch"><input type="checkbox" checked={isTaggedOnly} onChange={(e) => toggleTaggedOnly(e.target.checked)} /><span className="slider"></span></label>
            </div>
            <div style={{ padding: "14px", backgroundColor: isDarkMode ? "#1a1a1a" : "#fafafa", borderRadius: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}><span style={{ fontSize: "13px", fontWeight: "600" }}>Suggestion Duration</span><span style={{ fontSize: "13px", fontWeight: "700", color: "#1890ff" }}>{suggestDuration}s</span></div>
              <input type="range" min="1" max="60" value={suggestDuration} onChange={(e) => handleDurationChange(parseInt(e.target.value))} style={{ width: "100%", cursor: "pointer", accentColor: "#1890ff" }} />
            </div>
          </div>
        </div>
      ) : (
        <div style={{ height: "460px", display: "flex", flexDirection: "column" }}>
          <div style={{ marginBottom: "16px" }}>
            <input type="text" placeholder={`Search in ${selectedTag}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", fontSize: "13px", outline: "none", border: isDarkMode ? "1px solid #333" : "1px solid #ddd", backgroundColor: isDarkMode ? "#1a1a1a" : "#fff", color: isDarkMode ? "#fff" : "#333", marginBottom: "10px" }} />
            <div className="tag-filter-container" style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
              {dynamicTags.map(t => (
                <button key={t} onClick={() => handleTagClick(t)} onContextMenu={(e) => handleContextMenu(e, t)} className="tag-btn" style={{ backgroundColor: selectedTag === t ? "#1890ff" : (isDarkMode ? "#1a1a1a" : "#fff"), color: selectedTag === t ? "#fff" : (isDarkMode ? "#ccc" : "#666"), borderColor: selectedTag === t ? "#1890ff" : (isDarkMode ? "#333" : "#eee") }}>{t}</button>
              ))}
            </div>
          </div>
          {loading ? <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>Loading...</div> : prompts.length === 0 ? <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>No insights yet!</div> : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "5px", minHeight: 0 }}>
              {(recommendedItems.length > 0 || currentContext !== "ALL") && (
                <div style={{ display: "flex", flexDirection: "column", flex: recExpanded ? (othersExpanded ? "none" : 1) : "none", height: recExpanded && othersExpanded ? `${recHeight}px` : "auto", minHeight: recExpanded ? "80px" : "auto" }}>
                  <div className="section-header" onClick={() => { setRecExpanded(!recExpanded); playCheckSound(); }}><div style={{ fontSize: "11px", fontWeight: "800", color: "#1890ff", textTransform: "uppercase" }}>Recommended for {currentContext}</div><span className={`arrow-icon ${recExpanded ? 'arrow-down' : 'arrow-right'}`}>▼</span></div>
                  {recExpanded && <div className="scroll-area" style={{ flex: 1 }}>{recommendedItems.map(p => renderPromptItem(p))}</div>}
                </div>
              )}
              {recExpanded && othersExpanded && recommendedItems.length > 0 && otherItems.length > 0 && <div className="resizer-bar" onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }} />}
              {otherItems.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: othersExpanded ? "100px" : "auto" }}>
                  <div className="section-header" onClick={() => { setOthersExpanded(!othersExpanded); playCheckSound(); }}><div style={{ fontSize: "11px", fontWeight: "800", color: "#999", textTransform: "uppercase" }}>Other Items</div><span className={`arrow-icon ${othersExpanded ? 'arrow-down' : 'arrow-right'}`}>▼</span></div>
                  {othersExpanded && <div className="scroll-area" style={{ flex: 1 }}>{otherItems.map(p => renderPromptItem(p))}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {contextMenu && (
        <div style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, backgroundColor: isDarkMode ? "#262626" : "#fff", border: `1px solid ${isDarkMode ? "#444" : "#eee"}`, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", borderRadius: "8px", zIndex: 9999, padding: "2px", minWidth: "90px", animation: "fadeIn 0.1s ease" }} onClick={(e) => e.stopPropagation()}>
          <div onClick={() => handleDeleteTag(contextMenu.tag)} onMouseOver={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? "#333" : "#fff1f0"} onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"} style={{ padding: "6px 10px", fontSize: "11px", color: "#ff4d4f", cursor: "pointer", borderRadius: "6px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>🗑️</span> Delete
          </div>
        </div>
      )}
    </div>
  )
}