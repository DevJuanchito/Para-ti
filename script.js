const book = document.querySelector("#book");
const mobilePrevBtn = document.querySelector("#mobile-prev-btn");
const mobileNextBtn = document.querySelector("#mobile-next-btn");

const lockModal = document.querySelector("#lock-modal");
const passwordInput = document.querySelector("#password-input");
const unlockBtn = document.querySelector("#unlock-btn");
const closeModalBtn = document.querySelector("#close-modal-btn");
const errorMessage = document.querySelector("#error-message");

const heartsContainer = document.querySelector("#hearts-container");

const SECRET_KEY = "18";

const pages = [
  {
    label: "Un regalo para ti",
    title: "Para Ann ❤️",
    text: "Tengo algo especial para ti... una pequeña parte de todo lo que siento.",
    image: "Portada",
    imageClass: "cover-image",
    button: "Abrir mi corazón →"
  },
  {
    label: "Nuestro inicio",
    title: "Eres mi lugar favorito 🏠",
    text: "No importa dónde estemos, si estoy contigo todo se siente bonito. Gracias por llenar mis días de alegría, calma y amor.",
    image: "foto (1)",
    imageClass: "page-image"
  },
  {
    label: "Recuerdos",
    text: "Cada momento a tu lado se vuelve un recuerdo que guardo con amor.",
    image: "foto (2)",
    imageClass: "page-image"
  },
  {
    label: "Sonrisas",
    text: "Cada sonrisa tuya tiene una forma especial de alegrarme el alma.",
    image: "foto (3)",
    imageClass: "page-image"
  },
  {
    label: "Momentos",
    text: "A tu lado, hasta los días simples se sienten especiales.",
    image: "foto (4)",
    imageClass: "page-image"
  },
  {
    label: "Mi persona favorita",
    text: "Gracias por ser tú, por tu forma de querer y por todo lo bonito que traes a mi vida.",
    image: "foto (5)",
    imageClass: "page-image"
  },
  {
    label: "Desde mi corazón",
    title: "¿Por qué tú? ❤️",
    text: "Porque contigo puedo ser yo. Porque me haces reír, me das paz y haces que mi mundo sea más bonito.",
    image: "foto (6)",
    imageClass: "page-image"
  },
  {
    label: "Lo nuestro",
    text: "Hay recuerdos que no se olvidan, y los que vivo contigo los guardo en mi corazón.",
    image: "foto (7)",
    imageClass: "page-image"
  },
  {
    label: "Mi amor",
    text: "No necesito un día perfecto, solo necesito que estés tú para que todo se sienta mejor.",
    image: "foto (8)",
    imageClass: "page-image"
  },
  {
    label: "Gracias",
    text: "Gracias por estar en mi vida, por hacerme sonreír y por ser una parte tan importante de mí.",
    image: "foto (9)",
    imageClass: "page-image"
  },
  {
    label: "Siempre tú",
    text: "Entre tantas personas, mi corazón te eligió a ti.",
    image: "foto (10)",
    imageClass: "page-image"
  },
  {
    label: "Nuestro día",
    title: "Feliz aniversario",
    text: "Gracias por estar en mi vida, Ann. Este detalle es pequeño, pero está hecho con todo mi amor.\n\nCada 18 es nuestro día 💖",
    image: "foto (11)",
    imageClass: "cover-image"
  }
];

let allPapers = [];
let nextButtons = [];
let prevButtons = [];

let currentLocation = 1;
let currentMobilePage = 0;
let isBookUnlocked = false;
let isMobileAnimating = false;

let numOfPapers = 0;
let maxLocation = 0;
let maxMobilePage = pages.length - 1;

function isMobileScreen() {
  return window.innerWidth <= 760;
}

function createSmartImage(baseName, className, altText) {
  const wrapper = document.createElement("div");
  const img = document.createElement("img");

  const extensions = ["png", "jpg", "jpeg", "webp"];
  let index = 0;

  img.className = className;
  img.alt = altText;

  function tryLoad() {
    img.src = `${baseName}.${extensions[index]}`;
  }

  img.onerror = () => {
    index++;

    if (index < extensions.length) {
      tryLoad();
      return;
    }

    wrapper.className = "image-error";
    wrapper.textContent = `No encontré la imagen: ${baseName}`;
    img.replaceWith(wrapper);
  };

  tryLoad();
  return img;
}

