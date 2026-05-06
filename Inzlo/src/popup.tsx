import { useEffect, useState } from "react"

type Prompt = {
  id: string
  content: string
  tag?: string
  source?: string
  url?: string
  title?: string
  createdAt: number
}

export default function Popup() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTag, setSelectedTag] = useState("All")
  const [currentContext, setCurrentContext] = useState("ALL")
  const [currentUrl, setCurrentUrl] = useState("")
  const [showSettings, setShowSettings] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isSuggestEnabled, setIsSuggestEnabled] = useState(true)
  const [suggestDuration, setSuggestDuration] = useState(10)
  const [isTaggedOnly, setIsTaggedOnly] = useState(false)
  const [recExpanded, setRecExpanded] = useState(true)
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, tag: string } | null>(null)
  const [othersExpanded, setOthersExpanded] = useState(true)
  const [recHeight, setRecHeight] = useState(200)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    loadData()
    detectContext()
    loadSettings()
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      setRecHeight(Math.max(50, Math.min(400, e.clientY - 150)))
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
  }

  const toggleSuggest = (val: boolean) => {
    setIsSuggestEnabled(val)
    chrome.storage.local.set({ inzlo_suggest_enabled: val })
  }

  const toggleTaggedOnly = (val: boolean) => {
    setIsTaggedOnly(val)
    chrome.storage.local.set({ inzlo_suggest_tagged_only: val })
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

  const TRASH_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2544/2544-preview.mp3"
  const CHECK_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3"

  const playDeleteSound = () => { new Audio(TRASH_SOUND_URL).play().catch(() => {}) }
  const playCheckSound = () => { new Audio(CHECK_SOUND_URL).play().catch(() => {}) }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    playCheckSound()
  }

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) newSelected.delete(id)
    else newSelected.add(id)
    setSelectedIds(newSelected)
  }

  const deleteSelected = () => {
    if (selectedIds.size === 0) return
    if (confirm(`Delete ${selectedIds.size} items?`)) {
      const updated = prompts.filter((p) => !selectedIds.has(p.id))
      chrome.storage.local.set({ inzlo_prompts: updated }, () => {
        setPrompts(updated)
        setSelectedIds(new Set())
        playDeleteSound()
      })
    }
  }

  const getDomain = (u: string) => { try { return new URL(u).hostname.replace("www.", "") } catch(e) { return "" } }

  const baseFiltered = prompts.filter(p => {
    const matchesTag = selectedTag === "All" || (p.tag || "General").toLowerCase() === selectedTag.toLowerCase()
    const matchesSearch = p.content.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesTag && matchesSearch
  })
  
  const activeDomain = getDomain(currentUrl)
  const recommendedItems = (() => {
    const siteSpecific = baseFiltered.filter(p => p.url && getDomain(p.url) === activeDomain)
    const contextSpecific = baseFiltered.filter(p => {
      const tag = (p.tag || "General").toLowerCase()
      const isCtx = (currentContext === "AI" && tag === "ai") || (currentContext === "Email" && tag === "email")
      return isCtx && !siteSpecific.find(s => s.id === p.id)
    })
    return [...siteSpecific, ...contextSpecific]
  })()
  const otherItems = baseFiltered.filter(p => !recommendedItems.find(r => r.id === p.id))

  const defaultTags = ["All", "General", "AI", "Email", "Code"]
  const dynamicTags = [...defaultTags, ...Array.from(new Set(prompts.map(p => p.tag).filter(t => t && !defaultTags.includes(t))))]

  const handleDeleteTag = (tag: string) => {
    if (confirm(`Delete all in "${tag}"?`)) {
      const updated = prompts.filter(p => p.tag !== tag)
      chrome.storage.local.set({ inzlo_prompts: updated }, () => {
        setPrompts(updated)
        setSelectedTag("All")
        setContextMenu(null)
      })
    }
  }

  return (
    <div style={{ 
      width: "360px", padding: "20px", fontFamily: "'Inter', sans-serif", 
      backgroundColor: isDarkMode ? "#0f0f0f" : "#fcfcfc", color: isDarkMode ? "#eee" : "#222", 
      minHeight: "580px", display: "flex", flexDirection: "column"
    }}>
      <style>{`
        * { box-sizing: border-box; outline: none !important; border: none !important; } /* 👈 테두리 절대 금지 */
        .tag-btn { padding: 6px 12px; font-size: 11px; border-radius: 8px; cursor: pointer; transition: 0.2s; font-weight: 700; background: ${isDarkMode ? "#1a1a1a" : "#eee"}; color: ${isDarkMode ? "#888" : "#666"}; }
        .tag-btn.active { background: #1890ff; color: #fff; }
        .prompt-item { padding: 16px; border-radius: 12px; margin-bottom: 12px; cursor: pointer; transition: 0.2s; background: ${isDarkMode ? "#181818" : "#fff"}; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .prompt-item.selected { background: ${isDarkMode ? "#223344" : "#e6f7ff"}; }
        .tag-filter-container::-webkit-scrollbar { display: none; }
        .scroll-area::-webkit-scrollbar { width: 3px; }
        .scroll-area::-webkit-scrollbar-thumb { background: #ddd; border-radius: 10px; }
        .apple-switch { position: relative; width: 40px; height: 22px; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #ccc; border-radius: 34px; transition: .4s; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 2px; bottom: 2px; background: white; border-radius: 50%; transition: .4s; }
        input:checked + .slider { background: #34C759; }
        input:checked + .slider:before { transform: translateX(18px); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "900", letterSpacing: "-1px" }}>Inzlo</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div onClick={() => setShowSettings(!showSettings)} style={{ cursor: "pointer", fontSize: "18px" }}>{showSettings ? "✕" : "⚙️"}</div>
        </div>
      </div>

      {showSettings ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: isDarkMode ? "#1a1a1a" : "#fff", borderRadius: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600" }}>Dark Mode</span>
            <label className="apple-switch"><input type="checkbox" checked={isDarkMode} onChange={(e) => toggleDarkMode(e.target.checked)} /><span className="slider"></span></label>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: isDarkMode ? "#1a1a1a" : "#fff", borderRadius: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600" }}>Show Suggestions</span>
            <label className="apple-switch"><input type="checkbox" checked={isSuggestEnabled} onChange={(e) => toggleSuggest(e.target.checked)} /><span className="slider"></span></label>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
            <div style={{ display: "flex", background: isDarkMode ? "#1a1a1a" : "#f0f0f0", borderRadius: "10px", padding: "2px" }}>
              <input type="text" placeholder="Search insights..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
                style={{ flex: 1, padding: "10px 14px", background: "transparent", fontSize: "13px" }} />
            </div>
            <div className="tag-filter-container" style={{ display: "flex", gap: "6px", overflowX: "auto" }}>
              {dynamicTags.map(t => (
                <div key={t} onClick={() => { setSelectedTag(t); setContextMenu(null); }} onContextMenu={(e) => { if (!defaultTags.includes(t)) { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, tag: t }); } }} 
                  className={`tag-btn ${selectedTag === t ? 'active' : ''}`}>{t}</div>
              ))}
            </div>
          </div>

          <div className="scroll-area" style={{ flex: 1, overflowY: "auto" }}>
            {loading ? <div style={{ textAlign: "center", padding: "40px" }}>Loading...</div> : (
              <>
                <div style={{ fontSize: "11px", fontWeight: "800", color: "#1890ff", marginBottom: "12px" }}>RECOMMENDED</div>
                {recommendedItems.map(p => (
                  <div key={p.id} onClick={() => handleCopy(p.id, p.content)} className={`prompt-item ${selectedIds.has(p.id) ? 'selected' : ''}`}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontSize: "10px", fontWeight: "900", color: "#1890ff" }}>[{p.tag}]</span>
                      <div onClick={(e) => toggleSelect(p.id, e)} style={{ width: "14px", height: "14px", borderRadius: "4px", background: selectedIds.has(p.id) ? "#1890ff" : "#ddd" }} />
                    </div>
                    <div style={{ fontSize: "13px", lineHeight: "1.5" }}>{p.content}</div>
                  </div>
                ))}
                <div style={{ fontSize: "11px", fontWeight: "800", color: "#888", margin: "20px 0 12px" }}>OTHERS</div>
                {otherItems.map(p => (
                  <div key={p.id} onClick={() => handleCopy(p.id, p.content)} className="prompt-item">
                     <div style={{ fontSize: "10px", fontWeight: "900", color: "#888", marginBottom: "6px" }}>[{p.tag}]</div>
                     <div style={{ fontSize: "13px", lineHeight: "1.5" }}>{p.content}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {contextMenu && (
        <div style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, background: isDarkMode ? "#222" : "#fff", boxShadow: "0 8px 24px rgba(0,0,0,0.2)", borderRadius: "8px", zIndex: 10000, padding: "4px" }}>
          <div onClick={() => handleDeleteTag(contextMenu.tag)} style={{ padding: "8px 16px", color: "#ff4d4f", fontSize: "12px", cursor: "pointer", fontWeight: "700" }}>Delete Tag</div>
        </div>
      )}
    </div>
  )
}