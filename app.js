(() => {
  "use strict";

  // ================================================================
  // 1. BASIS: vaste gegevens, HTML-elementen en opslag
  // ================================================================

  const DATA = window.LETTERLAB_DATA;
  const app = document.querySelector("#app");
  const APP_TYPE = document.body.dataset.app || "beheer";

  const STORAGE_PREFIX = DATA.storageNamespace || "letterlab";
  const STORAGE_KEYS = {
    questions: `${STORAGE_PREFIX}-questions-v1`,
    custom: `${STORAGE_PREFIX}-custom-words-v1`,
    audio: `${STORAGE_PREFIX}-audio-v1`,
    exercises: `${STORAGE_PREFIX}-exercises-v1`,
  };

  function loadFromStorage(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function decodeShortExerciseFromUrl() {
    const parameters = new URLSearchParams(location.search);
    const enteredWord = parameters.get("woord")?.trim().toLowerCase();
    const enteredPositions = parameters.get("ontbreekt");

    if (!enteredWord || !enteredPositions) {
      return null;
    }

    const graphemes = tokenize(enteredWord);
    const missing = [
      ...new Set(
        enteredPositions
          .split(",")
          .map((position) => Number.parseInt(position.trim(), 10) - 1)
          .filter(
            (position) =>
              Number.isInteger(position) &&
              position >= 0 &&
              position < graphemes.length,
          ),
      ),
    ];

    if (!graphemes.length || !missing.length) {
      return null;
    }

    const showCopyWord =
      parameters.get("voorbeeld")?.trim().toLowerCase() === "ja";

    return {
      questions: [
        {
          word: graphemes.join(""),
          graphemes,
          missing,
          showCopyWord,
          image: "",
        },
      ],
    };
  }

  function decodeShortClickBookFromParameters(parameters) {
    const groups = [];

    for (let position = 1; position <= 8; position += 1) {
      const value = parameters.get(`p${position}`);
      if (!value) continue;

      const group = value
        .toLowerCase()
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => (part === "-" || part === "leeg" ? "" : part));
      if (group.length) groups.push(group);
    }

    if (groups.length < 2) return null;

    return {
      type: "klikklak",
      name: parameters.get("naam") || "Klik-klakboekje",
      groups,
      onlyExistingWords:
        parameters.get("woorden")?.trim().toLowerCase() !== "nee",
      dictionaryVersion: parameters.get("wb") || "v1",
      excludedWords: (parameters.get("uit") || "")
        .split(",")
        .map((word) => word.trim().toLowerCase())
        .filter(Boolean),
    };
  }

  function decodeShortClickBookFromUrl() {
    return decodeShortClickBookFromParameters(
      new URLSearchParams(location.search),
    );
  }

  function decodeExerciseFromUrl() {
    try {
      const parameters = new URLSearchParams(location.hash.slice(1));
      const encodedExercise = parameters.get("oefening");

      if (!encodedExercise) {
        return APP_TYPE === "klikklak"
          ? decodeShortClickBookFromUrl()
          : decodeShortExerciseFromUrl();
      }

      const base64 = encodedExercise.replace(/-/g, "+").replace(/_/g, "/");
      const bytes = Uint8Array.from(atob(base64), (character) =>
        character.charCodeAt(0),
      );

      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return APP_TYPE === "klikklak"
        ? decodeShortClickBookFromUrl()
        : decodeShortExerciseFromUrl();
    }
  }

  function decodeExerciseFromUrlString(url) {
    try {
      const exerciseUrl = new URL(url);
      const parameters = new URLSearchParams(exerciseUrl.hash.slice(1));
      const encodedExercise = parameters.get("oefening");
      if (!encodedExercise) {
        return decodeShortClickBookFromParameters(exerciseUrl.searchParams);
      }

      const base64 = encodedExercise.replace(/-/g, "+").replace(/_/g, "/");
      const bytes = Uint8Array.from(atob(base64), (character) =>
        character.charCodeAt(0),
      );
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
  }

  function encodeExercise(exercise) {
    const bytes = new TextEncoder().encode(JSON.stringify(exercise));
    let binary = "";

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  function makeExerciseUrl(type, settings) {
    const path = DATA.standaloneMode ? "./" : `${type}/`;
    const url = new URL(path, DATA.baseUrl);
    url.hash = `oefening=${encodeExercise(settings)}`;
    return url.href;
  }

  const sharedExercise = decodeExerciseFromUrl();
  const opensSharedDictation = Boolean(sharedExercise?.questions);

  // In state bewaren we alles wat tijdens het gebruik kan veranderen.
  const state = {
    mode:
      APP_TYPE === "dictee" || opensSharedDictation
        ? "dictation"
        : APP_TYPE === "klikklak"
          ? "booklet"
          : "manage",
    questions:
      opensSharedDictation
        ? sharedExercise.questions
        : loadFromStorage(STORAGE_KEYS.questions, DATA.questions),
    customWords: loadFromStorage(STORAGE_KEYS.custom, []),
    audio: loadFromStorage(STORAGE_KEYS.audio, {}),
    currentQuestionIndex: 0,
    typed: "",
    result: "",
    pattern: "MKM",
    learnedGraphemes: new Set(DATA.learnedDefault),
    draftWord: "",
    missingGraphemes: new Set(),
    bookPositions: Array.from(
      { length: sharedExercise?.groups?.length || 3 },
      () => 0,
    ),
    bookGroups:
      APP_TYPE === "klikklak" && sharedExercise?.groups
        ? sharedExercise.groups
        : [DATA.clickBook.begin, DATA.clickBook.kern, DATA.clickBook.einde],
    exerciseName: "",
    clickBookDraftGroups: [
      DATA.clickBook.begin.join(", "),
      DATA.clickBook.kern.join(", "),
      DATA.clickBook.einde.join(", "),
    ],
    // Nieuwe boekjes starten veilig met de woordenfilter ingeschakeld.
    // Een bestaande link blijft zijn expliciete keuze behouden.
    onlyExistingWords: sharedExercise
      ? sharedExercise.onlyExistingWords === true
      : true,
    dictionaryVersion: sharedExercise?.dictionaryVersion || "v1",
    bookExcludedWords: (sharedExercise?.excludedWords || []).join(", "),
    bookEntries: null,
    bookEntryIndex: 0,
    bookPreviewMessage: "",
    exercises: loadFromStorage(STORAGE_KEYS.exercises, []),
    recording: null,
    editingExerciseId: null,
    publicationMessage: "",
    linkToImport: "",
  };

  function saveToStorage() {
    localStorage.setItem(
      STORAGE_KEYS.questions,
      JSON.stringify(state.questions),
    );
    localStorage.setItem(
      STORAGE_KEYS.custom,
      JSON.stringify(state.customWords),
    );
    localStorage.setItem(STORAGE_KEYS.audio, JSON.stringify(state.audio));
    localStorage.setItem(
      STORAGE_KEYS.exercises,
      JSON.stringify(state.exercises),
    );
  }

  // ================================================================
  // 2. KLEINE HULPFUNCTIES
  // ================================================================

  // Voorkomt dat ingevoerde tekst als HTML wordt uitgevoerd.
  function escapeHtml(value) {
    return String(value).replace(
      /[&<>"]/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
        })[character],
    );
  }

  function icon(name) {
    return `<svg class="icon" aria-hidden="true">
      <use href="#i-${name}"></use>
    </svg>`;
  }

  function iconButton(name, action, label, extraClass = "") {
    return `<button
      class="icon-btn ${extraClass}"
      data-action="${action}"
      aria-label="${label}"
      title="${label}"
    >${icon(name)}</button>`;
  }

  function header(showSettings = true) {
    if (APP_TYPE === "dictee" || APP_TYPE === "klikklak") {
      return "";
    }
    let leftSide = '<span class="brand">Letterlab</span>';
    if (state.mode !== "home") {
      leftSide = iconButton("back", "home", "Terug");
    }

    const settingsButton = showSettings
      ? iconButton("gear", "manage", "Instellingen")
      : "";

    return `<header class="topbar">
      <div>${leftSide}</div>
      <div class="top-actions">${settingsButton}</div>
    </header>`;
  }

  // ================================================================
  // 3. WOORDEN EN GRAFEMEN
  // ================================================================

  function tokenize(word) {
    const clean = word
      .toLowerCase()
      .trim()
      .replace(/[^a-zà-ÿ]/g, "");
    const out = [];
    let i = 0;
    const compounds = [...DATA.compoundGraphemes].sort(
      (a, b) => b.length - a.length,
    );
    while (i < clean.length) {
      const found = compounds.find((x) => clean.startsWith(x, i));
      out.push(found || clean[i]);
      i += (found || clean[i]).length;
    }
    return out;
  }

  function graphemeType(grapheme) {
    return DATA.vowels.includes(grapheme) ? "K" : "M";
  }

  function patternOf(word) {
    return tokenize(word).map(graphemeType).join("");
  }

  function ownAudio(key) {
    return state.audio[key];
  }

  function builtInAudio(key) {
    return DATA.builtInAudio[key];
  }

  function dictionaryWords(version = "v1") {
    return window.LETTERLAB_WORDLISTS?.[version] || [];
  }

  function splitWordAcrossGroups(word, groups) {
    const memo = new Map();

    function search(groupIndex, characterIndex) {
      const memoKey = `${groupIndex}:${characterIndex}`;
      if (memo.has(memoKey)) return memo.get(memoKey);

      if (groupIndex === groups.length) {
        return characterIndex === word.length ? [] : null;
      }

      for (const part of groups[groupIndex]) {
        if (!word.startsWith(part, characterIndex)) continue;
        const rest = search(groupIndex + 1, characterIndex + part.length);
        if (rest) {
          const result = [part, ...rest];
          memo.set(memoKey, result);
          return result;
        }
      }

      memo.set(memoKey, null);
      return null;
    }

    return search(0, 0);
  }

  function makeBookEntries(groups, version = "v1", excludedWords = []) {
    if (groups.length < 2 || groups.length > 8) return [];

    const shortest = groups.reduce(
      (total, group) => total + Math.min(...group.map((part) => part.length)),
      0,
    );
    const longest = groups.reduce(
      (total, group) => total + Math.max(...group.map((part) => part.length)),
      0,
    );

    const excluded = new Set(excludedWords);
    const entries = [];
    for (const word of dictionaryWords(version)) {
      if (excluded.has(word)) continue;
      if (word.length < shortest || word.length > longest) continue;
      const parts = splitWordAcrossGroups(word, groups);
      if (parts) entries.push({ word, parts });
    }
    return entries;
  }

  function refreshBookEntries(groups = state.bookGroups) {
    const excludedWords = splitGraphemeList(state.bookExcludedWords);
    state.bookEntries = state.onlyExistingWords
      ? makeBookEntries(groups, state.dictionaryVersion, excludedWords)
      : null;
    state.bookEntryIndex = 0;
  }

  // ================================================================
  // 4. AUDIO
  // ================================================================

  function resolveAudioSource(source) {
    return source.startsWith("data:")
      ? source
      : new URL(source, DATA.baseUrl).href;
  }

  const AUDIO_START_DELAY_MS = 30;
  const AUDIO_OUTPUT_IDLE_MS = 1200;
  const AUDIO_WARMUP_LEAD_MS = 180;
  const AUDIO_WARMUP_TOTAL_MS = 520;
  let activeAudio = null;
  let audioContext = null;
  let lastAudioActivityAt = 0;

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function prepareAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioContext) {
      audioContext = new AudioContextClass();
    }

    // Deze functie wordt rechtstreeks vanuit de klik van de gebruiker gestart.
    // Daardoor mag een mobiele browser de audiocontext activeren.
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }

    return audioContext;
  }

  async function warmUpAudioOutputIfNeeded(context) {
    const audioWasRecentlyActive =
      Date.now() - lastAudioActivityAt < AUDIO_OUTPUT_IDLE_MS;

    if (audioWasRecentlyActive) return;

    if (!context) {
      await wait(AUDIO_WARMUP_LEAD_MS);
      return;
    }

    try {
      if (context.state === "suspended") {
        await context.resume();
      }

      // Volledige digitale stilte zet sommige telefoonluidsprekers niet aan.
      // Dit uiterst zachte signaal houdt de audio-uitvoer wakker tot het woord
      // werkelijk begint. Het is normaal niet hoorbaar voor de gebruiker.
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 80;
      gain.gain.value = 0.001;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + AUDIO_WARMUP_TOTAL_MS / 1000);
      lastAudioActivityAt = Date.now();

      await wait(AUDIO_WARMUP_LEAD_MS);
    } catch {
      // Zonder Web Audio blijft de gewone korte startpauze actief.
      await wait(AUDIO_WARMUP_LEAD_MS);
    }
  }

  function waitUntilAudioCanPlay(audio) {
    if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const audioIsReady = () => {
        removeTemporaryListeners();
        resolve();
      };
      const audioHasError = () => {
        removeTemporaryListeners();
        reject(audio.error || new Error("De audio kon niet worden geladen."));
      };
      const removeTemporaryListeners = () => {
        audio.removeEventListener("canplay", audioIsReady);
        audio.removeEventListener("error", audioHasError);
      };

      audio.addEventListener("canplay", audioIsReady, { once: true });
      audio.addEventListener("error", audioHasError, { once: true });
      audio.load();
    });
  }

  function playAudioSource(source, shouldWarmUp = false) {
    return new Promise(async (resolve, reject) => {
      // Alleen volledige woorden hebben de extra opwarming nodig. Losse
      // letters moeten zonder merkbare wachttijd reageren.
      const context = shouldWarmUp ? prepareAudioContext() : null;
      const audio = new Audio(resolveAudioSource(source));
      audio.preload = "auto";

      try {
        await waitUntilAudioCanPlay(audio);
        if (shouldWarmUp) {
          await warmUpAudioOutputIfNeeded(context);
        }

        // Stop eerst een eventuele vorige opname. De korte pauze voorkomt dat
        // sommige telefoons het begin van de nieuwe opname inslikken.
        if (activeAudio && activeAudio !== audio) {
          activeAudio.pause();
          activeAudio.currentTime = 0;
        }

        activeAudio = audio;
        audio.currentTime = 0;
        if (shouldWarmUp) {
          await wait(AUDIO_START_DELAY_MS);
        }

        audio.addEventListener(
          "ended",
          () => {
            lastAudioActivityAt = Date.now();
            if (activeAudio === audio) activeAudio = null;
            resolve();
          },
          { once: true },
        );
        audio.addEventListener(
          "error",
          () => {
            if (activeAudio === audio) activeAudio = null;
            reject(audio.error || new Error("De audio kon niet worden afgespeeld."));
          },
          { once: true },
        );

        await audio.play();
        lastAudioActivityAt = Date.now();
      } catch (error) {
        if (activeAudio === audio) activeAudio = null;
        reject(error);
      }
    });
  }

  async function playSoundSequence(parts) {
    for (const part of parts) {
      const source = ownAudio(`sound:${part}`) || builtInAudio(`sound:${part}`);
      if (!source) continue;
      try {
        await playAudioSource(source, false);
      } catch {
        // Een ontbrekend of defect bestand mag nooit een browserstem activeren.
      }
    }
  }

  function useBrowserVoice(text, parts) {
    if (!("speechSynthesis" in window)) {
      playSoundSequence(parts);
      return;
    }

    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices?.() || [];
    utterance.voice =
      voices.find((voice) => voice.lang.toLowerCase() === "nl-be") ||
      voices.find((voice) => voice.lang.toLowerCase().startsWith("nl")) ||
      null;
    utterance.lang = utterance.voice?.lang || "nl-BE";
    utterance.rate = 0.72;
    utterance.addEventListener("error", () => playSoundSequence(parts), {
      once: true,
    });
    speechSynthesis.speak(utterance);
  }

  function speak(text, key = text, parts = []) {
    // In het klik-klakboekje gebruiken we uitsluitend gecontroleerde opnames.
    // Zo kan een browser nooit een letternaam of buitenlandse uitspraak kiezen.
    const selectedAudio = ownAudio(key) || builtInAudio(key);

    if (selectedAudio) {
      playAudioSource(selectedAudio, key.startsWith("word:")).catch(() => {});
      return;
    }

    if (key.startsWith("word:") && /^[a-z]+$/.test(text)) {
      const firstLetter = text[0];
      const ownWordFile = new URL(
        `assets/audio/woorden/${firstLetter}/${encodeURIComponent(text)}.mp3`,
        DATA.baseUrl,
      ).href;
      let fallbackStarted = false;
      const useSafeFallback = () => {
        if (fallbackStarted) return;
        fallbackStarted = true;
        const wordParts = parts.length ? parts : tokenize(text);
        if (state.onlyExistingWords) {
          useBrowserVoice(text, wordParts);
        } else {
          playSoundSequence(wordParts);
        }
      };
      playAudioSource(ownWordFile, true).catch(useSafeFallback);
      return;
    }
  }

  function getCurrentQuestion() {
    return state.questions[state.currentQuestionIndex] || DATA.questions[0];
  }

  function getExpectedAnswer(question = getCurrentQuestion()) {
    return question.missing.map((index) => question.graphemes[index]).join("");
  }

  // ================================================================
  // 5. SCHERMEN OPBOUWEN
  // ================================================================

  function home() {
    app.innerHTML = `${header()}<section class="screen"><div class="home-grid">
      <button class="mode-card" data-action="dictation" aria-label="Dictee">${icon("keyboard")}</button>
      <button class="mode-card" data-action="booklet" aria-label="Klik-klakboekje">${icon("book")}</button>
    </div></section>`;
  }
  function dictation() {
    if (!state.questions.length) {
      state.mode = "home";
      home();
      return;
    }
    if (state.currentQuestionIndex >= state.questions.length) {
      state.currentQuestionIndex = state.questions.length - 1;
    }
    const question = getCurrentQuestion();
    // Nieuwe links bewaren de keuze per vraag. De tweede waarde houdt
    // eerder gemaakte links met één algemene keuze werkend.
    const showCopyWord =
      question.showCopyWord ?? (sharedExercise?.showCopyWord === true);
    const missingOrder = question.missing;
    const typedChunks = {};

    let offset = 0;

    missingOrder.forEach((index) => {
      const graphemeLength = question.graphemes[index].length;
      typedChunks[index] = state.typed.slice(offset, offset + graphemeLength);
      offset += graphemeLength;
    });

    const slots = question.graphemes
      .map((grapheme, index) => {
        if (!question.missing.includes(index)) {
          return `<span class="slot">${escapeHtml(grapheme)}</span>`;
        }

        const minimumWidth = Math.max(48, grapheme.length * 42);
        const typedChunk = typedChunks[index] || " ";

        return `<span
          class="slot missing ${state.result}"
          style="min-width:${minimumWidth}px"
        >${escapeHtml(typedChunk)}</span>`;
      })
      .join("");

    let feedback = '<div class="feedback"></div>';
    if (state.result === "good") {
      const nextButton =
        state.currentQuestionIndex < state.questions.length - 1
          ? iconButton("next", "next-question", "Volgende", "good")
          : "";
      feedback = `<div class="feedback good">
        ${icon("check")}
        ${nextButton}
      </div>`;
    }
    if (state.result === "wrong") {
      feedback = `<div class="feedback bad">
        ${icon("close")}
        ${iconButton("retry", "retry", "Opnieuw", "bad")}
      </div>`;
    }

    const keyboardRows = DATA.keyboard
      .map(
        (row) =>
          `<div class="key-row">
            ${row
              .map(
                (letter) =>
                  `<button class="key" data-key="${letter}">${letter}</button>`,
              )
              .join("")}
          </div>`,
      )
      .join("");

    app.innerHTML = `${header()}
      <section class="screen dictation">
        <button class="listen" data-action="speak-word" aria-label="Luister">
          ${icon("speaker")}
        </button>
        ${question.image ? `<img class="dictation-image" src="${escapeHtml(question.image)}" alt="">` : ""}
        ${showCopyWord ? `<div class="copy-word">${escapeHtml(question.word)}</div>` : ""}
        <div class="word-slots">${slots}</div>
        ${feedback}
        <div class="keyboard">
          ${keyboardRows}
          <div class="key-row">
            <button class="key wide" data-action="erase" aria-label="Wis">
              ${icon("back")}
            </button>
          </div>
        </div>
      </section>`;
  }


  function booklet() {
    const groups = state.bookGroups;

    if (state.onlyExistingWords && state.bookEntries === null) {
      refreshBookEntries(groups);
    }

    if (state.onlyExistingWords && !state.bookEntries.length) {
      app.innerHTML = `${header()}
        <section class="screen booklet">
          <div class="empty book-empty">Met deze letters kunnen geen woorden worden gemaakt.</div>
        </section>`;
      return;
    }

    const currentEntry = state.onlyExistingWords
      ? state.bookEntries[state.bookEntryIndex % state.bookEntries.length]
      : null;
    const parts = currentEntry
      ? currentEntry.parts
      : groups.map((group, index) => {
          const position = state.bookPositions[index] % group.length;
          return group[position];
        });

    const word = parts.join("");

    const columns = groups
      .map((group, index) => {
        const value = parts[index];
        const visibleValue = value ? escapeHtml(value) : "&nbsp;";
        const soundAttributes = value
          ? `data-sound="${escapeHtml(value)}"`
          : 'aria-label="Lege positie"';

        return `<div class="book-col">
          <button class="tiny-btn" data-book="${index}" data-delta="-1" aria-label="Vorige">
            ${icon("up")}
          </button>
          <button class="sound-card" ${soundAttributes}>
            ${visibleValue}
          </button>
          <button class="tiny-btn" data-book="${index}" data-delta="1" aria-label="Volgende">
            ${icon("down")}
          </button>
        </div>`;
      })
      .join("");

    app.innerHTML = `${header()}
      <section class="screen booklet">
        <div class="book-word">
          <button
            class="listen"
            data-sound="${escapeHtml(word)}"
            data-audio-key="word:${escapeHtml(word)}"
            data-word-parts="${escapeHtml(parts.join(","))}"
            aria-label="Luister"
          >${icon("speaker")}</button>
          <span>${escapeHtml(word)}</span>
        </div>
        <div class="book-columns" style="--book-columns:${groups.length}">${columns}</div>
      </section>`;
  }
  function manualPanel() {
    const graphemes = tokenize(state.draftWord);
    const choices = graphemes
      .map(
        (grapheme, index) =>
          `<button class="chip missing-choice ${state.missingGraphemes.has(index) ? "active" : ""}" data-missing="${index}">${escapeHtml(grapheme)}</button>`,
      )
      .join("");

    const graphemePicker = graphemes.length
      ? `<p class="help">Tik op wat de cursist moet typen.</p>
         <div class="chips">${choices}</div>
         <p>
           <button class="action" data-action="add-manual">
             ${icon("plus")} Toevoegen
           </button>
         </p>`
      : "";

    return `<section class="panel">
      <h2>Zelf een dicteewoord toevoegen</h2>
      <div class="field">
        <label for="draft">Woord</label>
        <input
          id="draft"
          class="text-input"
          value="${escapeHtml(state.draftWord)}"
          autocomplete="off"
          autocapitalize="none"
        >
      </div>
      ${graphemePicker}
    </section>`;
  }

  function generatorPanel() {
    const availableWords = [
      ...new Set([...DATA.wordBank, ...state.customWords]),
    ]
      .filter(
        (word) =>
          patternOf(word) === state.pattern &&
          tokenize(word).every((grapheme) =>
            state.learnedGraphemes.has(grapheme),
          ),
      )
      .slice(0, 80);

    const suggestion =
      availableWords
        .map((word) => {
          return `<button
            class="suggestion"
            data-suggest="${escapeHtml(word)}"
          >
            ${icon("plus")}
            ${escapeHtml(word)}
          </button>`;
        })
        .join("") || `<div class="empty">Geen woorden met deze keuze.</div>`;

    const patternButtons = DATA.patterns
      .map(
        (pattern) =>
          `<button class="chip ${pattern === state.pattern ? "active" : ""}" data-pattern="${pattern}">${pattern}</button>`,
      )
      .join("");

    const graphemeButtons = DATA.learnable
      .map(
        (grapheme) =>
          `<button class="chip ${state.learnedGraphemes.has(grapheme) ? "active" : ""}" data-learned="${grapheme}">${grapheme}</button>`,
      )
      .join("");

    return `<section class="panel">
      <h2>Woorden uit de databank</h2>
      <div class="field">
        <label>Woordvorm</label>
        <div class="chips">${patternButtons}</div>
      </div>
      <div class="field">
        <label>Geleerde letters en klanken</label>
        <div class="chips">${graphemeButtons}</div>
      </div>
      <div class="suggestions">${suggestion}</div>
    </section>`;
  }
  function audioPanel() {
    const graphemes = [
      ...new Set(state.questions.flatMap((question) => question.graphemes)),
    ];

    const soundOptions = graphemes
      .map(
        (grapheme) =>
          `<option value="sound:${escapeHtml(grapheme)}">klank: ${escapeHtml(grapheme)}</option>`,
      )
      .join("");

    const wordOptions = state.questions
      .map(
        (question) =>
          `<option value="word:${escapeHtml(question.word)}">woord: ${escapeHtml(question.word)}</option>`,
      )
      .join("");

    return `<section class="panel">
      <h2>Eigen uitspraak</h2>
      <p class="help">Neem losse klanken of woorden op. Een eigen opname krijgt altijd voorrang.</p>
      <div class="field">
        <label for="audio-key">Klank of woord</label>
        <select id="audio-key" class="select">
          ${soundOptions}
          ${wordOptions}
        </select>
      </div>
      <p>
        <button class="action" data-action="record">${icon("mic")} Opnemen</button>
        <label class="action secondary">
          ${icon("upload")} Audio kiezen
          <input id="audio-file" type="file" accept="audio/*" hidden>
        </label>
      </p>
    </section>`;
  }
  function seriesPanel() {
    const list = state.questions
      .map(
        (question, index) =>
          `<div class="series-item series-item-editable">
            <div class="series-order">
              ${iconButton("up", `move-up:${index}`, `Verplaats ${question.word} omhoog`)}
              ${iconButton("down", `move-down:${index}`, `Verplaats ${question.word} omlaag`)}
            </div>
            <div class="series-question">
              <span class="series-word">${escapeHtml(question.word)}</span>
              <div class="series-missing" aria-label="Ontbrekende letters kiezen">
                ${question.graphemes
                  .map(
                    (grapheme, graphemeIndex) =>
                      `<button class="chip missing-choice ${question.missing.includes(graphemeIndex) ? "active" : ""}"
                        data-series-missing="${index}:${graphemeIndex}">${escapeHtml(grapheme)}</button>`,
                  )
                  .join("")}
              </div>
              <label class="question-option">
                <input type="checkbox" data-question-example="${index}"
                  ${question.showCopyWord ? "checked" : ""}>
                Toon voorbeeldwoord
              </label>
              <div class="question-image-tools">
                ${question.image ? `<img class="question-image-preview" src="${escapeHtml(question.image)}" alt="Voorbeeldafbeelding">` : ""}
                <label class="action secondary image-picker">
                  ${icon("upload")} ${question.image ? "Vervang afbeelding" : "Kies afbeelding"}
                  <input type="file" accept="image/*" data-question-image="${index}" hidden>
                </label>
                ${question.image ? `<button class="action secondary" data-remove-image="${index}">Verwijder afbeelding</button>` : ""}
              </div>
            </div>
            <span class="series-pattern">${patternOf(question.word)}</span>
            ${iconButton("close", `remove:${index}`, `Verwijder ${question.word}`)}
          </div>`,
      )
      .join("");

    return `<section class="panel">
      <h2>Huidige dicteereeks</h2>
      <div class="series">
        ${list || '<div class="empty">Nog geen woorden.</div>'}
      </div>
    </section>`;
  }

  function splitGraphemeList(value) {
    return value
      .toLowerCase()
      .split(",")
      .map((grapheme) => grapheme.trim())
      .filter(Boolean);
  }

  function splitBookPartList(value) {
    const parts = value
      .toLowerCase()
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => (part === "-" || part === "leeg" ? "" : part));

    return [...new Set(parts)];
  }

  function formatBookPartList(group) {
    return group.map((part) => part || "-").join(", ");
  }

  function draftBookGroups() {
    return state.clickBookDraftGroups.map(splitBookPartList);
  }

  function validDraftBookGroups(showMessage = true) {
    const groups = draftBookGroups();
    const invalidPart = groups
      .flat()
      .find((part) => part !== "" && !/^[a-z]+$/.test(part));

    if (groups.some((group) => group.length === 0)) {
      if (showMessage) alert("Vul voor elke positie minstens één letter of klank in.");
      return null;
    }
    if (invalidPart) {
      if (showMessage) alert(`Gebruik alleen letters in de posities. Controleer: ${invalidPart}`);
      return null;
    }
    return groups;
  }

  function previewClickBook() {
    const groups = validDraftBookGroups();
    if (!groups) return;

    const entries = makeBookEntries(
      groups,
      state.dictionaryVersion,
      splitGraphemeList(state.bookExcludedWords),
    );
    state.bookPreviewMessage = entries.length
      ? `${entries.length} bestaande woorden gevonden. Voorbeelden: ${entries
          .slice(0, 12)
          .map((entry) => entry.word)
          .join(", ")}${entries.length > 12 ? " …" : ""}`
      : "Geen bestaande Nederlandse woorden gevonden met deze instellingen.";
    manage();
  }

  function downloadWordList() {
    const groups = validDraftBookGroups();
    if (!groups) return;

    const entries = makeBookEntries(
      groups,
      state.dictionaryVersion,
      splitGraphemeList(state.bookExcludedWords),
    );
    if (!entries.length) {
      alert("Er zijn geen bestaande woorden om te exporteren.");
      return;
    }

    const rows = [
      ["woord", "opbouw", "voorgestelde bestandsnaam", "map in GitHub"],
      ...entries.map((entry) => [
        entry.word,
        entry.parts.map((part) => part || "(leeg)").join(" - "),
        `${entry.word}.mp3`,
        `assets/audio/woorden/${entry.word[0]}/`,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(";"),
      )
      .join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${(state.exerciseName || "klikklak").replace(/[^a-z0-9]+/gi, "-")}-inspreeklijst.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function publishPanel() {
    const editingText = state.editingExerciseId
      ? `<div class="edit-notice">Je bewerkt een opgeslagen dictee. Bij opnieuw klaarzetten krijg je een nieuwe link. Vervang daarna de oude link in Genially. De oude link blijft werken.</div>`
      : "";
    const publicationMessage = state.publicationMessage
      ? `<div class="publication-message">${escapeHtml(state.publicationMessage)}</div>`
      : "";

    return `<section class="panel">
      <h2>Oefening klaarzetten</h2>
      ${editingText}
      ${publicationMessage}
      <div class="field">
        <label for="exercise-name">Naam in de leerlijn</label>
        <input
          id="exercise-name"
          class="text-input"
          value="${escapeHtml(state.exerciseName)}"
          placeholder="bijvoorbeeld 1.3 – kip"
        >
      </div>
      <div class="publish-actions">
        <button class="action" data-action="save-dictation">
          ${icon("keyboard")} Dictee klaarzetten
        </button>
      </div>
    </section>`;
  }

  function importClickBookPanel() {
    return `<section class="panel">
      <h2>Boekje uit Excel openen</h2>
      <p class="help">Plak hier de volledige klik-klaklink uit Excel. Alle instellingen worden in het beheer geladen.</p>
      <div class="field">
        <label for="clickbook-link">Klik-klaklink</label>
        <input
          id="clickbook-link"
          class="text-input"
          type="url"
          inputmode="url"
          value="${escapeHtml(state.linkToImport)}"
          placeholder="https://…?wb=v1&amp;woorden=ja&amp;p1=…&amp;p2=…"
        >
      </div>
      <button class="action secondary" data-action="import-clickbook-link">
        Boekje laden in beheer
      </button>
    </section>`;
  }

  function clickBookPanel() {
    const positionFields = state.clickBookDraftGroups
      .map(
        (value, index) => `<div class="book-position-row">
          <div class="field">
            <label for="book-position-${index}">Positie ${index + 1}</label>
            <input
              id="book-position-${index}"
              class="text-input"
              data-book-draft="${index}"
              value="${escapeHtml(value)}"
              placeholder="bijvoorbeeld -, m, k, p"
            >
          </div>
          ${state.clickBookDraftGroups.length > 2 ? iconButton("close", `remove-book-position:${index}`, `Verwijder positie ${index + 1}`) : ""}
        </div>`,
      )
      .join("");

    return `<section class="panel">
      <h2>Klik-klakboekje instellen</h2>
      <p class="help">Scheid letters en clusters met komma's. Gebruik <strong>-</strong> om een positie ook leeg te laten. Een boekje heeft twee tot acht posities.</p>
      <div class="field">
        <label for="exercise-name">Naam van het boekje</label>
        <input
          id="exercise-name"
          class="text-input"
          value="${escapeHtml(state.exerciseName)}"
          placeholder="bijvoorbeeld 1.3A – klik-klak"
        >
      </div>
      <div class="book-position-list">${positionFields}</div>
      ${state.clickBookDraftGroups.length < 8 ? `<button class="action secondary" data-action="add-book-position">${icon("plus")} Positie toevoegen</button>` : ""}
      <label class="check-row">
        <input id="book-only-words" type="checkbox" ${state.onlyExistingWords ? "checked" : ""}>
        Alleen bestaande Nederlandse woorden
      </label>
      <div class="field">
        <label for="book-excluded-words">Woorden uitsluiten</label>
        <input
          id="book-excluded-words"
          class="text-input"
          value="${escapeHtml(state.bookExcludedWords)}"
          placeholder="bijvoorbeeld woord1, woord2"
        >
      </div>
      <p class="help">Woordenboek OpenTaal, versie ${escapeHtml(state.dictionaryVersion)}, maximaal acht letters.</p>
      ${state.bookPreviewMessage ? `<div class="publication-message">${escapeHtml(state.bookPreviewMessage)}</div>` : ""}
      <div class="publish-actions">
        <button class="action secondary" data-action="preview-clickbook">Woorden controleren</button>
        <button class="action secondary" data-action="download-word-list">Inspreeklijst downloaden</button>
        <button class="action" data-action="save-clickbook">
          ${icon("book")} Klik-klakboekje klaarzetten
        </button>
      </div>
    </section>`;
  }

  function savedExercisesPanel() {
    const exerciseList = state.exercises
      .filter((exercise) => exercise.type === "klikklak")
      .map(
        (exercise) => `<div class="exercise-item">
          <div class="exercise-info">
            <strong>${escapeHtml(exercise.name)}</strong>
            <span>${exercise.type === "dictee" ? "Dictee" : "Klik-klak"}</span>
          </div>
          <a class="action secondary" href="${escapeHtml(exercise.url)}" target="_blank">Open</a>
          <button class="action secondary" data-copy-url="${escapeHtml(exercise.url)}">Kopieer link</button>
          <button class="action secondary" data-edit-exercise="${exercise.id}">Bewerk</button>
          <button class="icon-btn" data-delete-exercise="${exercise.id}" aria-label="Verwijder">
            ${icon("close")}
          </button>
        </div>`,
      )
      .join("");

    return `<section class="panel">
      <h2>Klaargezette oefeningen</h2>
      <div class="exercise-list">
        ${exerciseList || '<div class="empty">Nog geen aparte oefeningen.</div>'}
      </div>
    </section>`;
  }

  function manage() {
    app.innerHTML = `${header(false)}
      <main class="teacher">
        <h1>Instellingen klik-klak</h1>
        ${importClickBookPanel()}
        ${clickBookPanel()}
        ${savedExercisesPanel()}
      </main>`;
  }
  function render() {
    const screens = {
      home: home,
      dictation: dictation,
      booklet: booklet,
      manage: manage,
    };

    const selectedScreen = screens[state.mode] || home;
    selectedScreen();
  }

  // ================================================================
  // 6. AUDIO OPNEMEN EN WOORDEN TOEVOEGEN
  // ================================================================

  async function record() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      alert("Opnemen wordt niet ondersteund in deze browser.");
      return;
    }
    if (state.recording) {
      state.recording.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const reader = new FileReader();
        reader.onload = () => {
          const key = document.querySelector("#audio-key")?.value;
          if (key) {
            state.audio[key] = reader.result;
            saveToStorage();
          }
          stream.getTracks().forEach((t) => t.stop());
          state.recording = null;
          manage();
        };
        reader.readAsDataURL(new Blob(chunks, { type: recorder.mimeType }));
      };
      recorder.start();
      state.recording = recorder;
      const b = document.querySelector('[data-action="record"]');
      if (b) b.innerHTML = `${icon("close")} Stop`;
    } catch {
      alert("De microfoon kon niet worden geopend.");
    }
  }
  function addWord(word, missing = null) {
    const graphemes = tokenize(word);
    if (!graphemes.length) return;
    const indexes = missing?.length ? missing : [...graphemes.keys()];
    // Elke toevoeging is een aparte vraag, ook als hetzelfde woord al voorkomt.
    state.questions.push({
      word,
      graphemes,
      missing: indexes,
      showCopyWord: false,
      image: "",
    });
    const isNewCustomWord =
      !DATA.wordBank.includes(word) && !state.customWords.includes(word);

    if (isNewCustomWord) {
      state.customWords.push(word);
    }

    saveToStorage();
  }

  function moveQuestion(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= state.questions.length) return;

    const [question] = state.questions.splice(index, 1);
    state.questions.splice(newIndex, 0, question);
    saveToStorage();
    manage();
  }

  function makeSmallImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("De afbeelding kon niet worden gelezen."));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("Dit afbeeldingsbestand wordt niet ondersteund."));
        image.onload = () => {
          const maximumSize = 360;
          const scale = Math.min(
            1,
            maximumSize / image.naturalWidth,
            maximumSize / image.naturalHeight,
          );
          const width = Math.max(1, Math.round(image.naturalWidth * scale));
          const height = Math.max(1, Math.round(image.naturalHeight * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL("image/webp", 0.7));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function saveExercise(type) {
    const name = state.exerciseName.trim() || `Nieuwe ${type}`;
    let settings;

    if (type === "dictee") {
      settings = {
        type: "dictee",
        name: name,
        questions: state.questions.map((question) => ({
          word: question.word,
          graphemes: [...question.graphemes],
          missing: [...question.missing],
          showCopyWord: question.showCopyWord === true,
          image: question.image || "",
        })),
      };
    } else {
      const groups = validDraftBookGroups();
      if (!groups) return;

      if (
        state.onlyExistingWords &&
        makeBookEntries(
          groups,
          state.dictionaryVersion,
          splitGraphemeList(state.bookExcludedWords),
        ).length === 0
      ) {
        alert("Met deze instellingen zijn geen bestaande woorden mogelijk.");
        return;
      }

      settings = {
        type: "klikklak",
        name: name,
        groups: groups,
        onlyExistingWords: state.onlyExistingWords,
        dictionaryVersion: state.dictionaryVersion,
        excludedWords: splitGraphemeList(state.bookExcludedWords),
      };
    }

    const url = makeExerciseUrl(type, settings);
    state.exercises.push({
      id: Date.now(),
      name: name,
      type: type,
      url: url,
      settings: settings,
    });

    if (state.editingExerciseId) {
      state.publicationMessage =
        "Nieuwe link gemaakt. Vervang de oude link in Genially; de oude link blijft werken.";
    } else {
      state.publicationMessage = "Oefening en link zijn opgeslagen.";
    }
    state.editingExerciseId = null;
    state.exerciseName = "";
    saveToStorage();
    manage();
  }

  // ================================================================
  // 7. GEBEURTENISSEN: TYPEN, KIEZEN EN KLIKKEN
  // ================================================================

  app.addEventListener("input", (e) => {
    if (e.target.id === "draft") {
      // Onthoud waar de cursor stond voordat het scherm opnieuw wordt opgebouwd.
      // Zonder deze stap springt de cursor terug naar het begin en worden nieuwe
      // letters telkens vóór de bestaande tekst geplaatst.
      const cursorPosition = e.target.selectionStart ?? e.target.value.length;

      state.draftWord = e.target.value.toLowerCase();
      state.missingGraphemes.clear();
      manage();

      const refreshedInput = document.querySelector("#draft");
      refreshedInput?.focus();
      refreshedInput?.setSelectionRange(cursorPosition, cursorPosition);
    }

    if (e.target.id === "exercise-name") {
      state.exerciseName = e.target.value;
    }

    if (e.target.id === "clickbook-link") {
      state.linkToImport = e.target.value;
    }

    if (e.target.dataset.questionExample !== undefined) {
      const question = state.questions[Number(e.target.dataset.questionExample)];
      if (question) {
        question.showCopyWord = e.target.checked;
        saveToStorage();
      }
    }

    if (e.target.dataset.bookDraft !== undefined) {
      state.clickBookDraftGroups[Number(e.target.dataset.bookDraft)] =
        e.target.value;
      state.bookPreviewMessage = "";
    }

    if (e.target.id === "book-excluded-words") {
      state.bookExcludedWords = e.target.value;
      state.bookPreviewMessage = "";
    }
  });
  app.addEventListener("change", (e) => {
    if (e.target.id === "book-only-words") {
      state.onlyExistingWords = e.target.checked;
      state.bookPreviewMessage = "";
      return;
    }
    if (e.target.dataset.questionImage !== undefined && e.target.files[0]) {
      const questionIndex = Number(e.target.dataset.questionImage);
      makeSmallImage(e.target.files[0])
        .then((smallImage) => {
          const question = state.questions[questionIndex];
          if (!question) return;
          question.image = smallImage;
          saveToStorage();
          manage();
        })
        .catch((error) => alert(error.message));
      return;
    }
    if (e.target.id === "audio-file" && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        const key = document.querySelector("#audio-key")?.value;
        if (key) {
          state.audio[key] = reader.result;
          saveToStorage();
          manage();
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  });
  app.addEventListener("click", (e) => {
    const target = e.target.closest(
      "button,[data-action],[data-sound],[data-key],[data-book],[data-missing],[data-series-missing],[data-pattern],[data-learned],[data-suggest],[data-copy-url],[data-delete-exercise],[data-edit-exercise],[data-remove-image]",
    );
    if (!target) return;

    if (target.dataset.copyUrl) {
      navigator.clipboard
        .writeText(target.dataset.copyUrl)
        .then(() => {
          target.textContent = "Gekopieerd";
        })
        .catch(() => {
          prompt("Kopieer deze link:", target.dataset.copyUrl);
        });
      return;
    }

    if (target.dataset.deleteExercise) {
      const id = Number(target.dataset.deleteExercise);
      state.exercises = state.exercises.filter(
        (exercise) => exercise.id !== id,
      );
      saveToStorage();
      manage();
      return;
    }
    if (target.dataset.removeImage !== undefined) {
      const question = state.questions[Number(target.dataset.removeImage)];
      if (question) {
        question.image = "";
        saveToStorage();
        manage();
      }
      return;
    }
    if (target.dataset.editExercise) {
      const id = Number(target.dataset.editExercise);
      const exercise = state.exercises.find((item) => item.id === id);
      if (!exercise) return;

      // Oudere opgeslagen oefeningen hadden nog geen apart settings-veld.
      const settings =
        exercise.settings || decodeExerciseFromUrlString(exercise.url);
      if (!settings) {
        alert("Deze oefening kon niet worden ingelezen.");
        return;
      }

      if (settings.type === "klikklak" || settings.groups) {
        state.clickBookDraftGroups = settings.groups.map(formatBookPartList);
        state.onlyExistingWords = settings.onlyExistingWords === true;
        state.dictionaryVersion = settings.dictionaryVersion || "v1";
        state.bookExcludedWords = (settings.excludedWords || []).join(", ");
        state.bookPreviewMessage = "";
      } else if (settings.questions) {
        state.questions = settings.questions.map((question) => ({
          word: question.word,
          graphemes: [...question.graphemes],
          missing: [...question.missing],
          showCopyWord:
            question.showCopyWord ?? (settings.showCopyWord === true),
          image: question.image || "",
        }));
      } else {
        alert("Deze oefening kon niet worden ingelezen.");
        return;
      }
      state.exerciseName = exercise.name;
      state.editingExerciseId = id;
      state.publicationMessage = "";
      saveToStorage();
      manage();
      return;
    }
    if (target.dataset.key && !state.result) {
      state.typed += target.dataset.key;

      const expectedAnswer = getExpectedAnswer();
      const answerIsComplete = state.typed.length >= expectedAnswer.length;

      if (answerIsComplete) {
        const answerIsCorrect = state.typed === expectedAnswer;
        state.result = answerIsCorrect ? "good" : "wrong";
      }

      dictation();
      return;
    }
    if (target.dataset.sound) {
      speak(
        target.dataset.sound,
        target.dataset.audioKey || `sound:${target.dataset.sound}`,
        target.dataset.wordParts?.split(",").filter(Boolean) || [],
      );
      return;
    }
    if (target.dataset.book !== undefined) {
      const columnIndex = Number(target.dataset.book);
      const groups = state.bookGroups;
      const group = groups[columnIndex];
      const direction = Number(target.dataset.delta);

      if (state.onlyExistingWords && state.bookEntries?.length) {
        const current = state.bookEntries[state.bookEntryIndex];
        const currentPartIndex = Math.max(
          0,
          group.indexOf(current.parts[columnIndex]),
        );

        for (let offset = 1; offset <= group.length; offset += 1) {
          const nextPart =
            group[
              (currentPartIndex + direction * offset + group.length * 2) %
                group.length
            ];
          const candidates = state.bookEntries.filter(
            (entry) => entry.parts[columnIndex] === nextPart,
          );
          if (!candidates.length) continue;

          candidates.sort((left, right) => {
            const leftMatches = left.parts.filter(
              (part, index) => index !== columnIndex && part === current.parts[index],
            ).length;
            const rightMatches = right.parts.filter(
              (part, index) => index !== columnIndex && part === current.parts[index],
            ).length;
            return rightMatches - leftMatches;
          });
          state.bookEntryIndex = state.bookEntries.indexOf(candidates[0]);
          break;
        }
      } else {
        state.bookPositions[columnIndex] =
          (state.bookPositions[columnIndex] + direction + group.length) %
          group.length;
      }

      booklet();
      return;
    }
    if (target.dataset.missing !== undefined) {
      const index = Number(target.dataset.missing);

      if (state.missingGraphemes.has(index)) {
        state.missingGraphemes.delete(index);
      } else {
        state.missingGraphemes.add(index);
      }

      manage();
      return;
    }
    if (target.dataset.seriesMissing) {
      const [questionIndex, graphemeIndex] = target.dataset.seriesMissing
        .split(":")
        .map(Number);
      const question = state.questions[questionIndex];
      if (!question) return;

      if (question.missing.includes(graphemeIndex)) {
        if (question.missing.length > 1) {
          question.missing = question.missing.filter(
            (index) => index !== graphemeIndex,
          );
        }
      } else {
        question.missing = [...question.missing, graphemeIndex].sort(
          (a, b) => a - b,
        );
      }
      saveToStorage();
      manage();
      return;
    }
    if (target.dataset.pattern) {
      state.pattern = target.dataset.pattern;
      manage();
      return;
    }
    if (target.dataset.learned) {
      const grapheme = target.dataset.learned;

      if (state.learnedGraphemes.has(grapheme)) {
        state.learnedGraphemes.delete(grapheme);
      } else {
        state.learnedGraphemes.add(grapheme);
      }

      manage();
      return;
    }
    if (target.dataset.suggest) {
      addWord(target.dataset.suggest);
      manage();
      return;
    }
    const action = target.dataset.action;
    if (action?.startsWith("remove-book-position:")) {
      const index = Number(action.split(":")[1]);
      if (state.clickBookDraftGroups.length > 2) {
        state.clickBookDraftGroups.splice(index, 1);
        state.bookPreviewMessage = "";
        manage();
      }
    } else if (action === "add-book-position") {
      if (state.clickBookDraftGroups.length < 8) {
        state.clickBookDraftGroups.push("");
        state.bookPreviewMessage = "";
        manage();
      }
    } else if (action === "preview-clickbook") {
      previewClickBook();
    } else if (action === "import-clickbook-link") {
      const settings = decodeExerciseFromUrlString(state.linkToImport.trim());
      if (!settings || !(settings.type === "klikklak" || settings.groups)) {
        alert("Deze klik-klaklink kon niet worden ingelezen. Kopieer de volledige link uit Excel.");
        return;
      }

      state.clickBookDraftGroups = settings.groups.map(formatBookPartList);
      state.onlyExistingWords = settings.onlyExistingWords === true;
      state.dictionaryVersion = settings.dictionaryVersion || "v1";
      state.bookExcludedWords = (settings.excludedWords || []).join(", ");
      state.exerciseName = settings.name || "Klik-klakboekje";
      state.editingExerciseId = null;
      state.bookPreviewMessage = "De Excel-link is geladen. Je kunt het boekje nu controleren, aanpassen of de inspreeklijst downloaden.";
      state.publicationMessage = "";
      state.linkToImport = "";
      manage();
    } else if (action === "download-word-list") {
      downloadWordList();
    } else if (action === "home") {
      state.mode = "home";
      render();
    } else if (action === "manage") {
      state.mode = "manage";
      render();
    } else if (action === "dictation") {
      state.mode = "dictation";
      state.currentQuestionIndex = 0;
      state.typed = "";
      state.result = "";
      render();
    } else if (action === "booklet") {
      state.mode = "booklet";
      render();
    } else if (action === "speak-word") {
      const question = getCurrentQuestion();
      speak(question.word, `word:${question.word}`);
    } else if (action === "erase" && !state.result) {
      state.typed = state.typed.slice(0, -1);
      dictation();
    } else if (action === "retry") {
      state.typed = "";
      state.result = "";
      dictation();
    } else if (action === "next-question") {
      if (state.currentQuestionIndex >= state.questions.length - 1) return;
      state.currentQuestionIndex += 1;
      state.typed = "";
      state.result = "";
      dictation();
    } else if (action === "restart-dictation") {
      state.currentQuestionIndex = 0;
      state.typed = "";
      state.result = "";
      dictation();
    } else if (action === "add-manual") {
      const wordIsFilledIn = Boolean(state.draftWord);
      const missingPartIsSelected = state.missingGraphemes.size > 0;

      if (wordIsFilledIn && missingPartIsSelected) {
        addWord(
          state.draftWord,
          [...state.missingGraphemes].sort((a, b) => a - b),
        );
        state.draftWord = "";
        state.missingGraphemes.clear();
        manage();
      }
    } else if (action?.startsWith("remove:")) {
      state.questions.splice(Number(action.split(":")[1]), 1);
      state.currentQuestionIndex = 0;
      saveToStorage();
      manage();
    } else if (action?.startsWith("move-up:")) {
      moveQuestion(Number(action.split(":")[1]), -1);
    } else if (action?.startsWith("move-down:")) {
      moveQuestion(Number(action.split(":")[1]), 1);
    } else if (action === "record") {
      record();
    } else if (action === "save-dictation") {
      saveExercise("dictee");
    } else if (action === "save-clickbook") {
      saveExercise("klikklak");
    }
  });

  // Start de app voor de eerste keer op.
  render();
})();
