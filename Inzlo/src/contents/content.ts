import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

const PANEL_ID = "inzlo-suggestion-panel"
const CAPTURE_BTN_ID = "inzlo-capture-btn"

// --- 🎯 Context & Suggestion Panel Logic ---

const detectContext = (url: string) => {
  const lowUrl = url.toLowerCase()
  if (lowUrl.includes("chatgpt.com") || lowUrl.includes("chat.openai.com") || lowUrl.includes("gemini.google.com") || lowUrl.includes("claude.ai")) {
    return "AI"
  }
  if (lowUrl.includes("mail.google.com")) {
    return "Email"
  }
  return null
}

const createSuggestionPanel = (prompts: any[], context: string) => {
  // 이미 있으면 일단 제거
  const existing = document.getElementById(PANEL_ID)
  if (existing) existing.remove()

  // 🎯 엄격한 필터링: 컨텍스트와 정확히 일치하는 태그만 추출
  const filtered = prompts.filter(p => (p.tag || "").toLowerCase() === context.toLowerCase()).slice(0, 3)

  // 일치하는 항목이 없으면 패널을 띄우지 않음
  if (filtered.length === 0) return

  const panel = document.createElement("div")
  panel.id = PANEL_ID
  panel.style.cssText = `
    position: fixed; top: 25px; right: 25px; width: 280px; background: white;
    border-radius: 16px; box-shadow: 0 15px 35px rgba(0,0,0,0.2); z-index: 2147483646;
    padding: 18px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    border: 1px solid rgba(0,0,0,0.05); animation: inzloFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  `

  const styleSheet = document.createElement("style")
  styleSheet.textContent = `
    @keyframes inzloFadeIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
    .inzlo-item:hover { background: #f0f7ff !important; border-color: #1890ff !important; transform: translateY(-1px); }
    .inzlo-item:active { transform: scale(0.98); }
    .inzlo-close:hover { background: #fff1f0; color: #ff4d4f !important; }
  `
  document.head.appendChild(styleSheet)

  const header = document.createElement("div")
  header.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;"
  header.innerHTML = `
    <div>
      <div style="font-weight: 900; font-size: 14px; color: #1890ff; display: flex; align-items: center; gap: 4px;">
        <span>Inzlo Suggest</span>
        <span style="font-size: 10px; background: #e6f7ff; padding: 2px 6px; border-radius: 4px;">${context}</span>
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
    item.style.cssText = `
      padding: 12px; margin-bottom: 8px; background: #fff; border-radius: 10px;
      font-size: 12px; color: #444; cursor: copy; transition: all 0.2s;
      border: 1px solid #f0f0f0; line-height: 1.5; position: relative;
      overflow: hidden; text-overflow: ellipsis; display: -webkit-box;
      -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    `
    item.innerText = p.content
    item.addEventListener("click", () => {
      navigator.clipboard.writeText(p.content)
      const originalText = item.innerText
      item.style.borderColor = "#34C759"
      item.innerText = "✅ Copied to clipboard!"
      setTimeout(() => { 
        item.innerText = originalText
        item.style.borderColor = "#f0f0f0"
      }, 1500)
    })
    list.appendChild(item)
  })
  panel.appendChild(list)
  document.body.appendChild(panel)
}

// --- ✂️ Selection & Capture Logic ---

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
      btn.innerText = "Inzlo"
      btn.style.cssText = `
        position: absolute; top: ${rect.top + window.scrollY - 45}px;
        left: ${rect.left + window.scrollX + rect.width / 2 - 30}px;
        padding: 8px 16px; background: #1890ff; color: white;
        font-size: 13px; font-weight: 900; border-radius: 24px;
        cursor: pointer; z-index: 2147483647;
        box-shadow: 0 8px 20px rgba(24,144,255,0.4);
        display: flex; align-items: center; justify-content: center;
        animation: inzloFadeIn 0.2s ease; border: 2.5px solid white;
      `

      btn.onmousedown = (event) => event.stopPropagation()
      btn.onclick = (event) => {
        event.preventDefault(); event.stopPropagation()
        savePrompt(text)
        btn.innerText = "✅ Saved!"
        setTimeout(() => btn.remove(), 1000)
      }
      document.body.appendChild(btn)
    } catch (err) {}
  }, 100)
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
    chrome.storage.local.set({ inzlo_prompts: [newItem, ...list] }, () => {
      // 저장 후 패널 즉시 갱신
      init()
    })
  })
}

// --- 🚀 Initialize ---

const init = () => {
  const context = detectContext(window.location.href)
  
  chrome.storage.local.get(["inzlo_prompts", "inzlo_suggest_enabled"], (res) => {
    const isSuggestEnabled = res.inzlo_suggest_enabled !== false // 기본값 true
    const prompts = res.inzlo_prompts || []
    
    if (context && isSuggestEnabled) {
      createSuggestionPanel(prompts, context)
    } else {
      // 꺼져있거나 컨텍스트가 없으면 기존 패널 제거
      const existing = document.getElementById(PANEL_ID)
      if (existing) existing.remove()
    }
  })
}

document.addEventListener("mouseup", handleMouseUp)

// 초기 로드 시점 조절
if (document.readyState === "complete") {
  init()
} else {
  window.addEventListener("load", init)
}

// URL 변경 감지 최적화
let lastUrl = window.location.href
setInterval(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href
    init()
  }
}, 1000)