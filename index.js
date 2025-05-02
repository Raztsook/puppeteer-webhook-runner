const express = require("express");
const puppeteer = require("puppeteer");
const axios = require("axios");

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = "tokens";

const app = express();

app.get("/", async (req, res) => {
  const url = req.query.url || "https://app--training-space-e7c9cafa.base44.app";

  try {
    // Step 1: Fetch latest token from Airtable
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}?maxRecords=1&sort%5B0%5D%5Bfield%5D=created&sort%5B0%5D%5Bdirection%5D=desc`;
    const response = await axios.get(airtableUrl, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });
    const token = response.data.records[0].fields.token;

    if (!token) return res.status(400).send("❌ No token found in Airtable.");

    // Step 2: Launch Puppeteer
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
    await page.goto("about:blank");
    await page.evaluate((tk) => {
      localStorage.setItem("token", tk);
    }, token);

    // Step 3: Navigate to the site
    await page.goto(url, { waitUntil: "networkidle2" });

    // Step 4: Wait for webhook confirmation
    let foundText = false;
    const maxWait = 180000;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      const text = await page.evaluate(() => document.body.innerText);
      if (text.includes("Monthly summaries sent")) {
        foundText = true;
        break;
      }
      await page.mouse.move(100 + Math.random() * 50, 200 + Math.random() * 50);
      await page.evaluate(() => window.scrollBy(0, 20));
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await browser.close();
    res.status(200).json({ webhookConfirmed: foundText });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error: " + err.message);
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log("Listening on port", port));
