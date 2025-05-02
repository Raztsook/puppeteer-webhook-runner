const express = require("express");
const puppeteer = require("puppeteer");

const app = express();

app.get("/", async (req, res) => {
  const url = req.query.url || "https://app--training-space-e7c9cafa.base44.app";
  const token = req.query.token;

  if (!token) return res.status(400).send("Missing ?token= parameter");

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote'
      ]
    });

    const page = await browser.newPage();

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    await page.evaluate((tk) => {
      localStorage.setItem("token", tk);
    }, token);

    await page.reload({ waitUntil: "networkidle2" });

    // המתן עד שיופיע טקסט המעיד על שליחת ה-webhook
    let foundText = false;
    const maxWaitTimeMs = 3 * 60 * 1000; // עד 3 דקות
    const intervalMs = 1000;
    const start = Date.now();

    while (Date.now() - start < maxWaitTimeMs) {
      const text = await page.evaluate(() => document.body.innerText);
      if (text.includes("Monthly summaries sent")) {
        foundText = true;
        break;
      }

      await page.mouse.move(100 + Math.random() * 50, 200 + Math.random() * 50);
      await page.evaluate(() => window.scrollBy(0, 20));
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    await browser.close();
    res.status(200).json({ webhookConfirmed: foundText });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error running browser: " + err.message);
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log("Listening on port", port));