function createPageSide(page, sideType, pageIndex) {
  const side = document.createElement("div");
  side.className = sideType;

  const content = document.createElement("div");
  content.className = sideType === "front" ? "front-content" : "back-content";

  const main = document.createElement("div");
  main.className = "page-main-content";

  const label = document.createElement("div");
  label.className = "tiny-label";
  label.textContent = page.label;
  main.appendChild(label);

  if (page.title) {
    const title = document.createElement(pageIndex === 0 || pageIndex === pages.length - 1 ? "h1" : "h2");
    title.textContent = page.title;
    main.appendChild(title);
  }

  if (page.image) {
    const image = createSmartImage(page.image, page.imageClass || "page-image", page.label);
    main.appendChild(image);
  }

  const text = document.createElement("p");
  text.className = page.title ? "" : "small-text";
  text.innerHTML = page.text.replace(/\n/g, "<br>");
  main.appendChild(text);

  content.appendChild(main);

  const button = document.createElement("button");

  if (sideType === "front") {
    button.className = "next-btn";
    button.textContent = page.button || "Siguiente →";
  } else {
    button.className = "prev-btn";
    button.textContent = "← Anterior";
  }

  content.appendChild(button);
  side.appendChild(content);

  return side;
}

function buildBook() {
  const totalPapers = Math.ceil(pages.length / 2);

  for (let i = 0; i < totalPapers; i++) {
    const paper = document.createElement("section");
    paper.className = "paper";
    paper.id = `p${i + 1}`;

    const frontPage = pages[i * 2];
    const backPage = pages[i * 2 + 1];

    if (frontPage) {
      paper.appendChild(createPageSide(frontPage, "front", i * 2));
    }

    if (backPage) {
      paper.appendChild(createPageSide(backPage, "back", i * 2 + 1));
    }

    book.appendChild(paper);
  }

  allPapers = document.querySelectorAll(".paper");
  nextButtons = document.querySelectorAll(".next-btn");
  prevButtons = document.querySelectorAll(".prev-btn");

  numOfPapers = allPapers.length;
  maxLocation = numOfPapers + 1;

  allPapers.forEach((paper, index) => {
    paper.style.zIndex = (numOfPapers - index) + numOfPapers;
  });

  attachPageButtons();
}

function attachPageButtons() {
  nextButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();

      if (isMobileScreen()) return;

      if (currentLocation === 1 && !isBookUnlocked) {
        showLockModal();
        return;
      }

      goNextPage();
    });
  });

  prevButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();

      if (isMobileScreen()) return;

      goPrevPage();
    });
  });
}

/* =========================
   MODO MÓVIL
========================== */

function updateMobileMode() {
  if (isMobileScreen()) {
    book.classList.add("mobile-mode");
    book.style.transform = "none";
    showMobilePage(currentMobilePage, "next", true);
  } else {
    book.classList.remove("mobile-mode", "mobile-next", "mobile-prev");
    resetMobileClasses();

    mobilePrevBtn.disabled = true;
    mobileNextBtn.disabled = true;

    if (book.classList.contains("opened")) {
      book.style.transform = "translateX(50%)";
    }
  }
}

function resetMobileClasses() {
  allPapers.forEach((paper) => {
    paper.classList.remove("mobile-active", "show-front", "show-back");
  });
}

function showMobilePage(pageIndex, direction = "next", instant = false) {
  if (!isMobileScreen()) return;
  if (isMobileAnimating && !instant) return;

  const newPage = Math.max(0, Math.min(pageIndex, maxMobilePage));
  const isSamePage = newPage === currentMobilePage;

  currentMobilePage = newPage;

  resetMobileClasses();

  book.classList.remove("mobile-next", "mobile-prev");

  if (!isSamePage && !instant) {
    book.classList.add(direction === "prev" ? "mobile-prev" : "mobile-next");
    isMobileAnimating = true;
  }

  const paperIndex = Math.floor(currentMobilePage / 2);
  const isFrontSide = currentMobilePage % 2 === 0;
  const paper = allPapers[paperIndex];

  if (!paper) return;

  paper.classList.add("mobile-active");
  paper.classList.add(isFrontSide ? "show-front" : "show-back");

  mobilePrevBtn.disabled = currentMobilePage === 0;
  mobileNextBtn.disabled = currentMobilePage === maxMobilePage;

  if (currentMobilePage === 0 && !isBookUnlocked) {
    mobileNextBtn.textContent = "Abrir ❤️";
  } else if (currentMobilePage === maxMobilePage) {
    mobileNextBtn.textContent = "Final";
  } else {
    mobileNextBtn.textContent = "Siguiente →";
  }

  setTimeout(() => {
    book.classList.remove("mobile-next", "mobile-prev");
    isMobileAnimating = false;
  }, instant ? 0 : 500);
}

