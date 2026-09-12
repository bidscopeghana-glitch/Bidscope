/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const sourcePath = process.argv[2];
if (!sourcePath || !fs.existsSync(sourcePath)) {
  throw new Error("Pass the approved transparent BidScope master PNG as the first argument.");
}

const root = path.resolve(__dirname, "..");
const brandRoot = path.join(root, "public", "brand");
const dirs = ["logo", "icons", "social", "email", "templates"];
for (const dir of dirs) fs.mkdirSync(path.join(brandRoot, dir), { recursive: true });

const GREEN = "#084D33";
const GOLD = "#D4AF37";
const CREAM = "#FDFBF4";
const CHARCOAL = "#1D1D1D";

function pngSvg(buffer, width, height, label) {
  const encoded = buffer.toString("base64");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}"><image width="${width}" height="${height}" href="data:image/png;base64,${encoded}"/></svg>`;
}

async function recolor(buffer, mode) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    if (mode === "mono") {
      data[i] = 29; data[i + 1] = 29; data[i + 2] = 29;
    } else if (data[i] < 145 && data[i + 1] < 160 && data[i + 2] < 135) {
      data[i] = 253; data[i + 1] = 251; data[i + 2] = 244;
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function clearCropEdges(buffer, edge = 14) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      if ((x < edge || x >= info.width - edge) && data[i] < 24 && data[i + 1] < 24 && data[i + 2] < 24) data[i + 3] = 0;
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

function writeIco(png, destination) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(0, 6);
  header.writeUInt8(0, 7);
  header.writeUInt8(0, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  fs.writeFileSync(destination, Buffer.concat([header, png]));
}

function textSvg(width, height, eyebrow, title, body, accent = GOLD) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <style>.sans{font-family:Montserrat,Arial,sans-serif}.eyebrow{font-size:25px;font-weight:700;letter-spacing:6px}.title{font-size:70px;font-weight:750}.body{font-size:30px;font-weight:400}</style>
    <text x="0" y="45" class="sans eyebrow" fill="${accent}">${eyebrow}</text>
    <text x="0" y="145" class="sans title" fill="${CREAM}">${title}</text>
    <text x="0" y="205" class="sans body" fill="${CREAM}" opacity=".78">${body}</text>
  </svg>`);
}

(async () => {
  const master = sharp(sourcePath).ensureAlpha();
  const primary = await master.clone().extract({ left: 380, top: 15, width: 1030, height: 850 }).png({ compressionLevel: 9 }).toBuffer();
  const mark = await clearCropEdges(await master.clone().extract({ left: 624, top: 23, width: 536, height: 552 }).png({ compressionLevel: 9 }).toBuffer());
  const wordmark = await master.clone().extract({ left: 389, top: 599, width: 1003, height: 202 }).png({ compressionLevel: 9 }).toBuffer();

  const horizontal = await sharp({ create: { width: 920, height: 240, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: await sharp(mark).resize({ width: 220, height: 227, fit: "contain" }).png().toBuffer(), left: 0, top: 6 },
      { input: await sharp(wordmark).resize({ width: 665, height: 134, fit: "contain" }).png().toBuffer(), left: 245, top: 53 },
    ]).png({ compressionLevel: 9 }).toBuffer();
  const reversed = await recolor(horizontal, "reversed");
  const monochrome = await recolor(horizontal, "mono");

  const logoDir = path.join(brandRoot, "logo");
  fs.writeFileSync(path.join(logoDir, "bidscope-logo.png"), await sharp(primary).resize({ width: 900 }).png({ compressionLevel: 9 }).toBuffer());
  fs.writeFileSync(path.join(logoDir, "bidscope-logo@2x.png"), await sharp(primary).resize({ width: 1800, withoutEnlargement: false }).png({ compressionLevel: 9 }).toBuffer());
  fs.writeFileSync(path.join(logoDir, "bidscope-logo.svg"), pngSvg(primary, 1015, 836, "BidScope — Where Opportunity Finds You"));
  fs.writeFileSync(path.join(logoDir, "bidscope-horizontal.png"), horizontal);
  fs.writeFileSync(path.join(logoDir, "bidscope-horizontal.svg"), pngSvg(horizontal, 920, 240, "BidScope"));
  fs.writeFileSync(path.join(logoDir, "bidscope-logo-white.png"), reversed);
  fs.writeFileSync(path.join(logoDir, "bidscope-logo-white.svg"), pngSvg(reversed, 920, 240, "BidScope"));
  fs.writeFileSync(path.join(logoDir, "bidscope-monochrome.png"), monochrome);
  fs.writeFileSync(path.join(logoDir, "bidscope-monochrome.svg"), pngSvg(monochrome, 920, 240, "BidScope"));

  const markPng = await sharp(mark).resize({ width: 768, height: 792, fit: "contain" }).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(path.join(logoDir, "bidscope-mark.png"), markPng);
  fs.writeFileSync(path.join(logoDir, "bidscope-mark.svg"), pngSvg(markPng, 768, 792, "BidScope mark"));

  const reversedMark = await recolor(mark, "reversed");
  const iconDir = path.join(brandRoot, "icons");
  async function appIcon(size, filename) {
    const radius = Math.round(size * 0.22);
    const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${GREEN}"/></svg>`);
    const inset = Math.round(size * 0.18);
    const foreground = await sharp(reversedMark).resize({ width: size - inset * 2, height: size - inset * 2, fit: "contain" }).png().toBuffer();
    const output = await sharp(bg).composite([{ input: foreground, left: inset, top: inset }]).png({ compressionLevel: 9 }).toBuffer();
    fs.writeFileSync(path.join(iconDir, filename), output);
    return output;
  }
  const icon512 = await appIcon(512, "icon-512.png");
  await appIcon(192, "icon-192.png");
  await appIcon(180, "apple-touch-icon.png");
  await appIcon(64, "favicon-64x64.png");
  await appIcon(48, "favicon-48x48.png");
  await appIcon(32, "favicon-32x32.png");
  await appIcon(16, "favicon-16x16.png");
  writeIco(await sharp(icon512).resize(256, 256).png().toBuffer(), path.join(iconDir, "favicon.ico"));

  const socialDir = path.join(brandRoot, "social");
  const ogLogo = await sharp(reversed).resize({ width: 390 }).png().toBuffer();
  const og = await sharp({ create: { width: 1200, height: 630, channels: 4, background: GREEN } })
    .composite([
      { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><circle cx="1120" cy="70" r="320" fill="${GOLD}" opacity=".12"/><circle cx="1080" cy="560" r="240" fill="${CREAM}" opacity=".05"/><path d="M80 520h1040" stroke="${GOLD}" stroke-width="3" opacity=".75"/></svg>`), left: 0, top: 0 },
      { input: ogLogo, left: 76, top: 54 },
      { input: textSvg(1030, 275, "DISCOVER  •  BID  •  GROW", "See what's possible.", "Discover government and public-sector opportunities in one place."), left: 76, top: 262 },
    ]).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(path.join(socialDir, "bidscope-og.png"), og);

  const templates = [
    ["new-tender.png", "NEW TENDER", "A new opportunity is ready to review."],
    ["closing-soon.png", "CLOSING SOON", "Prepare before the deadline."],
    ["contract-awarded.png", "CONTRACT AWARDED", "Opportunity delivered."],
    ["new-opportunity.png", "NEW OPPORTUNITY", "See what fits your business."],
  ];
  for (const [filename, title, body] of templates) {
    const card = await sharp({ create: { width: 1080, height: 1080, channels: 4, background: GREEN } })
      .composite([
        { input: await sharp(reversed).resize({ width: 360 }).png().toBuffer(), left: 70, top: 65 },
        { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080"><circle cx="940" cy="190" r="270" fill="${GOLD}" opacity=".12"/><path d="M70 900h940" stroke="${GOLD}" stroke-width="4"/><text x="70" y="520" font-family="Montserrat,Arial,sans-serif" font-size="78" font-weight="750" fill="${CREAM}">${title}</text><text x="70" y="600" font-family="Montserrat,Arial,sans-serif" font-size="32" fill="${CREAM}" opacity=".76">${body}</text><text x="70" y="970" font-family="Montserrat,Arial,sans-serif" font-size="24" letter-spacing="4" fill="${GOLD}">WHERE OPPORTUNITY FINDS YOU.</text></svg>`), left: 0, top: 0 },
      ]).png({ compressionLevel: 9 }).toBuffer();
    fs.writeFileSync(path.join(brandRoot, "templates", filename), card);
  }

  const signature = `<!-- Replace bracketed fields only; do not hardcode unavailable contact details. -->
<table role="presentation" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;color:${CHARCOAL}">
  <tr><td style="padding-bottom:14px"><img src="https://www.bidscopeghana.com/brand/logo/bidscope-horizontal.png" width="230" alt="BidScope"></td></tr>
  <tr><td style="font-weight:700;color:${GREEN}">[Name]</td></tr>
  <tr><td style="font-size:13px;padding:2px 0 10px">[Role]</td></tr>
  <tr><td style="font-size:13px;line-height:1.6">[Email] · [Phone, when available]<br><a href="https://www.bidscopeghana.com" style="color:${GREEN}">bidscopeghana.com</a></td></tr>
  <tr><td style="padding-top:10px;font-size:12px;color:#5f6f68">Where Opportunity Finds You.</td></tr>
</table>`;
  fs.writeFileSync(path.join(brandRoot, "email", "signature.html"), signature);

  console.log(`Generated BidScope brand assets in ${brandRoot}`);
})();
