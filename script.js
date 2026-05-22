const getEl = el => document.getElementById(el)
const setStyle = (el, prop, val) => el.style[prop] = val
const setAttr = (el, attr, val) => el.setAttribute(attr, val)
const addClass = (el, className) => el.classList.add(className)
const removeClass = (el, className) => el.classList.remove(className)
const resetStyles = el => el.removeAttribute('style')
const removeAllChildren = el => {
  while (el.hasChildNodes()) el.removeChild(el.lastChild)
}

const WRAPPER = getEl('wrapper'),
      PAPER = getEl('paper'),
      LETTERS = getEl('letters'),
      CURSOR = getEl('cursor')

let HAS_STARTED_TYPING = false,
    LAST_TYPE_TIMESTAMP = 0

const IS_MOBILE = window.innerWidth <= 480

const MIN_COL = IS_MOBILE ? 7 : 9,
      MAX_COL = IS_MOBILE ? (LETTERS.clientWidth / 9.2) - 2 : (LETTERS.clientWidth / 10) - 2,
      MIN_ROW = 4,
      MAX_ROW = IS_MOBILE ? 34 : 34,
      LETTER_WIDTH = IS_MOBILE ? 9.2 : 11.1,
      LETTER_HEIGHT = 20,
      COLORS = {
        COLOR1: 'rgb(255, 64, 129)',
        COLOR2: 'rgb(194, 24, 91)',
        COLOR3: 'rgb(255, 128, 171)',
        COLOR4: 'rgb(216, 27, 96)',
        COLOR5: 'rgb(240, 98, 146)'
      }

const STATE = {
  range: 0.1,
  pos: {
    row: MIN_ROW,
    col: MIN_COL
  }
}

const getRandColor = () => {
  const rand = Math.floor((Math.random() * 5) + 1)

  switch(rand){
    case 1: return COLORS.COLOR1
    case 2: return COLORS.COLOR2
    case 3: return COLORS.COLOR3
    case 4: return COLORS.COLOR4
    case 5: return COLORS.COLOR5
  }
}

const getRandPosOffScreen = () => {
  const lowX1 = 0 - (window.innerWidth * 0.3),
        highX1 = 0 - (window.innerWidth * 0.2),
        lowY1 = 0, highY1 = window.innerHeight,

        lowX2 = window.innerWidth * 1.2,
        highX2 = window.innerWidth * 1.3,
        lowY2 = 0, highY2 = window.innerHeight,

        lowX3 = 0, highX3 = window.innerWidth,
        lowY3 = 0 - (window.innerHeight * 0.3),
        highY3 = 0 - (window.innerHeight * 0.2),

        lowX4 = 0, highX4 = window.innerWidth,
        lowY4 = window.innerHeight * 1.2,
        highY4 = window.innerHeight * 1.3

  const rand = Math.floor((Math.random() * 4) + 1)
  let x = 0, y = 0

  switch(rand){
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
  const color = getRandColor()
  setStyle(letter, 'color', color)
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

const bumpLetterPos = isUp => {
  if(isUp){
    if(STATE.pos.col < MAX_COL){
      STATE.pos.col = Math.min(STATE.pos.col + 1, MAX_COL)
    }
    else{
      STATE.pos.col = MIN_COL
      STATE.pos.row = Math.min(STATE.pos.row + 1, MAX_ROW)
    }
  }
  else{
    if(STATE.pos.col > MIN_COL){
      STATE.pos.col = Math.max(STATE.pos.col - 1, MIN_COL)
    }
    else{
      STATE.pos.col = MAX_COL
      STATE.pos.row = Math.max(STATE.pos.row - 1, MIN_ROW)
    }
  }
}

const bumpCursorPos = () => {
  const x = STATE.pos.col * LETTER_WIDTH + CURSOR.clientWidth,
        y = STATE.pos.row * LETTER_HEIGHT
  setLetterPos(CURSOR, x, y)
}

const determineFinalLetterPos = () => {
  let x = 0, y = 0

  if(STATE.pos.col <= MAX_COL){
    x = STATE.pos.col * LETTER_WIDTH
    y = STATE.pos.row * LETTER_HEIGHT
  }
  else{
    x = STATE.pos.col * LETTER_WIDTH
    y = (STATE.pos.row + 1) * LETTER_HEIGHT
  }

  bumpLetterPos(true)
  bumpCursorPos()
  return {x, y}
}

const setFinalLetterPos = letter => {
  const pos = determineFinalLetterPos()
  setLetterPos(letter, pos.x, pos.y)
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
  setFinalLetterPos(letter)

  setTimeout(() => {
    removeClass(letter, 'off-screen')
    setTimeout(() => setStyle(letter, 'color', '#2d2d2d'), 500)
  }, 13)
}

let typeInterval = null

const typeSentence = sentence => {
  let i = 0

  HAS_STARTED_TYPING = true

  typeInterval = setInterval(() => {
    if (sentence[i] === '|') {
      STATE.pos.col = MIN_COL
      STATE.pos.row = Math.min(STATE.pos.row + 1, MAX_ROW)
      bumpCursorPos()
    } else {
      typeLetter(sentence[i])
    }

    if(i === sentence.length - 1) {
      clearInterval(typeInterval)
      setTimeout(() => {
        addClass(getEl('photo-container'), 'show')
        removeClass(PAPER, 'typing')
      }, 1000)
    }

    i++
  }, 120)
}

const checkIfTyping = () => {
  const timeToLastType = moment() - LAST_TYPE_TIMESTAMP

  if(!PAPER.classList.contains('typing') && timeToLastType <= 300){
    addClass(PAPER, 'typing')
  }
  else if(PAPER.classList.contains('typing') && timeToLastType > 300){
    removeClass(PAPER, 'typing')
  }
}

window.onload = () => {
  const romanticLetter = "||||Para Ann... ||Quería hacerte algo|especial para ti. ||Si pudiera elegir|un lugar seguro,|sería a tu lado. ||Cada día contigo|me hace amarte más. ||Gracias por existir|en mi vida. ||Con amor, Edgar ❤️"

  setTimeout(() => {
    typeSentence(romanticLetter)
  }, 1000)

  setInterval(() => checkIfTyping(), 300)
}

setInterval(() => {
  const slides = document.querySelectorAll('.slide')

  if (slides.length > 1) {
    slides[0].classList.toggle('active')
    slides[1].classList.toggle('active')
  }
}, 2000)