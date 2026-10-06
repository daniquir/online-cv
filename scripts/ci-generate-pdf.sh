#!/usr/bin/env bash
# Genera los PDF (una por vista) en CI y los coloca en _site (no en el repo fuente).
set -euo pipefail

cd "$(dirname "$0")/.."

BASE_PATH="${BASE_PATH:-/online-cv}"
SITE_DIR="${SITE_DIR:-_site}"
PORT="${PORT:-4000}"
# Normaliza: "" o "/" → raíz; "/online-cv" → /online-cv
BASE_PATH="${BASE_PATH%/}"
[[ -z "${BASE_PATH}" || "${BASE_PATH}" == "/" ]] && BASE_PATH=""

TMP_DIR="$(mktemp -d)"
SERVE_ROOT="$(mktemp -d)"

if [[ ! -d "${SITE_DIR}" ]]; then
  echo "Error: no existe ${SITE_DIR}; ejecuta jekyll build antes." >&2
  exit 1
fi

mkdir -p "${SITE_DIR}/assets/pdf"

# Jekyll escribe en _site/ pero los assets usan site.baseurl (/online-cv/...).
# Montamos _site bajo ese prefijo para que print y CSS resuelvan igual que en Pages.
SITE_ABS="$(cd "${SITE_DIR}" && pwd)"
if [[ -n "${BASE_PATH}" ]]; then
  mkdir -p "${SERVE_ROOT}${BASE_PATH%/*}"
  ln -s "${SITE_ABS}" "${SERVE_ROOT}${BASE_PATH}"
  SERVE_DIR="${SERVE_ROOT}"
else
  SERVE_DIR="${SITE_ABS}"
fi

python3 -m http.server "${PORT}" --directory "${SERVE_DIR}" &
SERVER_PID=$!

cleanup() {
  kill "${SERVER_PID}" 2>/dev/null || true
  wait "${SERVER_PID}" 2>/dev/null || true
  rm -rf "${TMP_DIR}" "${SERVE_ROOT}"
}
trap cleanup EXIT

PRINT_MIXTO="http://127.0.0.1:${PORT}${BASE_PATH}/print/"
ready=0
for _ in $(seq 1 40); do
  if curl -sf "${PRINT_MIXTO}" > /dev/null; then
    ready=1
    break
  fi
  sleep 2
done

if [[ "${ready}" -ne 1 ]]; then
  echo "Error: no se pudo alcanzar ${PRINT_MIXTO}" >&2
  exit 1
fi

generate_one() {
  local print_path="$1"
  local output_name="$2"
  local cv_url="http://127.0.0.1:${PORT}${BASE_PATH}${print_path}"
  local raw_pdf="${TMP_DIR}/${output_name}.raw.pdf"
  local metrics="${TMP_DIR}/${output_name}.metrics.json"
  local output_pdf="${SITE_DIR}/assets/pdf/${output_name}"

  echo "Generando ${output_name} desde ${cv_url}..."
  CV_URL="${cv_url}" \
    OUTPUT="${raw_pdf}" \
    METRICS="${metrics}" \
    node scripts/generate-pdf.js

  node scripts/postprocess-pdf.js "${raw_pdf}" "${output_pdf}" "${metrics}"

  if [[ ! -s "${output_pdf}" ]]; then
    echo "Error: no se generó ${output_pdf}" >&2
    exit 1
  fi
  echo "PDF listo en ${output_pdf} ($(wc -c < "${output_pdf}") bytes)"
}

generate_one "/print/" "Daniel_Quirant_Rico_CV.pdf"
generate_one "/print/tecnico/" "Daniel_Quirant_Rico_CV_tecnico.pdf"
generate_one "/print/funcional/" "Daniel_Quirant_Rico_CV_funcional.pdf"
