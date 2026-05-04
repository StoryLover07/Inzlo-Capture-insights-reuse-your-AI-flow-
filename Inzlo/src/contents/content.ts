export const config = {
  matches: ["<all_urls>"]
}

export {}

console.log("🔥 content script loaded")

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
  saveButton.style.pointerEvents = "auto"

  saveButton.addEventListener("click", (e) => {
    e.stopPropagation()
    e.preventDefault()

    console.log("🔥 BUTTON CLICKED")
    alert("clicked")

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