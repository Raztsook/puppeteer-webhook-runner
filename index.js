const express = require("express");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const axios = require("axios");

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = "tokens";

const app = express();

app.get("/", async (req, res) => {
  const url = req.query.url || "https://app--training-space-e7c9cafa.base44.app";

  console.log("➡️ התחלת בקשת HTTP");
  console.log("🌍 URL לטעינה:", url);
  console.log("🔐 משתני סביבה:");
  console.log("AIRTABLE_TOKEN:", AIRTABLE_TOKEN ? AIRTABLE_TOKEN.slice(0, 8) + "..." : "❌ לא מוגדר");
  console.log("AIRTABLE_BASE_ID:", AIRTABLE_BASE_ID || "❌ לא מוגדר");

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    return res.status(500).send("❌ Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID.");
  }

  try {
    // Fetch latest token from Airtable
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}?maxRecords=1&sort[0][field]=created&sort[0][direction]=desc`;

    const response = await axios.get(airtableUrl, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });

    const token = response.data.records?.[0]?.fields?.token;
    if (!token) return res.status(400).send("❌ No token found in Airtable.");

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();

    await page.goto("about:blank");
    await page.evaluate((tk) => {
      localStorage.setItem("token", tk);
    }, token);

    // Navigate to main site
    await page.goto(url, { waitUntil: "networkidle2" });

    // Wait for confirmation
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
    console.error("❌ שגיאה כללית:", err.message);
    res.status(500).send("Error: " + err.message);
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log("✅ Server listening on port", port));
