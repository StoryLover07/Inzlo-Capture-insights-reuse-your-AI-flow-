import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

const PANEL_ID = "inzlo-suggestion-panel"
const CAPTURE_BTN_ID = "inzlo-capture-btn"

// --- 🎯 Context & Suggestion Panel Logic ---

const detectContext = (url: string) => {
  if (url.includes("chatgpt.com") || url.includes("chat.openai.com") || url.includes("gemini.google.com") || url.includes("claude.ai")) {
    return "AI"
  }
  if (url.includes("mail.google.com")) {
    return "Email"
  }
  return null
}

const createSuggestionPanel = (prompts: any[], context: string) => {
  if (document.getElementById(PANEL_ID)) return

  const filtered = prompts.filter(p => (p.tag || "").toLowerCase() === context.toLowerCase()).slice(0, 3)
  if (filtered.length === 0) return

  const panel = document.createElement("div")
  panel.id = PANEL_ID
  panel.style.cssText = `
    position: fixed; top: 20px; right: 20px; width: 260px; background: white;
    border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); z-index: 999999;
    padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    border: 1px solid #eee; animation: inzloFadeIn 0.3s ease;
  `

  const styleSheet = document.createElement("style")
  styleSheet.textContent = `
    @keyframes inzloFadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
    .inzlo-item:hover { background: #f0f7ff !important; color: #1890ff !important; }
    .inzlo-close:hover { color: #ff4d4f !important; transform: scale(1.1); }
  `
  document.head.appendChild(styleSheet)

  const header = document.createElement("div")
  header.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;"
  header.innerHTML = `
    <span style="font-weight: 800; font-size: 13px; color: #333;">💡 Suggested Prompts</span>
    <span class="inzlo-close" style="cursor: pointer; font-size: 18px; color: #ccc; transition: all 0.2s;">×</span>
  `
  header.querySelector(".inzlo-close").addEventListener("click", () => panel.remove())
  panel.appendChild(header)

  const list = document.createElement("div")
  filtered.forEach(p => {
    const item = document.createElement("div")
    item.className = "inzlo-item"
    item.style.cssText = "padding: 10px; margin-bottom: 6px; background: #fafafa; border-radius: 8px; font-size: 12px; color: #666; cursor: copy; transition: all 0.2s; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; border: 1px solid #f0f0f0;"
    item.innerText = p.content
    item.addEventListener("click", () => {
      navigator.clipboard.writeText(p.content)
      const originalText = item.innerText
      item.innerText = "✅ Copied!"
      setTimeout(() => { item.innerText = originalText }, 1000)
    })
    list.appendChild(item)
  })
  panel.appendChild(list)
  document.body.appendChild(panel)
}

// --- ✂️ Selection & Capture Logic ---

const handleMouseUp = (e: MouseEvent) => {
  const selection = window.getSelection()
  const text = selection?.toString().trim()

  // 기존 버튼 제거
  const oldBtn = document.getElementById(CAPTURE_BTN_ID)
  if (oldBtn) oldBtn.remove()

  if (text && text.length > 0) {
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    const btn = document.createElement("div")
    btn.id = CAPTURE_BTN_ID
    btn.innerText = "Inzlo"
    btn.style.cssText = `
      position: fixed;
      top: ${rect.top + window.scrollY - 35}px;
      left: ${rect.left + window.scrollX + rect.width / 2 - 25}px;
      padding: 6px 12px;
      background: #1890ff;
      color: white;
      font-size: 12px;
      font-weight: bold;
      border-radius: 20px;
      cursor: pointer;
      z-index: 1000000;
      box-shadow: 0 4px 12px rgba(24,144,255,0.3);
      animation: inzloFadeIn 0.2s ease;
    `

    btn.onclick = (event) => {
      event.stopPropagation()
      savePrompt(text)
      btn.innerText = "✅ Saved!"
      setTimeout(() => btn.remove(), 1000)
    }
    document.body.appendChild(btn)
  }
}

const savePrompt = (content: string) => {
  const context = detectContext(window.location.href) || "General"
  chrome.storage.local.get(["inzlo_prompts"], (res) => {
    const list = res.inzlo_prompts || []
    const newItem = {
      id: Date.now().toString(),
      content,
      tag: context,
      source: "Inzlo Capture",
      url: window.location.href
    }
    chrome.storage.local.set({ inzlo_prompts: [newItem, ...list] })
  })
}

// --- 🚀 Initialize ---

const init = () => {
  const context = detectContext(window.location.href)
  chrome.storage.local.get(["inzlo_prompts"], (res) => {
    const prompts = res.inzlo_prompts || []
    if (context) createSuggestionPanel(prompts, context)
  })
}

document.addEventListener("mouseup", handleMouseUp)
document.addEventListener("mousedown", (e) => {
  const btn = document.getElementById(CAPTURE_BTN_ID)
  if (btn && !btn.contains(e.target as Node)) {
    btn.remove()
  }
})

init()

let lastUrl = window.location.href
new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href
    init()
  }
}).observe(document, { subtree: true, childList: true })