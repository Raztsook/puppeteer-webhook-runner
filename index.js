const puppeteer   = require('puppeteer-core');
const chromium    = require('@sparticuz/chromium');
const axios       = require('axios');
const express     = require('express');

const { AIRTABLE_TOKEN, AIRTABLE_BASE_ID } = process.env;
const TABLE = 'tokens';
const app   = express();

app.get('/', async (req, res) => {
  try {
    // ① טוקן אחרון מ-Airtable
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE}` +
                '?maxRecords=1&sort[0][field]=created&sort[0][direction]=desc';

    const { data } = await axios.get(url, { headers:{ Authorization:`Bearer ${AIRTABLE_TOKEN}` }});
    const token = data.records?.[0]?.fields?.token;
    if (!token) return res.status(400).send('no token in Airtable');

    // ② דפדפן בענן
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.goto('about:blank');
    await page.evaluate(tk => localStorage.setItem('token', tk), token);

    const site = req.query.url || 'https://app--training-space-e7c9cafa.base44.app';
    await page.goto(site, { waitUntil:'networkidle2' });

    // ③ חכה לטקסט
    let ok = false, t0 = Date.now();
    while (Date.now() - t0 < 180000) {
      ok = await page.evaluate(() => document.body.innerText.includes('Monthly summaries sent'));
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
app.listen(port, () => console.log('listening on', port));
