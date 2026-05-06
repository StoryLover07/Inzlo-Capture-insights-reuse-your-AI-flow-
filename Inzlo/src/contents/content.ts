import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

const PANEL_ID = "inzlo-suggestion-panel"
const CAPTURE_BTN_ID = "inzlo-capture-btn"
const SUCCESS_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3"

// --- 🔊 Sound Logic ---
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
  } catch (e) {
    console.error("Audio failed", e)
  }
}

// --- 🎯 Context & Suggestion Panel Logic ---

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace("www.", "")
  } catch (e) {
    return ""
  }
}

const detectContext = (url: string) => {
  const lowUrl = url.toLowerCase()
  if (lowUrl.includes("chatgpt.com") || lowUrl.includes("chat.openai.com") || lowUrl.includes("gemini.google.com") || lowUrl.includes("claude.ai")) return "AI"
  if (lowUrl.includes("mail.google.com")) return "Email"
  return "General"
}

const createSuggestionPanel = (prompts: any[], context: string, isDarkMode: boolean, duration: number) => {
  const existing = document.getElementById(PANEL_ID)
  if (existing) existing.remove()

  const currentUrl = window.location.href
  const currentDomain = getDomain(currentUrl)
  const defaultTags = ["ai", "email", "code", "general"]

  // 1. 현재 사이트 데이터 추출 및 정렬
  const siteSpecific = prompts.filter(p => p.url && getDomain(p.url) === currentDomain)
    .sort((a, b) => {
      const aTag = (a.tag || "general").toLowerCase()
      const bTag = (b.tag || "general").toLowerCase()
      const ctx = context.toLowerCase()

      // 가중치 계산
      const getWeight = (tag: string) => {
        if (!defaultTags.includes(tag)) return 0 // 1순위: 커스텀 태그 (가장 낮음=최상단)
        if (tag === ctx) return 1               // 2순위: 컨텍스트 태그 (AI/Email/Code)
        if (tag === "general") return 2         // 3순위: General
        return 3                                // 기타 기본 태그
      }
      return getWeight(aTag) - getWeight(bTag)
    })

  // 2. 다른 사이트의 컨텍스트 일치 항목 (차선책)
  const contextSpecific = prompts.filter(p => 
    (p.tag || "").toLowerCase() === context.toLowerCase() && 
    !siteSpecific.find(s => s.id === p.id)
  )

  const filtered = [...siteSpecific, ...contextSpecific]
  if (filtered.length === 0) return

  const bgColor = isDarkMode ? "#1a1a1a" : "#ffffff"
  const textColor = isDarkMode ? "#ffffff" : "#333333"
  const itemBg = isDarkMode ? "#262626" : "#fafafa"
  const borderColor = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"
  const headerSubColor = isDarkMode ? "#333" : "#e6f7ff"

  const panel = document.createElement("div")
  panel.id = PANEL_ID
  panel.style.cssText = `
    position: fixed; top: 80px; right: 20px; width: 340px; 
    max-height: 500px; background: ${bgColor}; color: ${textColor};
    border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.3); 
    z-index: 1000000; padding: 20px; 
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    border: 1px solid ${borderColor}; 
    animation: inzloFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    transition: opacity 0.5s ease;
    display: flex; flex-direction: column;
    box-sizing: border-box;
  `

  let hideTimer: any = null
  const dismissPanel = () => {
    // 👈 마우스가 올라와 있으면 사라지지 않음
    if (panel.matches(':hover')) {
      startTimer()
      return
    }
    panel.style.animation = "inzloSlideOut 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards"
    setTimeout(() => {
      if (!panel.matches(':hover')) panel.remove()
      else {
        panel.style.animation = "inzloFadeIn 0.3s ease forwards" // 복구
        startTimer()
      }
    }, 500)
  }

  const startTimer = () => {
    clearTimeout(hideTimer)
    hideTimer = setTimeout(dismissPanel, duration * 1000)
  }
  const stopTimer = () => {
    clearTimeout(hideTimer)
    panel.style.animation = "none" // 애니메이션 중단
  }

  panel.addEventListener("mouseenter", stopTimer)
  panel.addEventListener("mouseleave", startTimer)
  startTimer()

  const styleSheet = document.createElement("style")
  styleSheet.textContent = `
    @keyframes inzloFadeIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes inzloSlideOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(100px); } }
    @keyframes inzloBlink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
    .inzlo-item:hover { background: ${isDarkMode ? "#333" : "#f0f7ff"} !important; border-color: #1890ff !important; transform: translateY(-1px); }
    .inzlo-item:active { transform: scale(0.98); }
    .inzlo-close:hover { background: ${isDarkMode ? "#333" : "#fff1f0"}; color: #ff4d4f !important; }
    .inzlo-copied-text { animation: inzloBlink 0.5s ease infinite; font-weight: bold; color: #1890ff; text-align: center; width: 100%; }
    
    #inzlo-list::-webkit-scrollbar { width: 4px; }
    #inzlo-list::-webkit-scrollbar-track { background: transparent; }
    #inzlo-list::-webkit-scrollbar-thumb { background: ${isDarkMode ? "#444" : "#ddd"}; border-radius: 10px; }
    #inzlo-list::-webkit-scrollbar-thumb:hover { background: #1890ff; }
    .inzlo-custom-input::placeholder { color: rgba(255,255,255,0.5) !important; }
  `
  document.head.appendChild(styleSheet)

  const header = document.createElement("div")
  header.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-shrink: 0;"
  header.style.cssText = "display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; flex-shrink: 0;"
  header.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div style="font-weight: 900; font-size: 14px; color: #1890ff; display: flex; align-items: center; gap: 4px;">
        <span>Inzlo Suggest</span>
        <span style="font-size: 10px; background: ${headerSubColor}; color: ${isDarkMode ? "#aaa" : "#1890ff"}; padding: 2px 6px; border-radius: 4px;">${context}</span>
      </div>
      <div class="inzlo-close" style="cursor: pointer; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #999; font-size: 18px; transition: all 0.2s;">×</div>
    </div>
    <input type="text" class="inzlo-search" placeholder="Search prompts..." 
      style="width: 100%; padding: 8px 12px; border-radius: 8px; border: none; box-shadow: inset 0 0 0 1px ${isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"};
      background: ${isDarkMode ? "#262626" : "#fff"}; color: ${textColor}; font-size: 13px; outline: none; box-sizing: border-box;"
    >
  `
  header.querySelector(".inzlo-close").addEventListener("click", dismissPanel)
  panel.appendChild(header)

  const list = document.createElement("div")
  list.id = "inzlo-list"
  list.style.cssText = "overflow-y: auto; flex-grow: 1; padding-right: 4px;"
  
  filtered.forEach(p => {
    const isSiteSpecific = p.url && getDomain(p.url) === currentDomain
    const item = document.createElement("div")
    item.className = "inzlo-item"
    item.style.cssText = `padding: 12px; margin-bottom: 8px; background: ${itemBg}; border-radius: 10px; font-size: 12px; color: ${isDarkMode ? "#ccc" : "#444"}; cursor: copy; transition: all 0.2s; border: 1px solid ${isSiteSpecific ? '#1890ff' : borderColor}; line-height: 1.5; position: relative; overflow: hidden;`
    
    if (isSiteSpecific) {
      const badge = document.createElement("div")
      badge.innerText = "Current Site"
      badge.style.cssText = "position: absolute; top: 0; right: 0; font-size: 8px; background: #1890ff; color: white; padding: 2px 6px; border-bottom-left-radius: 8px;"
      item.appendChild(badge)
    }

    const tagDiv = document.createElement("div")
    tagDiv.className = "inzlo-item-tag"
    tagDiv.innerText = `[${(p.tag || "General").toUpperCase()}]`
    tagDiv.style.cssText = `font-size: 10px; font-weight: 900; color: #1890ff; margin-bottom: 4px; display: block; letter-spacing: 0.5px;`
    item.appendChild(tagDiv)

    const contentDiv = document.createElement("div")
    contentDiv.innerText = p.content
    item.appendChild(contentDiv)

    item.addEventListener("click", () => {
      navigator.clipboard.writeText(p.content)
      playCopySound()
      const originalHTML = item.innerHTML
      item.innerHTML = `<div class="inzlo-copied-text">Copied!</div>`
      item.style.borderColor = "#1890ff"
      setTimeout(() => { 
        item.innerHTML = originalHTML
        item.style.borderColor = isSiteSpecific ? '#1890ff' : borderColor
      }, 1000)
    })
    list.appendChild(item)
  })
  panel.appendChild(list)
  document.body.appendChild(panel)
}

