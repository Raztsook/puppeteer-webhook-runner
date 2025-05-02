const express = require("express");
const puppeteer = require("puppeteer");
const axios = require("axios");

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = "tokens";

const app = express();

app.get("/", async (req, res) => {
  const url = req.query.url || "https://app--training-space-e7c9cafa.base44.app";

  console.log("➡️ התחלת בקשת HTTP");
  console.log("🌍 URL לטעינה:", url);
  console.log("🔐 בדיקת משתני סביבה...");
  console.log("AIRTABLE_TOKEN:", AIRTABLE_TOKEN ? AIRTABLE_TOKEN.slice(0, 8) + "..." : "❌ לא מוגדר");
  console.log("AIRTABLE_BASE_ID:", AIRTABLE_BASE_ID || "❌ לא מוגדר");

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    return res.status(500).send("❌ Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID in environment variables.");
  }

  try {
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}?maxRecords=1&sort[0][field]=created&sort[0][direction]=desc`;
    const response = await axios.get(airtableUrl, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });

    console.log("✅ תגובת Airtable:", JSON.stringify(response.data, null, 2));

    const token = response.data.records?.[0]?.fields?.token;
    if (!token) return res.status(400).send("❌ No token found in Airtable.");

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

    await page.goto(url, { waitUntil: "networkidle2" });

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
