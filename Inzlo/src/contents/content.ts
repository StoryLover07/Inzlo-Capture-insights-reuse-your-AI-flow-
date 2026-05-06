export const config = {
  matches: ["<all_urls>"]
}

export {}

let saveButton: HTMLButtonElement | null = null
let selectedText = ""

document.addEventListener("mouseup", (e: MouseEvent) => {
  setTimeout(() => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()

    if (!text) {
      removeButton()
      return
    }

    selectedText = text
    showButton(e.pageX, e.pageY)
  }, 0)
})

function showButton(x: number, y: number) {
  removeButton()

  saveButton = document.createElement("button")
  saveButton.innerText = "Save"

  saveButton.style.position = "fixed"
  saveButton.style.zIndex = "999999999"
  saveButton.style.top = `${y + 10}px`
  saveButton.style.left = `${x + 10}px`
  saveButton.style.padding = "6px 10px"
  saveButton.style.background = "#000"
  saveButton.style.color = "#fff"
  saveButton.style.cursor = "pointer"

  saveButton.addEventListener("click", (e) => {
    e.stopPropagation()
    e.preventDefault()

    // 👉 storage 불러오기
    chrome.storage.local.get(["inzlo_prompts"], (result) => {
      let prompts = result.inzlo_prompts || []

      // 👉 중복 방지
      if (prompts.some((p: any) => p.content === selectedText)) {
        console.log("Already saved")
        removeButton()
        return
      }

      // 👉 태그 입력 받기
      const userTag = prompt("Enter tag (AI / Email / Code):", "General") || "General"

      // 👉 출처 정보 수집
      const url = window.location.href
      const title = document.title
      let source = "Web"

      if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) {
        source = "ChatGPT"
      } else if (url.includes("claude.ai")) {
        source = "Claude"
      } else if (url.includes("gemini.google.com")) {
        source = "Gemini"
      }

      const newItem = {
        id: Date.now().toString(),
        content: selectedText,
        tag: userTag,
        source: source, // 👈 출처 추가
        url: url,       // 👈 URL 추가
        title: title,   // 👈 제목 추가
        createdAt: Date.now()
      }

      const updated = [...prompts, newItem]

      // 👉 저장
      chrome.storage.local.set({ inzlo_prompts: updated }, () => {
        console.log("Saved successfully:", selectedText)
        
        // 👉 효과음 재생 (세련된 Chime 소리)
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3")
        audio.volume = 0.4
        audio.play().catch(() => {})

        removeButton()
      })
    })

    removeButton()
  })

  document.body.appendChild(saveButton)
}

function removeButton() {
  if (saveButton) {
    saveButton.remove()
    saveButton = null
  }
}