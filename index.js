const express   = require("express");
const puppeteer  = require("puppeteer-core");
const chromium   = require("@sparticuz/chromium");
const axios      = require("axios");

const { AIRTABLE_TOKEN, AIRTABLE_BASE_ID } = process.env;
const TABLE = "tokens";

const app = express();

app.get("/", async (req, res) => {
  const site = req.query.url || "https://app--training-space-e7c9cafa.base44.app";

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    return res.status(500).send("Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID");
  }

  try {
    /* ① שליפת הטוקן האחרון מ-Airtable */
    const api   = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE}` +
                  "?maxRecords=1&sort[0][field]=created&sort[0][direction]=desc";

    const { data } = await axios.get(api, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });

    const token = data.records?.[0]?.fields?.token;
    if (!token) return res.status(400).send("No token found in Airtable");

    /* ② הפעלת Puppeteer בענן */
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();

    /* ③ הזרקת הטוקן לפני שכל סקריפט נטען */
    await page.addInitScript(
      (tk, origin) => {
        if (location.origin === origin) {
          try { localStorage.setItem("token", tk); } catch (_) {}
        }
      },
      token,
      new URL(site).origin
    );

    /* ④ טעינת האתר */
    await page.goto(site, { waitUntil: "networkidle2" });

    /* ⑤ קביעת הטוקן שוב ורענון ליתר ביטחון */
    await page.evaluate(tk => localStorage.setItem("token", tk), token);
    await page.reload({ waitUntil: "networkidle2" });

    /* ⑥ בדיקת הופעת הטקסט */
    const start   = Date.now();
    const maxWait = 180000;            // 3 דקות
    let confirmed = false;

    while (Date.now() - start < maxWait) {
      confirmed = await page.evaluate(() =>
        document.body.innerText.includes("Monthly summaries sent")
      );
      if (confirmed) break;
      await page.waitForTimeout(1000);
    }

    await browser.close();
    res.json({ webhookConfirmed: confirmed });

  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log("Server listening on", port));
