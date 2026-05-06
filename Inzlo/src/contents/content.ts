import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://chatgpt.com/*", "https://chat.openai.com/*", "https://mail.google.com/*", "https://gemini.google.com/*", "https://claude.ai/*"]
}

const PANEL_ID = "inzlo-suggestion-panel"

const detectContext = (url: string) => {
  if (url.includes("chatgpt.com") || url.includes("chat.openai.com") || url.includes("gemini.google.com") || url.includes("claude.ai")) {
    return "AI"
  }
  if (url.includes("mail.google.com")) {
    return "Email"
  }
  return null
}

const createPanel = (prompts: any[], context: string) => {
  if (document.getElementById(PANEL_ID)) return

  const filtered = prompts.filter(p => (p.tag || "").toLowerCase() === context.toLowerCase()).slice(0, 3)
  if (filtered.length === 0) return

  const panel = document.createElement("div")
  panel.id = PANEL_ID
  panel.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 260px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.15);
    z-index: 999999;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    border: 1px solid #eee;
    animation: inzloFadeIn 0.3s ease;
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
    item.style.cssText = `
      padding: 10px;
      margin-bottom: 6px;
      background: #fafafa;
      border-radius: 8px;
      font-size: 12px;
      color: #666;
      cursor: copy;
      transition: all 0.2s;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      border: 1px solid #f0f0f0;
    `
    item.innerText = p.content
    item.title = "Click to copy"
    item.addEventListener("click", () => {
      navigator.clipboard.writeText(p.content)
      const originalText = item.innerText
      item.innerText = "✅ Copied!"
      item.style.color = "#34C759"
      setTimeout(() => {
        item.innerText = originalText
        item.style.color = "#666"
      }, 1000)
    })
    list.appendChild(item)
  })
  panel.appendChild(list)

  const footer = document.createElement("div")
  footer.style.cssText = "font-size: 9px; color: #bbb; text-align: right; margin-top: 8px;"
  footer.innerText = "Powered by Inzlo"
  panel.appendChild(footer)

  document.body.appendChild(panel)
}

const init = () => {
  const context = detectContext(window.location.href)
  if (!context) return

  chrome.storage.local.get(["inzlo_prompts"], (res) => {
    const prompts = res.inzlo_prompts || []
    createPanel(prompts, context)
  })
}

// 초기 로드 시 실행
init()

// URL 변경 감지 (Single Page App 대응)
let lastUrl = window.location.href
new MutationObserver(() => {
  const url = window.location.href
  if (url !== lastUrl) {
    lastUrl = url
    init()
  }
}).observe(document, { subtree: true, childList: true })