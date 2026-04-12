"""
로컬 웹 서버: 정적 파일 + /api/generate (OpenAI 호환 Chat Completions).
공지 문구 생성에는 대화형 언어 모델(gpt-4o-mini 등)을 사용합니다.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

load_dotenv()

ROOT = Path(__file__).resolve().parent
DEFAULTS_DIR = ROOT / "defaults"
DEFAULTS_DIR.mkdir(parents=True, exist_ok=True)

SYSTEM_PROMPT = """당신은 네이버 카페 운영 공지문 작성에 특화된 전문 카피라이터(문구 에이전트)입니다.
규칙:
- 회원을 배려하는 톤을 유지하고, 과한 약속·단정적 법률 표현·허위 가능성이 있는 내용은 쓰지 않습니다.
- 첫 줄은 공지 제목 한 줄입니다. ([공지] 또는 [안내] 등 상황에 맞게 선택)
- 본문은 한국어 존댓말로 일관되게 작성합니다. 문단 사이는 빈 줄 하나로 구분합니다.
- 사용자가 제시한 항목(키워드)는 **입력된 순서를 절대 바꾸지 말고**, 위에서부터 번호나 소제목으로 나누어 차례대로 다룹니다.
- 말투 지시에 맞춥니다:
  · 다정하게: 따뜻하고 친근하며 감사와 응원이 자연스럽게 드러나게.
  · 정중하게: 격식 있는 문어체(~습니다/드립니다), 절제된 표현.
  · 부드럽게: 부담을 줄이는 온화한 어조, 짧은 호흡의 문장을 선호.
- 마지막에 문의 방법(댓글·쪽지 등)을 한 번 정도 안내해도 됩니다.
- 이모티콘(이모지)은 카페 공지에 어울리게 **적당히만** 사용합니다(문단마다 쓰지 말고, 남발·유행어·과한 장식 금지).
  · 다정하게: 친근한 느낌을 살리는 정도(예: 💛✨ 등 소량).
  · 부드럽게: 부담 없이 은은하게(예: 🌿💬 등 가끔).
  · 정중하게: 격을 해치지 않게 아주 적게(예: 📋✔ 등 안내 강조용으로만).
출력은 **공지 본문만** 출력합니다. 사전 설명·JSON·따옴표로 감싼 인용은 하지 마세요."""


# OpenAI·호환 API 배포명(슬래시·콜론 등) 허용
_MODEL_ID_RE = re.compile(r"^[a-zA-Z0-9._/:-]{1,128}$")


class GenerateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    keywords: list[str] = Field(..., min_length=1)
    tone: Literal["warm", "polite", "soft"]
    # JSON 키는 "model" — 파이썬 예약/충돌 방지를 위해 chat_model로 보관
    chat_model: str | None = Field(
        default=None,
        alias="model",
        description="비우면 서버 환경 변수 OPENAI_MODEL(없으면 gpt-4o-mini) 사용",
        max_length=128,
    )


TONE_LABEL = {"warm": "다정하게", "polite": "정중하게", "soft": "부드럽게"}


def build_user_prompt(keywords: list[str], tone: str) -> str:
    label = TONE_LABEL[tone]
    lines = "\n".join(f"{i + 1}. {kw}" for i, kw in enumerate(keywords))
    return f"""말투: {label}

항목(순서 고정 — 1번이 공지 상단에 가장 먼저 다뤄져야 함):
{lines}

