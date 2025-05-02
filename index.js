const express   = require("express");
const puppeteer  = require("puppeteer-core");
const chromium   = require("@sparticuz/chromium");
const axios      = require("axios");

const { AIRTABLE_TOKEN, AIRTABLE_BASE_ID } = process.env;
const TABLE = "tokens";
const app   = express();

app.get("/", async (req, res) => {
  const site = req.query.url || "https://app--training-space-e7c9cafa.base44.app";

  try {
    /* ① טוקן אחרון מ-Airtable */
    const api = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE}` +
                "?maxRecords=1&sort[0][field]=created&sort[0][direction]=desc";

    const { data } = await axios.get(api, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });

    const token = data.records?.[0]?.fields?.token;
    if (!token) return res.status(400).send("No token found in Airtable");

    /* ② דפדפן בענן */
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();

    /* ③ הזרקת הטוקן לפני שכל JS של האתר רץ */
    await page.evaluateOnNewDocument(
      (tk, origin) => {
        if (location.origin === origin) {
          try { localStorage.setItem("token", tk); } catch(_) {}
        }
      },
      token,
      new URL(site).origin
    );

    /* ④ ניווט לאתר וטעינה */
    await page.goto(site, { waitUntil: "networkidle2" });

    /* ⑤ קביעת הטוקן שוב ורענון */
    await page.evaluate(tk => localStorage.setItem("token", tk), token);
    await page.reload({ waitUntil: "networkidle2" });

    /* ⑥ המתנה לטקסט */
    const max = Date.now() + 180000;
    let ok = false;
    while (Date.now() < max) {
      ok = await page.evaluate(() =>
        document.body.innerText.includes("Monthly summaries sent")
      );
      if (ok) break;
      await page.waitForTimeout(1000);
    }

    await browser.close();
    res.json({ webhookConfirmed: ok });

  } catch (e) {
    console.error(e);
    res.status(500).send(e.message);
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log("listening on", port));
