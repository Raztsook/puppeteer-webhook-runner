const express = require("express");
const puppeteer = require("puppeteer");

const app = express();

app.get("/", async (req, res) => {
  const url = req.query.url || "https://app--training-space-e7c9cafa.base44.app";
  const token = req.query.token;

  if (!token) return res.status(400).send("Missing ?token= parameter");

  try {
    const browser = await puppeteer.launch({
      headless: false,
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

    for (let i = 0; i < 30; i++) {
      await page.mouse.move(100 + i * 5, 200 + i * 3);
      await page.evaluate(() => window.scrollBy(0, 20));
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await browser.close();
    res.status(200).send("✅ Webhook flow simulated successfully");

  } catch (err) {
    console.error(err);
    res.status(500).send("Error running browser: " + err.message);
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log("Listening on port", port));