위 순서를 지켜 한 편의 네이버 카페 공지문을 작성하세요."""


def resolve_chat_model(requested: str | None) -> str:
    if requested is None:
        return os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    s = requested.strip()
    if not s:
        return os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    if not _MODEL_ID_RE.fullmatch(s):
        raise HTTPException(
            status_code=400,
            detail="모델 이름 형식이 올바르지 않습니다. 영문·숫자·._/:- 만 사용할 수 있습니다.",
        )
    return s


async def call_chat_model(user_content: str, model: str) -> str:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY 환경 변수가 없습니다. 프로젝트 루트에 .env 파일을 두거나 OS 환경 변수로 API 키를 설정하세요.",
        )

    base = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    url = f"{base}/chat/completions"

    payload = {
        "model": model,
        "temperature": 0.65,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(url, json=payload, headers=headers)
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPStatusError as e:
        msg = e.response.text[:500] if e.response is not None else str(e)
        raise HTTPException(
            status_code=502,
            detail=f"모델 API 오류({e.response.status_code if e.response else '?'}): {msg}",
        ) from e
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"모델 API 연결 실패: {e}") from e

    try:
        text = data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as e:
        raise HTTPException(status_code=502, detail="모델 응답 형식이 예상과 다릅니다.") from e

    if not text:
        raise HTTPException(status_code=502, detail="모델이 빈 문구를 반환했습니다.")

    return text


# —— Shorts (이미지 + 음원 → 세로 MP4, ffmpeg 필요) ——
MAX_SHORTS_IMAGES = 24
MAX_SHORTS_IMAGE_BYTES = 15 * 1024 * 1024
MAX_SHORTS_AUDIO_BYTES = 45 * 1024 * 1024
MIN_AUDIO_SEC = 0.4
MAX_AUDIO_SEC = 600
MIN_SLIDE_SEC = 0.25


def _resolve_ffmpeg_exe() -> str:
    """PATH·FFMPEG_PATH 우선, 없으면 imageio-ffmpeg 동봉 바이너리."""
    custom = (os.environ.get("FFMPEG_PATH") or "").strip()
    if custom and Path(custom).is_file():
        return custom
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg

        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if exe and Path(exe).is_file():
            return exe
    except Exception:
        pass
    return ""


def _image_ext(filename: str, content_type: str | None) -> str:
    name = (filename or "").lower()
    if name.endswith((".jpg", ".jpeg")):
        return ".jpg"
    for ext in (".png", ".webp", ".gif", ".bmp"):
        if name.endswith(ext):
            return ext
    ct = (content_type or "").lower()
    if "png" in ct:
        return ".png"
    if "webp" in ct:
        return ".webp"
    if "gif" in ct:
        return ".gif"
    if "bmp" in ct:
        return ".bmp"
    return ".jpg"


def _audio_ext(filename: str, content_type: str | None) -> str:
    name = (filename or "").lower()
    for ext in (".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"):
        if name.endswith(ext):
            return ext
    ct = (content_type or "").lower()
    if "mpeg" in ct or "mp3" in ct:
        return ".mp3"
    if "wav" in ct:
        return ".wav"
    if "mp4" in ct or "m4a" in ct or "aac" in ct:
        return ".m4a"
    if "ogg" in ct:
        return ".ogg"
    if "flac" in ct:
        return ".flac"
    return ".m4a"


def _escape_concat_path(path: Path) -> str:
    # concat demuxer: 작은따옴표 안의 ' 는 '\'' 로 이스케이프
    return path.resolve().as_posix().replace("'", "'" + "\\" + "'" + "'")


def _write_ffconcat(image_paths: list[Path], segment_sec: float, out_txt: Path) -> None:
    lines: list[str] = ["ffconcat version 1.0", ""]
    dur = f"{segment_sec:.6f}"
    for p in image_paths:
        lines.append(f"file '{_escape_concat_path(p)}'")
        lines.append(f"duration {dur}")
    if image_paths:
        lines.append(f"file '{_escape_concat_path(image_paths[-1])}'")
    out_txt.write_text("\n".join(lines) + "\n", encoding="utf-8")


_FFMPEG_DURATION_RE = re.compile(
    r"Duration:\s*(\d+):(\d{2}):(\d{2})(\.\d+)?",
    re.IGNORECASE,
)


def _probe_audio_duration_sec(ffmpeg: str, audio_path: Path) -> float:
    """ffprobe 없이 ffmpeg stderr의 Duration 한 줄로 길이(초) 파싱."""
    r = subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-nostdin",
            "-i",
            str(audio_path),
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )
    blob = (r.stderr or "") + (r.stdout or "")
    m = _FFMPEG_DURATION_RE.search(blob)
    if not m:
        tail = blob[:500]
        raise HTTPException(
            status_code=400,
            detail=f"음원 길이를 읽을 수 없습니다. ffmpeg 출력: {tail}",
        )
    h = int(m.group(1))
    mn = int(m.group(2))
    sec_part = m.group(3) + (m.group(4) or "")
    try:
        d = h * 3600 + mn * 60 + float(sec_part)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="음원 길이를 해석하지 못했습니다.") from e
    if d < MIN_AUDIO_SEC:
        raise HTTPException(status_code=400, detail="음원이 너무 짧습니다.")
    if d > MAX_AUDIO_SEC:
        raise HTTPException(
            status_code=400,
            detail=f"음원은 최대 {MAX_AUDIO_SEC}초까지 지원합니다.",
        )
    return d


app = FastAPI(title="네이버 카페 공지 작성기 API")


@app.post("/api/shorts")
async def api_shorts(
    images: list[UploadFile] = File(...),
    audio: UploadFile = File(...),
):
    """선택한 사진을 순서대로 이어 세로(1080×1920) 영상으로 만들고 음원을 붙입니다."""
    ffmpeg = _resolve_ffmpeg_exe()
    if not ffmpeg:
        raise HTTPException(
            status_code=503,
            detail=(
                "ffmpeg 실행 파일을 찾을 수 없습니다. "
                "터미널에서 pip install -r requirements.txt 후 서버를 다시 실행하거나, "
                "FFmpeg를 설치해 PATH에 두거나 FFMPEG_PATH 환경 변수를 설정하세요."
            ),
        )

    if not images:
        raise HTTPException(status_code=400, detail="Shorts 컷용 사진을 한 장 이상 선택해 주세요.")
    if len(images) > MAX_SHORTS_IMAGES:
        raise HTTPException(
            status_code=400,
            detail=f"사진은 최대 {MAX_SHORTS_IMAGES}장까지 선택할 수 있습니다.",
        )

    with tempfile.TemporaryDirectory(prefix="shorts-") as tmp:
        work = Path(tmp)
        img_paths: list[Path] = []
        for i, up in enumerate(images):
            data = await up.read()
            if len(data) > MAX_SHORTS_IMAGE_BYTES:
                raise HTTPException(
                    status_code=400,
                    detail=f"{i + 1}번째 사진이 너무 큽니다(한 장당 약 {MAX_SHORTS_IMAGE_BYTES // (1024 * 1024)}MB 제한).",
                )
            ext = _image_ext(up.filename or "", up.content_type)
            p = work / f"img{i:03d}{ext}"
            p.write_bytes(data)
            img_paths.append(p)

        audio_bytes = await audio.read()
        if len(audio_bytes) > MAX_SHORTS_AUDIO_BYTES:
            raise HTTPException(status_code=400, detail="음원 파일이 너무 큽니다.")
        ap = work / f"track{_audio_ext(audio.filename or '', audio.content_type)}"
        ap.write_bytes(audio_bytes)

        duration = _probe_audio_duration_sec(ffmpeg, ap)
        n = len(img_paths)
        segment = duration / n
        if segment < MIN_SLIDE_SEC:
            segment = MIN_SLIDE_SEC

        concat_list = work / "concat.txt"
        _write_ffconcat(img_paths, segment, concat_list)
        out_mp4 = work / "out.mp4"

        cmd = [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_list),
            "-i",
            str(ap),
            "-vf",
            "scale=1080:1920:force_original_aspect_ratio=decrease,"
            "pad=1080:1920:(ow-iw)/2:(oh-ih)/2,"
            "format=yuv420p,setsar=1",
            "-r",
            "30",
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            "-shortest",
            str(out_mp4),
        ]
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600,
            )
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=504, detail="Shorts 인코딩 시간이 초과되었습니다.") from None

        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or "")[:900]
            raise HTTPException(status_code=500, detail=f"Shorts 인코딩에 실패했습니다: {err}")

        mp4 = out_mp4.read_bytes()
        if not mp4:
            raise HTTPException(status_code=500, detail="생성된 MP4가 비어 있습니다.")

    return Response(
        content=mp4,
        media_type="video/mp4",
        headers={"Content-Disposition": 'inline; filename="shorts.mp4"'},
    )


@app.post("/api/generate")
async def api_generate(body: GenerateRequest):
    user_prompt = build_user_prompt(body.keywords, body.tone)
    model = resolve_chat_model(body.chat_model)
    notice = await call_chat_model(user_prompt, model)
    return JSONResponse(
        {
            "notice": notice,
            "model": model,
            "tone": body.tone,
            "tone_label": TONE_LABEL[body.tone],
        }
    )


@app.get("/")
def index():
    return FileResponse(ROOT / "index.html", media_type="text/html; charset=utf-8")


@app.get("/app.js")
def app_js():
    return FileResponse(ROOT / "app.js", media_type="application/javascript; charset=utf-8")


@app.get("/styles.css")
def styles_css():
    return FileResponse(ROOT / "styles.css", media_type="text/css; charset=utf-8")


app.mount(
    "/defaults",
    StaticFiles(directory=str(DEFAULTS_DIR)),
    name="defaults",
)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "serve:app",
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "8765")),
        reload=True,
    )
