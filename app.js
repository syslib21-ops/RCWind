(function () {
  /**
   * @typedef {{ id: string, label: string, title: (ks: string[]) => string, open: (ks: string[]) => string[], keywordBlock: (k: string, index: number, total: number) => string[], close: (ks: string[]) => string[] }} Tone
   */

  /** @type {Record<string, Tone>} */
  const TONES = {
    soft: {
      id: "soft",
      label: "부드럽게",
      title: (ks) =>
        ks.length === 1
          ? `[안내] ${ks[0]} 관련해서 말씀드려요`
          : `[안내] ${ks[0]} 외 ${ks.length - 1}건, 차례로 말씀드려요`,
      open: (ks) => [
        "안녕하세요, 운영진입니다. 🌿",
        "",
        ks.length > 1
          ? "아래는 입력해 주신 순서대로, 한 줄씩 안내 말씀을 이어 가겠습니다. 📝"
          : "가볍게 읽어 주시면 감사하겠습니다. 🙂",
        "",
      ],
      keywordBlock: (k, index, total) => {
        const n = index + 1;
        return [
          `📌 ${n}/${total} · ${k}`,
          "",
          `${k}에 관심 가져 주셔서 고마워요. 카페에서 참고하시면 좋을 내용을 조용히 정리해 보았습니다.`,
          "",
          "댓글이나 쪽지로 편하게 물어봐 주셔도 괜찮아요. 💬",
          "",
        ];
      },
      close: () => [
        "서로를 배려하는 마음으로 소통해 주시면 감사하겠습니다. 🤝",
        "공지 외에도 카페 규칙을 한 번씩만 둘러봐 주시면 큰 도움이 됩니다.",
        "",
        "늘 와 주셔서 고맙습니다. 좋은 하루 보내세요. ✨",
      ],
    },
    warm: {
      id: "warm",
      label: "다정하게",
      title: (ks) =>
        ks.length === 1
          ? `[공지] ${ks[0]} 함께해 주셔서 고마워요`
          : `[공지] ${ks[0]}부터 차례로, 마음 담아 안내할게요`,
      open: (ks) => [
        "소중한 회원 여러분, 안녕하세요! 운영진이에요. 💛",
        "",
        ks.length > 1
          ? "적어 주신 순서 그대로, 한 줄마다 우리 이야기를 이어 갈게요. ✨"
          : "오늘은 이 이야기를 나누고 싶어 공지를 써 봤어요. 🌸",
        "",
      ],
      keywordBlock: (k, index, total) => {
        const n = index + 1;
        return [
          `💕 ${n}번째 이야기: ${k}`,
          "",
          `${k}, 정말 기대되고 설레는 주제예요. 여러분과 함께할 수 있어서 행복합니다. 🥰`,
          "",
          "막히는 점이 있으면 언제든 말해 주세요. 같이 풀어 가요! 🙌",
          "",
        ];
      },
      close: () => [
        "앞으로도 서로 응원하며 따뜻한 카페를 만들어 가요. 🌷",
        "",
        "항상 건강하시고, 오늘도 행복한 하루 되세요. 사랑합니다! 💖",
      ],
    },
    polite: {
      id: "polite",
      label: "정중하게",
      title: (ks) =>
        ks.length === 1
          ? `[공지] ${ks[0]} 관련 안내 말씀드립니다`
          : `[공지] ${ks[0]} 외 복수 항목 순차 안내 말씀드립니다`,
      open: (ks) => [
        "안녕하십니까. 카페 운영진입니다. 📋",
        "",
        ks.length > 1
          ? "회원 여러분께서 기재해 주신 항목을 위에서부터 순서대로 안내해 드리겠습니다. ✔"
          : "아래와 같이 안내 말씀을 드리고자 합니다. ✔",
        "",
      ],
      keywordBlock: (k, index, total) => {
        const n = index + 1;
        return [
          `【${n}/${total}】 ${k} 📌`,
          "",
          `상기 사항(${k})과 관련하여 회원 여러분께 참고하실 내용을 말씀드립니다.`,
          "",
          "본 카페 규정 및 타 공지와 함께 검토해 주시기 바랍니다.",
          "",
          "문의 사항이 있으시면 댓글 또는 쪽지로 연락을 주시면 성심껏 답변 드리겠습니다. ✉",
          "",
        ];
      },
      close: () => [
        "바쁘신 와중에도 공지를 읽어 주셔서 감사드립니다.",
        "앞으로도 많은 관심 부탁드립니다.",
        "",
        "감사합니다. 🙇",
      ],
    },
  };

  const KEYWORDS_DEFAULT_URL = "/defaults/keywords-base.txt";
  const KEYWORDS_FALLBACK_TEXT =
    "봄맞이 이벤트 안내\n정기 모임 일정\n가입 인사 방법\n";

  const keywordsInput = document.getElementById("keywords");
  const keywordSource = document.getElementById("keywordSource");
  const btnPickKeywordFile = document.getElementById("btnPickKeywordFile");
  const keywordFileInput = document.getElementById("keywordFile");
  const modelSelect = document.getElementById("modelSelect");
  const modelCustom = document.getElementById("modelCustom");
  const toneRadios = document.querySelectorAll('input[name="tone"]');
  const btnGenerate = document.getElementById("btnGenerate");
  const btnSave = document.getElementById("btnSave");
  const resultSection = document.getElementById("resultSection");
  const toneBadge = document.getElementById("toneBadge");
  const metaLine = document.getElementById("metaLine");
  const outputEl = document.getElementById("output");

  const btnPickShortsImages = document.getElementById("btnPickShortsImages");
  const btnClearShortsImages = document.getElementById("btnClearShortsImages");
  const shortsImagesInput = document.getElementById("shortsImages");
  const shortsImagePreview = document.getElementById("shortsImagePreview");
  const shortsImageMeta = document.getElementById("shortsImageMeta");
  const btnPickShortsAudio = document.getElementById("btnPickShortsAudio");
  const btnClearShortsAudio = document.getElementById("btnClearShortsAudio");
  const shortsAudioInput = document.getElementById("shortsAudio");
  const shortsAudioMeta = document.getElementById("shortsAudioMeta");
  const btnShortsGenerate = document.getElementById("btnShortsGenerate");
  const btnShortsSave = document.getElementById("btnShortsSave");
  const shortsVideoWrap = document.getElementById("shortsVideoWrap");
  const shortsPreview = document.getElementById("shortsPreview");

  /**
   * 현재 공지 편집 상자 내용(앞뒤 공백 제외).
   * @returns {string}
   */
  function getNoticeBodyTrimmed() {
    return outputEl.value.replace(/^\s+|\s+$/g, "");
  }

  /**
   * 공지 본문이 있을 때만 저장·네이버용 복사 활성화.
   * id로 매번 찾아서(캐시된 참조와 DOM 불일치 방지) disabled 속성까지 맞춥니다.
   * @param {boolean} enabled
   */
  function setNoticeExportButtonsEnabled(enabled) {
    for (const id of ["btnSave", "btnCopyPlain"]) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.disabled = !enabled;
      if (enabled) {
        el.removeAttribute("disabled");
      } else {
        el.setAttribute("disabled", "disabled");
      }
    }
  }

  /** @type {File[]} */
  let shortsImageFiles = [];
  /** @type {File | null} */
  let shortsAudioFile = null;
  /** @type {string[]} */
  let shortsThumbObjectUrls = [];
  /** @type {Blob | null} */
  let lastShortsBlob = null;
  /** @type {string | null} */
  let lastShortsPreviewUrl = null;

  function parseKeywordLines(raw) {
    return raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function getSelectedToneId() {
    for (const r of toneRadios) {
      if (r.checked) return r.value;
    }
    return "warm";
  }

  function getTone() {
    return TONES[getSelectedToneId()] || TONES.warm;
  }

  /**
   * @param {string[]} keywords
   * @param {Tone} tone
   */
  function buildNoticeOffline(keywords, tone) {
    const title = tone.title(keywords);
    const parts = [title, "", ...tone.open(keywords)];
    for (let i = 0; i < keywords.length; i++) {
      parts.push(...tone.keywordBlock(keywords[i], i, keywords.length));
    }
    parts.push(...tone.close(keywords));
    return parts.join("\n");
  }

  /** 로컬 기준 YYYYMMDD */
  function saveDatePrefix() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  }

  /** 저장 제안 파일명: 버튼 표시 문자열에서 공백·금지 문자만 정리 */
  function sanitizeSaveButtonLabel(label) {
    const s = String(label || "")
      .trim()
      .replace(/[/\\?%*:|"<>]/g, "_")
      .replace(/\s+/g, "")
      .replace(/\u200b/g, "");
    return s.slice(0, 100) || "저장";
  }

  /**
   * @param {string} buttonLabel 버튼에 보이는 명칭
   * @param {string} extension ".txt" | ".mp4" 등
   */
  function buildDatedSaveFilename(buttonLabel, extension) {
    const ext = extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
    return `${saveDatePrefix()}_${sanitizeSaveButtonLabel(buttonLabel)}${ext}`;
  }

  function stripBom(text) {
    return text.length > 0 && text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  }

  function setKeywordSourceLabel(label) {
    keywordSource.textContent = label;
    keywordSource.title = label;
  }

  async function loadDefaultKeywordsFromServer() {
    try {
      const r = await fetch(KEYWORDS_DEFAULT_URL, { cache: "no-cache" });
      if (!r.ok) throw new Error(String(r.status));
      let t = await r.text();
      t = stripBom(t).replace(/\r\n/g, "\n");
      keywordsInput.value = t;
      setKeywordSourceLabel("기본: defaults/keywords-base.txt");
    } catch {
      keywordsInput.value = stripBom(KEYWORDS_FALLBACK_TEXT).replace(/\r\n/g, "\n");
      setKeywordSourceLabel("기본: 내장(서버 미연결)");
    }
  }

  /**
   * @param {string} text
   */
  async function copyPlainTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("복사에 실패했습니다.");
  }

  function downloadText(filename, text) {
    const bom = "\uFEFF";
    const blob = new Blob([bom + text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * @param {string} text
   * @param {string} suggestedName
   */
  async function saveTextWithLocation(text, suggestedName) {
    const safeSuggest = (suggestedName || "naver-cafe-notice.txt").replace(/[/\\?%*:|"<>]/g, "_");
    const blob = new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8" });

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: safeSuggest,
          types: [
            {
              description: "텍스트 파일",
              accept: { "text/plain": [".txt"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (e) {
        if (e && typeof e === "object" && "name" in e && e.name === "AbortError") return;
        console.warn(e);
      }
    }

    const fallback = prompt(
      "저장할 파일 이름을 입력하세요.\n(이 브라우저는 저장 폴더 선택을 지원하지 않습니다. 기본 다운로드 폴더에 저장됩니다.)",
      safeSuggest
    );
    if (fallback === null) return;
    const trimmed = fallback.trim();
    if (!trimmed) return;
    const name = /\.(txt|text)$/i.test(trimmed) ? trimmed : `${trimmed}.txt`;
    downloadText(name, text);
  }

  function revokeShortsPreviewUrl() {
    if (lastShortsPreviewUrl) {
      URL.revokeObjectURL(lastShortsPreviewUrl);
      lastShortsPreviewUrl = null;
    }
  }

  function clearShortsGenerated() {
    revokeShortsPreviewUrl();
    shortsPreview.removeAttribute("src");
    shortsVideoWrap.hidden = true;
    lastShortsBlob = null;
    btnShortsSave.disabled = true;
    updateShortsGenerateEnabled();
  }

  /** 음원 없이 사진만 있어도 Shorts 생성 가능 */
  function updateShortsGenerateEnabled() {
    btnShortsGenerate.disabled = shortsImageFiles.length === 0;
  }

  function clearShortsThumbDragStyles() {
    shortsImagePreview.querySelectorAll(".shorts-thumb-cell").forEach((el) => {
      el.classList.remove("shorts-thumb-dragover", "shorts-thumb-dragging");
    });
  }

  /**
   * @param {number} fromIndex
   * @param {number} toIndex 드롭한 위치(원래 배열 기준 인덱스)
   */
  function reorderShortsImages(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const len = shortsImageFiles.length;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= len || toIndex >= len) return;
    const next = shortsImageFiles.slice();
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    shortsImageFiles = next;
    clearShortsGenerated();
    renderShortsThumbs();
  }

  function renderShortsThumbs() {
    for (const u of shortsThumbObjectUrls) {
      URL.revokeObjectURL(u);
    }
    shortsThumbObjectUrls = [];
    shortsImagePreview.innerHTML = "";
    const n = shortsImageFiles.length;
    shortsImagePreview.hidden = n === 0;
    btnClearShortsImages.disabled = n === 0;
    if (n > 0) {
      shortsImagePreview.setAttribute("role", "list");
      shortsImagePreview.setAttribute("aria-label", "Shorts 컷 순서");
    } else {
      shortsImagePreview.removeAttribute("role");
      shortsImagePreview.removeAttribute("aria-label");
    }
    for (let i = 0; i < n; i++) {
      const f = shortsImageFiles[i];
      const cell = document.createElement("div");
      cell.className = "shorts-thumb-cell";
      cell.setAttribute("role", "listitem");
      cell.draggable = true;
      cell.dataset.index = String(i);
      cell.title = "드래그하여 순서 변경";

      const order = document.createElement("span");
      order.className = "shorts-thumb-order";
      order.textContent = String(i + 1);

      const img = document.createElement("img");
      img.className = "shorts-thumb";
      img.alt = "";
      img.draggable = false;
      img.loading = "lazy";
      const u = URL.createObjectURL(f);
      shortsThumbObjectUrls.push(u);
      img.src = u;

      cell.addEventListener("dragstart", (e) => {
        if (!e.dataTransfer) return;
        cell.classList.add("shorts-thumb-dragging");
        e.dataTransfer.setData("text/plain", cell.dataset.index || "0");
        e.dataTransfer.effectAllowed = "move";
      });

      cell.addEventListener("dragend", () => {
        clearShortsThumbDragStyles();
      });

      cell.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        shortsImagePreview.querySelectorAll(".shorts-thumb-dragover").forEach((el) => {
          el.classList.remove("shorts-thumb-dragover");
        });
        cell.classList.add("shorts-thumb-dragover");
      });

      cell.addEventListener("dragleave", (e) => {
        if (!cell.contains(/** @type {Node | null} */ (e.relatedTarget))) {
          cell.classList.remove("shorts-thumb-dragover");
        }
      });

      cell.addEventListener("drop", (e) => {
        e.preventDefault();
        clearShortsThumbDragStyles();
        const raw = e.dataTransfer ? e.dataTransfer.getData("text/plain") : "";
        const from = parseInt(raw, 10);
        const to = parseInt(cell.dataset.index || "0", 10);
        if (!Number.isFinite(from) || !Number.isFinite(to)) return;
        reorderShortsImages(from, to);
      });

      cell.appendChild(order);
      cell.appendChild(img);
      shortsImagePreview.appendChild(cell);
    }
    shortsImageMeta.textContent = n === 0 ? "" : `선택 ${n}장`;
    updateShortsGenerateEnabled();
  }

  /**
   * @param {Blob} blob
   * @param {string} suggestedName
   */
  async function saveShortsWithLocation(blob, suggestedName) {
    const base = (suggestedName || "shorts.mp4").replace(/[/\\?%*:|"<>]/g, "_");
    const safe = /\.mp4$/i.test(base) ? base : `${base}.mp4`;

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: safe,
          types: [{ description: "MP4 동영상", accept: { "video/mp4": [".mp4"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (e) {
        if (e && typeof e === "object" && "name" in e && e.name === "AbortError") return;
        console.warn(e);
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = safe;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function syncModelCustomVisibility() {
    const custom = modelSelect.value === "__custom__";
    modelCustom.hidden = !custom;
    if (custom) modelCustom.focus();
  }

  /**
   * @returns {string | null} null이면 서버 기본(OPENAI_MODEL) 사용
   */
  function getModelForRequest() {
    const v = modelSelect.value;
    if (v === "") return null;
    if (v === "__custom__") return modelCustom.value.trim() || null;
    return v;
  }

  /**
   * @param {string[]} keywords
   * @param {string} toneId
   * @param {string | null} model
   */
  async function generateWithModel(keywords, toneId, model) {
    const payload = { keywords, tone: toneId };
    if (model) payload.model = model;
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      throw {
        message:
          typeof data.detail === "string" ? data.detail : res.statusText || "요청 실패",
        httpStatus: res.status,
      };
    }
    if (!data.notice || typeof data.notice !== "string") {
      throw new Error("서버 응답에 공지 본문이 없습니다.");
    }
    return data;
  }

  loadDefaultKeywordsFromServer();

  btnPickShortsImages.addEventListener("click", () => {
    shortsImagesInput.click();
  });

  shortsImagesInput.addEventListener("change", () => {
    const list = shortsImagesInput.files ? Array.from(shortsImagesInput.files) : [];
    shortsImageFiles = list;
    clearShortsGenerated();
    renderShortsThumbs();
    shortsImagesInput.value = "";
  });

  btnClearShortsImages.addEventListener("click", () => {
    shortsImageFiles = [];
    clearShortsGenerated();
    renderShortsThumbs();
  });

  btnPickShortsAudio.addEventListener("click", () => {
    shortsAudioInput.click();
  });

  shortsAudioInput.addEventListener("change", () => {
    const f = shortsAudioInput.files && shortsAudioInput.files[0];
    shortsAudioFile = f || null;
    btnClearShortsAudio.disabled = !shortsAudioFile;
    shortsAudioMeta.textContent = shortsAudioFile
      ? `${shortsAudioFile.name} · ${(shortsAudioFile.size / (1024 * 1024)).toFixed(2)} MB`
      : "";
    clearShortsGenerated();
    updateShortsGenerateEnabled();
    shortsAudioInput.value = "";
  });

  btnClearShortsAudio.addEventListener("click", () => {
    shortsAudioFile = null;
    shortsAudioMeta.textContent = "";
    btnClearShortsAudio.disabled = true;
    clearShortsGenerated();
    updateShortsGenerateEnabled();
  });

  btnShortsGenerate.addEventListener("click", async () => {
    if (!shortsImageFiles.length) return;
    const prevLabel = btnShortsGenerate.textContent;
    btnShortsGenerate.disabled = true;
    btnShortsGenerate.textContent = "생성 중…";
    try {
      const form = new FormData();
      for (const f of shortsImageFiles) {
        form.append("images", f, f.name);
      }
      if (shortsAudioFile) {
        form.append("audio", shortsAudioFile, shortsAudioFile.name);
      }
      const res = await fetch("/api/shorts", { method: "POST", body: form });
      if (!res.ok) {
        let detail = res.statusText || "요청 실패";
        try {
          const j = await res.json();
          if (typeof j.detail === "string") detail = j.detail;
          else if (Array.isArray(j.detail)) detail = j.detail.map((x) => x.msg || x).join("\n");
        } catch {
          /* ignore */
        }
        alert(detail);
        return;
      }
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: "video/mp4" });
      if (!blob.size) {
        alert("서버에서 빈 응답을 받았습니다.");
        return;
      }
      revokeShortsPreviewUrl();
      lastShortsBlob = blob;
      lastShortsPreviewUrl = URL.createObjectURL(blob);
      shortsPreview.src = lastShortsPreviewUrl;
      shortsVideoWrap.hidden = false;
      btnShortsSave.disabled = false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
        alert("서버에 연결할 수 없습니다. 같은 주소에서 serve.py(uvicorn)를 실행했는지 확인해 주세요.");
      } else {
        alert(msg);
      }
    } finally {
      btnShortsGenerate.textContent = prevLabel;
      updateShortsGenerateEnabled();
    }
  });

  btnShortsSave.addEventListener("click", async () => {
    if (!lastShortsBlob) return;
    await saveShortsWithLocation(
      lastShortsBlob,
      buildDatedSaveFilename(btnShortsSave.textContent.trim(), ".mp4")
    );
  });

  modelSelect.addEventListener("change", syncModelCustomVisibility);
  syncModelCustomVisibility();

  btnPickKeywordFile.addEventListener("click", () => {
    keywordFileInput.click();
  });

  keywordFileInput.addEventListener("change", () => {
    const f = keywordFileInput.files && keywordFileInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      let t = String(reader.result);
      t = stripBom(t).replace(/\r\n/g, "\n");
      keywordsInput.value = t;
      setKeywordSourceLabel(`파일: ${f.name}`);
    };
    reader.onerror = () => {
      alert("파일을 읽는 중 오류가 발생했습니다.");
    };
    reader.readAsText(f, "UTF-8");
    keywordFileInput.value = "";
  });

  keywordsInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      btnGenerate.click();
    }
  });

  btnGenerate.addEventListener("click", async () => {
    const keywords = parseKeywordLines(keywordsInput.value);
    if (keywords.length === 0) {
      alert("키워드를 한 줄 이상 입력해 주세요.");
      keywordsInput.focus();
      return;
    }

    const toneId = getSelectedToneId();
    const tone = getTone();
    if (modelSelect.value === "__custom__" && !modelCustom.value.trim()) {
      alert("모델을 직접 입력하려면 입력란에 모델 ID를 적어 주세요.");
      modelCustom.focus();
      return;
    }
    const modelForApi = getModelForRequest();
    const baseLabel = `톤: ${tone.label} · 항목 ${keywords.length}줄${
      modelForApi ? ` · 모델 ${modelForApi}` : " · 모델 기본값"
    }`;

    const prevLabel = btnGenerate.textContent;
    btnGenerate.disabled = true;
    btnGenerate.textContent = "생성 중…";
    setNoticeExportButtonsEnabled(false);

    let body = "";
    let badgeExtra = "";
    let metaExtra = "";

    try {
      try {
        const data = await generateWithModel(keywords, toneId, modelForApi);
        body = data.notice.trim();
        badgeExtra = " · AI 문구";
        metaExtra = data.model ? ` · 모델 ${data.model}` : "";
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : typeof e === "object" && e !== null && "message" in e
              ? String(/** @type {{ message: unknown }} */ (e).message)
              : String(e);
        const status =
          typeof e === "object" && e !== null && "httpStatus" in e
            ? /** @type {{ httpStatus: unknown }} */ (e).httpStatus
            : undefined;

        const network =
          e instanceof TypeError ||
          /Failed to fetch|NetworkError|Load failed/i.test(msg);

        if (network || status === 503) {
          body = buildNoticeOffline(keywords, tone);
          badgeExtra = network ? " · 오프라인 초안" : " · 오프라인 초안(API 미설정)";
          metaExtra = network
            ? " · 같은 주소의 서버(serve.py)를 띄웠는지 확인하세요."
            : " · OPENAI_API_KEY를 설정하면 AI 문구로 생성됩니다.";
        } else {
          alert(msg);
          btnGenerate.textContent = prevLabel;
          btnGenerate.disabled = false;
          return;
        }
      }

      toneBadge.textContent = baseLabel + badgeExtra;
      const now = new Date();
      metaLine.textContent = `생성 시각 ${now.toLocaleString("ko-KR")}${metaExtra}`;
      outputEl.value = body;
      resultSection.hidden = false;
      setNoticeExportButtonsEnabled(!!getNoticeBodyTrimmed());
      updateShortsGenerateEnabled();
    } finally {
      btnGenerate.textContent = prevLabel;
      btnGenerate.disabled = false;
    }
  });

  btnSave.addEventListener("click", async () => {
    const text = getNoticeBodyTrimmed();
    if (!text) return;
    await saveTextWithLocation(text, buildDatedSaveFilename(btnSave.textContent.trim(), ".txt"));
  });

  const copyPlainBtn = document.getElementById("btnCopyPlain");
  if (copyPlainBtn) {
    copyPlainBtn.addEventListener("click", async () => {
      const text = getNoticeBodyTrimmed();
      if (!text) return;
      const prev = copyPlainBtn.textContent;
      try {
        await copyPlainTextToClipboard(text);
        copyPlainBtn.textContent = "복사됨";
        setTimeout(() => {
          copyPlainBtn.textContent = prev;
        }, 1600);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        alert(
          `클립보드 복사에 실패했습니다: ${msg}\n` +
            "메모장에 붙여 넣은 뒤 다시 복사하거나, https 주소에서 이 페이지를 여세요."
        );
      }
    });
  }

  outputEl.addEventListener("input", () => {
    setNoticeExportButtonsEnabled(!!getNoticeBodyTrimmed());
  });

  updateShortsGenerateEnabled();
  setNoticeExportButtonsEnabled(!!getNoticeBodyTrimmed());
})();
