import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

const PANEL_ID = "inzlo-suggestion-panel"
const CAPTURE_BTN_ID = "inzlo-capture-btn"

// --- 🎯 Context & Suggestion Panel Logic ---

const detectContext = (url: string) => {
  const lowUrl = url.toLowerCase()
  if (lowUrl.includes("chatgpt.com") || lowUrl.includes("chat.openai.com") || lowUrl.includes("gemini.google.com") || lowUrl.includes("claude.ai")) return "AI"
  if (lowUrl.includes("mail.google.com")) return "Email"
  return "General"
}

const createSuggestionPanel = (prompts: any[], context: string, isDarkMode: boolean, duration: number) => {
  const existing = document.getElementById(PANEL_ID)
  if (existing) existing.remove()

  const filtered = prompts.filter(p => (p.tag || "").toLowerCase() === context.toLowerCase()).slice(0, 3)
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
    background: ${bgColor}; color: ${textColor};
    border-radius: 16px; box-shadow: 0 15px 35px rgba(0,0,0,${isDarkMode ? '0.4' : '0.2'}); 
    z-index: 2147483646; padding: 18px; 
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    border: 1px solid ${isDarkMode ? "#333" : "rgba(0,0,0,0.05)"}; 
    animation: inzloFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    transition: opacity 0.5s ease;
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
  `
  document.head.appendChild(styleSheet)

  const header = document.createElement("div")
  header.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;"
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
  filtered.forEach(p => {
    const item = document.createElement("div")
    item.className = "inzlo-item"
    item.style.cssText = `padding: 12px; margin-bottom: 8px; background: ${itemBg}; border-radius: 10px; font-size: 12px; color: ${isDarkMode ? "#ccc" : "#444"}; cursor: copy; transition: all 0.2s; border: 1px solid ${borderColor}; line-height: 1.5; position: relative; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;`
    item.innerText = p.content
    item.addEventListener("click", () => {
      navigator.clipboard.writeText(p.content)
      const originalText = item.innerText
      item.style.borderColor = "#34C759"
      item.innerText = "✅ Copied!"
      setTimeout(() => { item.innerText = originalText; item.style.borderColor = borderColor; }, 1500)
    })
    list.appendChild(item)
  })
  panel.appendChild(list)
  document.body.appendChild(panel)
}

// --- ✂️ Selection & Dynamic Tag Bar Logic ---

const handleMouseUp = (e: MouseEvent) => {
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
  
  const container = document.createElement("div")
  container.style.cssText = "display: flex; align-items: center; gap: 6px; padding: 0 4px;"
  
  const tags = [context, "General", "Email", "Code"]
  const uniqueTags = [...new Set(tags)]

  uniqueTags.forEach(tag => {
    const chip = document.createElement("div")
    chip.innerText = tag
    chip.style.cssText = "padding: 4px 10px; background: rgba(255,255,255,0.2); border-radius: 12px; font-size: 11px; cursor: pointer; transition: all 0.2s;"
    chip.onmouseover = () => chip.style.background = "rgba(255,255,255,0.4)"
    chip.onmouseout = () => chip.style.background = "rgba(255,255,255,0.2)"
    chip.onclick = (e) => {
      e.stopPropagation()
      savePrompt(text, tag)
      showSavedFeedback(btn)
    }
    container.appendChild(chip)
  })

  const input = document.createElement("input")
  input.placeholder = "+ Custom"
  input.style.cssText = "width: 70px; background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.5); color: white; font-size: 11px; outline: none; padding: 2px 4px;"
  input.onclick = (e) => e.stopPropagation()
  input.onkeydown = (e) => {
    if (e.key === "Enter" && input.value.trim()) {
      savePrompt(text, input.value.trim())
      showSavedFeedback(btn)
    }
  }
  container.appendChild(input)

  btn.appendChild(container)
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
      init() // 패널 즉시 갱신
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
init()

let lastUrl = window.location.href
setInterval(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href
    init()
  }
}, 1000)