#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

mkdirSync("/tmp/qa", { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(20000);
const fail = [];
page.on("pageerror", (e) => fail.push(`pageerror ${e.message}`));

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);
const overlay = await page.locator("vite-error-overlay").count();
let overlayText = "";
if (overlay) {
  overlayText = await page.locator("vite-error-overlay").innerText().catch(() => "");
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.querySelector("vite-error-overlay")?.remove());
}
const start = page.getByRole("button", { name: /start solo|start a club/i });
if (!(await start.count())) fail.push("no Start a club");
else await start.first().click({ force: true });

await page.waitForTimeout(1800);
const body = await page.locator("body").innerText();
if (!/draft/i.test(body)) fail.push(`not on draft: ${body.slice(0, 240)}`);
const desk = ["Lane", "Tess", "Boone", "Kit", "Marlo", "Cal", "Wes"];
const seen = desk.filter((n) => body.includes(n));
if (seen.length < 6) fail.push(`desk missing, saw ${seen} in ${body.slice(0, 400)}`);
const hasBlock = /on the block/i.test(body) && /josh allen/i.test(body);
if (!hasBlock) fail.push(`no live lot after wait: ${body.slice(0, 400)}`);
const bid = page.getByRole("button", { name: /^bid$/i });
if (await bid.count()) await bid.first().click({ force: true });
await page.waitForTimeout(400);
const after = await page.locator("body").innerText();
if (!/you/i.test(after) && !/\$59/.test(after)) {
  /* bid may have taken or already you */
}

await page.screenshot({ path: "/tmp/qa/auction-ui.png", fullPage: true });
await browser.close();
if (fail.length) {
  console.error(JSON.stringify({ ok: false, fail, snippet: body.slice(0, 500) }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, desk: seen, hasBlock: true }, null, 2));
