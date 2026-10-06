function getBaseUrl() {
  const meta = document.querySelector('meta[name="baseurl"]');
  return (meta ? meta.getAttribute("content") || "" : "").replace(/\/$/, "");
}

function triggerDownload(pdfUrl, fileName) {
  const link = document.createElement("a");
  link.href = pdfUrl;
  link.download = fileName || "Daniel_Quirant_Rico_CV.pdf";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function getPdfFileName() {
  const controls = document.querySelector(".floating-controls");
  const fromData = controls && controls.getAttribute("data-cv-pdf");
  return fromData || "Daniel_Quirant_Rico_CV.pdf";
}

function generatePDF(event) {
  if (event) {
    event.preventDefault();
  }

  const button = document.getElementById("pdfButton");
  const pdfFile = getPdfFileName();
  const pdfUrl = `${getBaseUrl()}/assets/pdf/${pdfFile}`;

  if (button) {
    button.classList.add("is-loading");
    button.setAttribute("aria-busy", "true");
    button.disabled = true;
  }

  fetch(pdfUrl, { method: "HEAD", cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("PDF no encontrado");
      }
      triggerDownload(pdfUrl, pdfFile);
    })
    .catch(() => {
      alert(
        "No se pudo descargar el PDF.\n\n" +
          "En GitHub Pages se genera en cada deploy. Si acabas de publicar cambios, espera un minuto y recarga.\n\n" +
          "En local: ./generate-pdf.sh"
      );
    })
    .finally(() => {
      if (button) {
        button.classList.remove("is-loading");
        button.setAttribute("aria-busy", "false");
        button.disabled = false;
      }
    });
}
