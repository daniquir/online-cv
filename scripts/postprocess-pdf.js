const fs = require("fs");
const path = require("path");
const { PDFDocument, rgb } = require("pdf-lib");

const SIDEBAR_COLOR = rgb(26 / 255, 31 / 255, 38 / 255);
const MAIN_COLOR = rgb(247 / 255, 246 / 255, 243 / 255);
const SIDEBAR_MM = 64;
const PAGE_WIDTH_MM = 210;

/**
 * Ratio de relleno opaco ENCIMA del contenido de la última página.
 * Siempre 0: los fondos ya se pintan a página completa DETRÁS del contenido.
 * Un ratio > 0 (p. ej. métricas DOM ≠ layout de impresión) tapaba Metaenlace/
 * proyectos en CVs de más de una página (vista técnica).
 */
function getLastPageOverlayRatio(_pageCount, _metrics) {
  return 0;
}

function readMetrics(metricsPath) {
  if (!fs.existsSync(metricsPath)) {
    return { lastPageFillRatio: 0 };
  }

  return JSON.parse(fs.readFileSync(metricsPath, "utf8"));
}

async function composePdf(inputPath, outputPath, metricsPath) {
  const metrics = readMetrics(metricsPath);
  const sourceBytes = fs.readFileSync(inputPath);
  const sourcePdf = await PDFDocument.load(sourceBytes);
  const outputPdf = await PDFDocument.create();
  const pageCount = sourcePdf.getPageCount();
  const lastIndex = pageCount - 1;
  const lastPageFillRatio = getLastPageOverlayRatio(pageCount, metrics);

  for (let index = 0; index < pageCount; index += 1) {
    const sourcePage = sourcePdf.getPage(index);
    const { width, height } = sourcePage.getSize();
    const sidebarWidth = (SIDEBAR_MM / PAGE_WIDTH_MM) * width;
    const page = outputPdf.addPage([width, height]);

    // Fondos a página completa (detrás). Suficiente para columnas en todas las páginas.
    page.drawRectangle({
      x: 0,
      y: 0,
      width: sidebarWidth,
      height,
      color: SIDEBAR_COLOR,
    });

    page.drawRectangle({
      x: sidebarWidth,
      y: 0,
      width: width - sidebarWidth,
      height,
      color: MAIN_COLOR,
    });

    const [embeddedPage] = await outputPdf.embedPdf(sourcePdf, [index]);
    page.drawPage(embeddedPage, { x: 0, y: 0, width, height });

    // Overlay solo si la política lo permite (hoy: nunca).
    if (index === lastIndex && lastPageFillRatio > 0.01) {
      const fillHeight = height * lastPageFillRatio;

      page.drawRectangle({
        x: 0,
        y: 0,
        width: sidebarWidth,
        height: fillHeight,
        color: SIDEBAR_COLOR,
      });

      page.drawRectangle({
        x: sidebarWidth,
        y: 0,
        width: width - sidebarWidth,
        height: fillHeight,
        color: MAIN_COLOR,
      });
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, await outputPdf.save());
}

module.exports = {
  composePdf,
  getLastPageOverlayRatio,
};

if (require.main === module) {
  const input =
    process.argv[2] ||
    path.join(__dirname, "../assets/pdf/Daniel_Quirant_Rico_CV.raw.pdf");
  const output =
    process.argv[3] ||
    path.join(__dirname, "../assets/pdf/Daniel_Quirant_Rico_CV.pdf");
  const metrics =
    process.argv[4] ||
    path.join(__dirname, "../assets/pdf/.pdf-metrics.json");

  composePdf(input, output, metrics).catch((err) => {
    console.error("Error post-procesando PDF:", err.message);
    process.exit(1);
  });
}
