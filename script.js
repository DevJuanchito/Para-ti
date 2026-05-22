const getEl = el => document.getElementById(el)
const setStyle = (el, prop, val) => el.style[prop] = val
const addClass = (el, className) => el.classList.add(className)
const removeClass = (el, className) => el.classList.remove(className)

const PAPER = getEl('paper')
const LETTERS = getEl('letters')
const CURSOR = getEl('cursor')

let LAST_TYPE_TIMESTAMP = 0
let typeInterval = null

const COLORS = {
  COLOR1: 'rgb(255, 64, 129)',
  COLOR2: 'rgb(194, 24, 91)',
  COLOR3: 'rgb(255, 128, 171)',
  COLOR4: 'rgb(216, 27, 96)',
  COLOR5: 'rgb(240, 98, 146)'
}

const STATE = {
  row: 0,
  col: 0
}

const getTypingConfig = () => {
  const paperWidth = PAPER.clientWidth || window.innerWidth

  let startX = 118
  let startY = 180
  let letterWidth = 10.4
  let letterHeight = 20
  let rightPadding = 55
  let maxRows = 15

  if (paperWidth <= 480) {
    startX = 78
    startY = 180
    letterWidth = 8.7
    rightPadding = 40
    maxRows = 14
  }

  if (paperWidth <= 360) {
    startX = 70
    startY = 180
    letterWidth = 8.2
    rightPadding = 34
    maxRows = 14
  }

  let maxChars = Math.floor((paperWidth - startX - rightPadding) / letterWidth)

  if (paperWidth <= 360) {
    maxChars = Math.min(maxChars, 21)
  } else if (paperWidth <= 480) {
    maxChars = Math.min(maxChars, 23)
  } else {
    maxChars = Math.min(maxChars, 27)
  }

  maxChars = Math.max(maxChars, 16)

  return {
    startX,
    startY,
    letterWidth,
    letterHeight,
    maxChars,
    maxRows
  }
}

const getRandColor = () => {
  const rand = Math.floor((Math.random() * 5) + 1)

  switch (rand) {
    case 1: return COLORS.COLOR1
    case 2: return COLORS.COLOR2
    case 3: return COLORS.COLOR3
    case 4: return COLORS.COLOR4
    case 5: return COLORS.COLOR5
    default: return COLORS.COLOR1
  }
}

const getRandPosOffScreen = () => {
  const lowX1 = 0 - (window.innerWidth * 0.3)
  const highX1 = 0 - (window.innerWidth * 0.2)
  const lowY1 = 0
  const highY1 = window.innerHeight

  const lowX2 = window.innerWidth * 1.2
  const highX2 = window.innerWidth * 1.3
  const lowY2 = 0
  const highY2 = window.innerHeight

  const lowX3 = 0
  const highX3 = window.innerWidth
  const lowY3 = 0 - (window.innerHeight * 0.3)
  const highY3 = 0 - (window.innerHeight * 0.2)

  const lowX4 = 0
  const highX4 = window.innerWidth
  const lowY4 = window.innerHeight * 1.2
  const highY4 = window.innerHeight * 1.3

  const rand = Math.floor((Math.random() * 4) + 1)

  let x = 0
  let y = 0

  switch (rand) {
    case 1:
      x = Math.floor(Math.random() * (highX1 - lowX1 + 1)) + lowX1
      y = Math.floor(Math.random() * (highY1 - lowY1)) + lowY1
      break

    case 2:
      x = Math.floor(Math.random() * (highX2 - lowX2 + 1)) + lowX2
      y = Math.floor(Math.random() * (highY2 - lowY2)) + lowY2
      break

    case 3:
      x = Math.floor(Math.random() * (highX3 - lowX3 + 1)) + lowX3
      y = Math.floor(Math.random() * (highY3 - lowY3)) + lowY3
      break

    case 4:
      x = Math.floor(Math.random() * (highX4 - lowX4 + 1)) + lowX4
      y = Math.floor(Math.random() * (highY4 - lowY4)) + lowY4
      break
  }

  return { x, y }
}

const setLetterPos = (letter, x, y) => {
  setStyle(letter, 'left', x + 'px')
  setStyle(letter, 'top', y + 'px')
}

