import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

const PANEL_ID = "inzlo-suggestion-panel"
const CAPTURE_BTN_ID = "inzlo-capture-btn"

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

  // 🧠 우선순위 필터링 (개수 제한 해제)
  const siteSpecific = prompts.filter(p => p.url && getDomain(p.url) === currentDomain)
  const contextSpecific = prompts.filter(p => 
    (p.tag || "").toLowerCase() === context.toLowerCase() && 
    !siteSpecific.find(s => s.id === p.id)
  )

  const filtered = [...siteSpecific, ...contextSpecific] // 모든 항목 포함

  if (filtered.length === 0) return

  const bgColor = isDarkMode ? "#1a1a1a" : "#ffffff"
  const textColor = isDarkMode ? "#ffffff" : "#333333"
  const itemBg = isDarkMode ? "#262626" : "#fafafa"
  const borderColor = isDarkMode ? "#333" : "#f0f0f0"
  const headerSubColor = isDarkMode ? "#333" : "#e6f7ff"

  const panel = document.createElement("div")
  panel.id = PANEL_ID
  panel.style.cssText = `
    position: fixed; top: 25px; right: 25px; width: 280px; 
    max-height: 450px; background: ${bgColor}; color: ${textColor};
    border-radius: 16px; box-shadow: 0 15px 35px rgba(0,0,0,${isDarkMode ? '0.4' : '0.2'}); 
    z-index: 2147483646; padding: 18px; 
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    border: 1px solid ${isDarkMode ? "#333" : "rgba(0,0,0,0.05)"}; 
    animation: inzloFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    transition: opacity 0.5s ease;
    display: flex; flex-direction: column;
  `

  let hideTimer: any = null
  const startTimer = () => {
    hideTimer = setTimeout(() => {
      panel.style.opacity = "0"
      setTimeout(() => panel.remove(), 500)
    }, duration * 1000)
  }
  const stopTimer = () => clearTimeout(hideTimer)

  panel.addEventListener("mouseenter", stopTimer)
  panel.addEventListener("mouseleave", startTimer)
  startTimer()

  const styleSheet = document.createElement("style")
  styleSheet.textContent = `
    @keyframes inzloFadeIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
    .inzlo-item:hover { background: ${isDarkMode ? "#333" : "#f0f7ff"} !important; border-color: #1890ff !important; transform: translateY(-1px); }
    .inzlo-item:active { transform: scale(0.98); }
    .inzlo-close:hover { background: ${isDarkMode ? "#333" : "#fff1f0"}; color: #ff4d4f !important; }
    
    #inzlo-list::-webkit-scrollbar { width: 4px; }
    #inzlo-list::-webkit-scrollbar-track { background: transparent; }
    #inzlo-list::-webkit-scrollbar-thumb { background: ${isDarkMode ? "#444" : "#ddd"}; border-radius: 10px; }
    #inzlo-list::-webkit-scrollbar-thumb:hover { background: #1890ff; }

    .inzlo-custom-input::placeholder { color: rgba(255,255,255,0.5) !important; }
  `
  document.head.appendChild(styleSheet)

  const header = document.createElement("div")
  header.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-shrink: 0;"
  header.innerHTML = `
    <div>
      <div style="font-weight: 900; font-size: 14px; color: #1890ff; display: flex; align-items: center; gap: 4px;">
        <span>Inzlo Suggest</span>
        <span style="font-size: 10px; background: ${headerSubColor}; color: ${isDarkMode ? "#aaa" : "#1890ff"}; padding: 2px 6px; border-radius: 4px;">${context}</span>
      </div>
    </div>
    <div class="inzlo-close" style="cursor: pointer; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #999; font-size: 18px; transition: all 0.2s;">×</div>
  `
  header.querySelector(".inzlo-close").addEventListener("click", () => panel.remove())
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

    const contentDiv = document.createElement("div")
    contentDiv.innerText = p.content
    item.appendChild(contentDiv)

    item.addEventListener("click", () => {
      navigator.clipboard.writeText(p.content)
      const originalText = contentDiv.innerText
      item.style.borderColor = "#34C759"
      contentDiv.innerText = "✅ Copied!"
      setTimeout(() => { contentDiv.innerText = originalText; item.style.borderColor = isSiteSpecific ? '#1890ff' : borderColor; }, 1500)
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
        box-shadow: 0 8px 20px rgba(24,144,255,0.4);
        display: flex; align-items: center; justify-content: center;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        border: 2.5px solid white; white-space: nowrap; overflow: hidden;
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
  btn.style.background = "#000" // 👈 배경색 블랙으로 변경
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
  input.style.cssText = "width: 75px; background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.5); color: #fff; font-size: 11px; outline: none; padding: 2px 4px;"
  // 👈 입력창 글씨색 화이트로 변경
  
  // 플레이스홀더 색상 조절을 위한 클래스 추가 (선택사항)
  input.className = "inzlo-custom-input"
  
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

// ⚡ 설정 변경 실시간 감시 및 반영
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    const keys = Object.keys(changes)
    // 인즐로 관련 설정이 하나라도 바뀌면 즉시 init 실행
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