// --- ✂️ Selection & Dynamic Tag Bar Logic ---

const handleMouseUp = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (target.closest(`#${CAPTURE_BTN_ID}`)) return

  setTimeout(() => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()

    if (!text || text.length < 2) {
      const existing = document.getElementById(CAPTURE_BTN_ID)
      if (existing) existing.remove()
      return
    }

    const oldBtn = document.getElementById(CAPTURE_BTN_ID)
    if (oldBtn) oldBtn.remove()

    try {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      if (rect.width === 0) return

      const btn = document.createElement("div")
      btn.id = CAPTURE_BTN_ID
      btn.innerHTML = `<span>Inzlo</span>`
      btn.style.cssText = `
        position: absolute; top: ${rect.top + window.scrollY - 45}px;
        left: ${rect.left + window.scrollX + rect.width / 2 - 30}px;
        padding: 8px 16px; background: #1890ff; color: white;
        font-size: 13px; font-weight: 900; border-radius: 24px;
        cursor: pointer; z-index: 2147483647;
        box-shadow: 0 8px 20px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        border: 1px solid rgba(255,255,255,0.8); white-space: nowrap; overflow: hidden;
      `

      btn.onclick = (event) => {
        event.preventDefault(); event.stopPropagation()
        expandToTagBar(btn, text)
      }
      document.body.appendChild(btn)
    } catch (err) {}
  }, 100)
}