const setLetterColor = letter => {
  setStyle(letter, 'color', getRandColor())
}

const createLetter = key => {
  const letter = document.createElement('div')
  letter.innerHTML = key === ' ' ? '&nbsp;' : key
  setLetterColor(letter)
  addClass(letter, 'off-screen')
  addClass(letter, 'letter')
  return letter
}

const setInitialLetterPos = letter => {
  const pos = getRandPosOffScreen()
  setLetterPos(letter, pos.x, pos.y)
}

const moveCursor = () => {
  const config = getTypingConfig()
  const x = config.startX + STATE.col * config.letterWidth + 2
  const y = config.startY + STATE.row * config.letterHeight

  setLetterPos(CURSOR, x, y)
}

const newLine = () => {
  const config = getTypingConfig()

  STATE.col = 0

  if (STATE.row < config.maxRows) {
    STATE.row++
  }

  moveCursor()
}

const getFinalLetterPos = () => {
  const config = getTypingConfig()

  const x = config.startX + STATE.col * config.letterWidth
  const y = config.startY + STATE.row * config.letterHeight

  STATE.col++

  if (STATE.col >= config.maxChars) {
    newLine()
  } else {
    moveCursor()
  }

  return { x, y }
}

const initializeLetter = key => {
  const letter = createLetter(key)
  setInitialLetterPos(letter)
  LETTERS.appendChild(letter)
  return letter
}

const typeLetter = key => {
  LAST_TYPE_TIMESTAMP = moment()

  const letter = initializeLetter(key)
  const pos = getFinalLetterPos()

  setLetterPos(letter, pos.x, pos.y)

  setTimeout(() => {
    removeClass(letter, 'off-screen')

    setTimeout(() => {
      setStyle(letter, 'color', '#2d2d2d')
    }, 500)
  }, 13)
}

const wrapText = text => {
  const config = getTypingConfig()
  const maxChars = config.maxChars
  const paragraphs = text.split('|')
  const lines = []

  paragraphs.forEach(paragraph => {
    const cleanParagraph = paragraph.trim()

    if (cleanParagraph === '') {
      lines.push('')
      return
    }

    const words = cleanParagraph.split(' ')
    let currentLine = ''

    words.forEach(word => {
      const testLine = currentLine ? currentLine + ' ' + word : word

      if (testLine.length <= maxChars) {
        currentLine = testLine
      } else {
        if (currentLine) lines.push(currentLine)
        currentLine = word
      }
    })

    if (currentLine) {
      lines.push(currentLine)
    }
  })

  return lines.join('\n')
}

const typeSentence = sentence => {
  let i = 0
  const preparedSentence = wrapText(sentence)

  STATE.row = 0
  STATE.col = 0
  moveCursor()

  typeInterval = setInterval(() => {
    const currentChar = preparedSentence[i]

    if (currentChar === '\n') {
      newLine()
    } else {
      typeLetter(currentChar)
    }

    if (i === preparedSentence.length - 1) {
      clearInterval(typeInterval)
      typeInterval = null

      setTimeout(() => {
        addClass(getEl('photo-container'), 'show')
        removeClass(PAPER, 'typing')
      }, 900)
    }

    i++
  }, 110)
}

const checkIfTyping = () => {
  const timeToLastType = moment() - LAST_TYPE_TIMESTAMP

  if (!PAPER.classList.contains('typing') && timeToLastType <= 300) {
    addClass(PAPER, 'typing')
  } else if (PAPER.classList.contains('typing') && timeToLastType > 300) {
    removeClass(PAPER, 'typing')
  }
}

window.onload = () => {
  const romanticLetter =
    "Para Ann...||Quise regalarte algo hecho con mi corazón.|A tu lado todo se siente bonito.|Tu sonrisa alegra mis días.|Gracias por existir en mi vida.|Te amo muchísimo.|Con amor, Edgar ❤️"

  moveCursor()

  setTimeout(() => {
    typeSentence(romanticLetter)
  }, 1000)

  setInterval(() => {
    checkIfTyping()
  }, 300)
}

setInterval(() => {
  const slides = document.querySelectorAll('.slide')

  if (slides.length > 1) {
    slides[0].classList.toggle('active')
    slides[1].classList.toggle('active')
  }
}, 2200)