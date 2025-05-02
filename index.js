const express = require("express");
const puppeteer = require("puppeteer");

const app = express();

app.get("/", async (req, res) => {{
  const url = req.query.url;
  if (!url) return res.status(400).send("Missing ?url= parameter");

  try {{
    const browser = await puppeteer.launch({{
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote'
      ]
    }});

    const page = await browser.newPage();

    // Inject localStorage token before loading the real page
    await page.goto("about:blank");
    await page.evaluate(() => {{
      localStorage.setItem("token", "{token_value}");
    }});

    await page.goto(url, {{ waitUntil: "networkidle2", timeout: 60000 }});

    // Simulate user interaction to trigger app logic
    for (let i = 0; i < 30; i++) {{
      await page.mouse.move(100 + i * 5, 200 + i * 3);
      await page.evaluate(() => window.scrollBy(0, 20));
      await new Promise(resolve => setTimeout(resolve, 1000));
    }}

    const webhookSent = await page.evaluate(() => {{
      return [...document.querySelectorAll("span")].some(el =>
        el.textContent.includes("Last sent")
      );
    }});

    await browser.close();

    res.status(200).json({{ webhookSent }});

  }} catch (err) {{
    console.error(err);
    res.status(500).send("Error running browser: " + err.message);
  }}
}});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log("Listening on port", port));