const expandToTagBar = (btn: HTMLElement, text: string) => {
  const context = detectContext(window.location.href)
  btn.innerHTML = ""
  btn.style.padding = "6px"
  btn.style.cursor = "default"
  btn.style.background = "#000"
  btn.style.boxShadow = "0 10px 25px rgba(0,0,0,0.5)"
  
  const container = document.createElement("div")
  container.style.cssText = "display: flex; align-items: center; gap: 6px; padding: 0 4px;"
  
  const tags = [context, "General", "Email", "Code"]
  const uniqueTags = [...new Set(tags)]

  uniqueTags.forEach(tag => {
    const chip = document.createElement("div")
    chip.innerText = tag
    chip.style.cssText = "padding: 4px 10px; background: rgba(255,255,255,0.15); border-radius: 12px; font-size: 11px; cursor: pointer; transition: all 0.2s; color: rgba(255,255,255,0.9);"
    chip.onmouseover = () => chip.style.background = "rgba(255,255,255,0.3)"
    chip.onmouseout = () => chip.style.background = "rgba(255,255,255,0.15)"
    chip.onclick = (e) => {
      e.stopPropagation()
      savePrompt(text, tag)
      showSavedFeedback(btn)
    }
    container.appendChild(chip)
  })

  const input = document.createElement("input")
  input.placeholder = "+ Custom"
  input.className = "inzlo-custom-input"
  input.style.cssText = "width: 75px; background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.5); color: #fff; font-size: 11px; outline: none; padding: 2px 4px;"
  input.onmousedown = (e) => e.stopPropagation()
  input.onclick = (e) => e.stopPropagation()
  input.onkeydown = (e) => {
    e.stopPropagation()
    if (e.key === "Enter") {
      e.preventDefault()
      const val = input.value.trim()
      if (val) {
        savePrompt(text, val)
        showSavedFeedback(btn)
      }
    }
  }
  container.appendChild(input)

  btn.appendChild(container)
  setTimeout(() => input.focus(), 300)
}

const showSavedFeedback = (btn: HTMLElement) => {
  btn.innerHTML = `<span style="padding: 4px 12px;">✅ Saved!</span>`
  setTimeout(() => btn.remove(), 1000)
}

const savePrompt = (content: string, tag: string) => {
  chrome.storage.local.get(["inzlo_prompts"], (res) => {
    const list = res.inzlo_prompts || []
    const newItem = {
      id: Date.now().toString(),
      content,
      tag: tag || "General",
      source: "Inzlo Capture",
      url: window.location.href,
      createdAt: Date.now()
    }
    chrome.storage.local.set({ inzlo_prompts: [newItem, ...list] }, () => {
      init()
    })
  })
}

// --- 🚀 Initialize ---

const init = () => {
  const context = detectContext(window.location.href)
  chrome.storage.local.get(["inzlo_prompts", "inzlo_suggest_enabled", "inzlo_darkmode", "inzlo_suggest_duration", "inzlo_suggest_tagged_only"], (res) => {
    const isSuggestEnabled = res.inzlo_suggest_enabled !== false
    const isDarkMode = res.inzlo_darkmode === true
    const duration = res.inzlo_suggest_duration || 10
    const isTaggedOnly = res.inzlo_suggest_tagged_only === true
    const prompts = res.inzlo_prompts || []
    const shouldShow = isSuggestEnabled && context && (!isTaggedOnly || context !== "General")
    if (shouldShow) createSuggestionPanel(prompts, context, isDarkMode, duration)
    else {
      const existing = document.getElementById(PANEL_ID)
      if (existing) existing.remove()
    }
  })
}

document.addEventListener("mouseup", handleMouseUp)
document.addEventListener("mousedown", (e) => {
  const target = e.target as HTMLElement
  if (target.closest(`#${CAPTURE_BTN_ID}`)) return
  const btn = document.getElementById(CAPTURE_BTN_ID)
  if (btn) btn.remove()
})

init()

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    const keys = Object.keys(changes)
    if (keys.some(k => k.startsWith("inzlo_"))) {
      init()
    }
  }
})

let lastUrl = window.location.href
setInterval(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href
    init()
  }
}, 1000)