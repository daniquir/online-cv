#!/usr/bin/env node
/**
 * Tests happy/unhappy del postproceso PDF (no tapar contenido de la última página).
 */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const {
  composePdf,
  getLastPageOverlayRatio,
} = require("./postprocess-pdf.js");

async function makeTwoPageRaw(tmpDir) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page1 = pdf.addPage([595, 842]);
  page1.drawText("PAGE1_MARKER", { x: 80, y: 800, size: 14, font, color: rgb(0, 0, 0) });
  const page2 = pdf.addPage([595, 842]);
  // Contenido abajo a la izquierda (zona que el overlay antiguo tapaba).
  page2.drawText("PAGE2_BOTTOM_CONTENT", {
    x: 80,
    y: 40,
    size: 14,
    font,
    color: rgb(0, 0, 0),
  });
  page2.drawText("PAGE2_TOP_CONTENT", {
    x: 80,
    y: 800,
    size: 14,
    font,
    color: rgb(0, 0, 0),
  });
  const rawPath = path.join(tmpDir, "raw.pdf");
  fs.writeFileSync(rawPath, await pdf.save());
  return rawPath;
}

function runUnitPolicyTests() {
  // Happy: multipágina con métrica agresiva → overlay 0
  assert.strictEqual(
    getLastPageOverlayRatio(2, { lastPageFillRatio: 0.99 }),
    0,
    "happy: multipágina no debe overlay"
  );
  assert.strictEqual(
    getLastPageOverlayRatio(1, { lastPageFillRatio: 0.42 }),
    0,
    "happy: una página tampoco overlay"
  );

  // Unhappy: inputs que antes forzaban >= 0.48 en multipágina
  assert.strictEqual(
    getLastPageOverlayRatio(3, { lastPageFillRatio: 0 }),
    0,
    "unhappy: fillRatio 0 no activa overlay mínimo"
  );
  assert.strictEqual(
    getLastPageOverlayRatio(2, {}),
    0,
    "unhappy: métricas vacías no activan overlay"
  );
}

async function runComposeSmokeTest() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cv-pdf-"));
  const rawPath = await makeTwoPageRaw(tmpDir);
  const metricsPath = path.join(tmpDir, "metrics.json");
  const outPath = path.join(tmpDir, "out.pdf");
  fs.writeFileSync(
    metricsPath,
    JSON.stringify({ lastPageFillRatio: 0.95, scrollHeight: 2000 })
  );

  await composePdf(rawPath, outPath, metricsPath);
  assert.ok(fs.existsSync(outPath), "debe generar PDF de salida");
  const out = await PDFDocument.load(fs.readFileSync(outPath));
  assert.strictEqual(out.getPageCount(), 2, "debe preservar 2 páginas");

  // El raw contenía marcadores; tras compose (sin overlay) el PDF embebido sigue.
  // Comprobamos tamaño razonable (fondos + contenido).
  assert.ok(fs.statSync(outPath).size > 500, "PDF de salida no vacío");

  fs.rmSync(tmpDir, { recursive: true, force: true });
}

(async () => {
  try {
    runUnitPolicyTests();
    console.log("OK: política overlay (happy/unhappy)");
    await runComposeSmokeTest();
    console.log("OK: compose multipágina con fillRatio alto no rompe salida");
    console.log("Todos los tests de postprocess PDF OK.");
  } catch (err) {
    console.error("FAIL:", err.message);
    process.exit(1);
  }
})();
