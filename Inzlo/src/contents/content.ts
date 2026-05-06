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

      const newItem = {
        id: Date.now().toString(),
        content: selectedText,
        createdAt: Date.now()
      }

      const updated = [...prompts, newItem]

      // 👉 저장
      chrome.storage.local.set({ inzlo_prompts: updated }, () => {
        console.log("Saved successfully:", selectedText)
        
        // 👉 효과음 재생
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3")
        audio.volume = 0.5
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