function goNextMobilePage() {
  if (isMobileAnimating) return;

  if (currentMobilePage === 0 && !isBookUnlocked) {
    showLockModal();
    return;
  }

  if (currentMobilePage < maxMobilePage) {
    showMobilePage(currentMobilePage + 1, "next");
  }
}

function goPrevMobilePage() {
  if (isMobileAnimating) return;

  if (currentMobilePage > 0) {
    showMobilePage(currentMobilePage - 1, "prev");
  }
}

/* =========================
   MODO DESKTOP 3D
========================== */

function openBook() {
  book.classList.add("opened");

  if (!isMobileScreen()) {
    book.style.transform = "translateX(50%)";
  } else {
    book.style.transform = "none";
  }
}

function closeBook() {
  book.classList.remove("opened");
  book.style.transform = "translateX(0%)";
}

function goNextPage() {
  if (isMobileScreen()) {
    goNextMobilePage();
    return;
  }

  if (currentLocation >= maxLocation) return;

  if (currentLocation === 1) {
    openBook();
  }

  const paperToFlip = document.querySelector(`#p${currentLocation}`);
  if (!paperToFlip) return;

  paperToFlip.classList.add("flipped");

  setTimeout(() => {
    paperToFlip.style.zIndex = currentLocation;
  }, 650);

  currentLocation++;
}

function goPrevPage() {
  if (isMobileScreen()) {
    goPrevMobilePage();
    return;
  }

  if (currentLocation <= 1) return;

  currentLocation--;

  const paperToUnflip = document.querySelector(`#p${currentLocation}`);
  if (!paperToUnflip) return;

  paperToUnflip.classList.remove("flipped");
  paperToUnflip.style.zIndex = (numOfPapers - (currentLocation - 1)) + numOfPapers;

  if (currentLocation === 1) {
    closeBook();
  }
}

/* =========================
   CANDADO
========================== */

function showLockModal() {
  lockModal.classList.add("show");
  passwordInput.value = "";
  errorMessage.style.display = "none";

  setTimeout(() => {
    passwordInput.focus();
  }, 250);
}

function hideLockModal() {
  lockModal.classList.remove("show");
}

function checkPassword() {
  const userValue = passwordInput.value.trim();

  if (userValue === SECRET_KEY) {
    isBookUnlocked = true;
    hideLockModal();

    setTimeout(() => {
      if (isMobileScreen()) {
        showMobilePage(1, "next");
      } else {
        goNextPage();
      }
    }, 220);

    return;
  }

  errorMessage.style.display = "block";
  passwordInput.classList.add("shake");

  setTimeout(() => {
    passwordInput.classList.remove("shake");
  }, 500);
}

unlockBtn.addEventListener("click", checkPassword);
closeModalBtn.addEventListener("click", hideLockModal);

passwordInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    checkPassword();
  }
});

lockModal.addEventListener("click", (event) => {
  if (event.target === lockModal) {
    hideLockModal();
  }
});

/* =========================
   BOTONES MÓVIL
========================== */

mobileNextBtn.addEventListener("click", () => {
  goNextMobilePage();
});

mobilePrevBtn.addEventListener("click", () => {
  goPrevMobilePage();
});

/* =========================
   CORAZONES FLOTANTES
========================== */

function createFloatingHeart() {
  if (!heartsContainer) return;

  const heart = document.createElement("div");
  heart.className = "float-heart";
  heart.textContent = Math.random() > 0.55 ? "♡" : "❤️";

  heart.style.left = Math.random() * 100 + "vw";
  heart.style.setProperty("--size", 13 + Math.random() * 20 + "px");
  heart.style.setProperty("--duration", 5 + Math.random() * 5 + "s");

  heartsContainer.appendChild(heart);

  setTimeout(() => {
    heart.remove();
  }, 10000);
}

const heartInterval = window.innerWidth <= 760 ? 1200 : 800;
setInterval(createFloatingHeart, heartInterval);

window.addEventListener("resize", () => {
  updateMobileMode();
});

buildBook();
updateMobileMode();