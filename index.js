const express = require("express");
const puppeteer = require("puppeteer");

const app = express();

app.get("/", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("Missing ?url= parameter");

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

    // שלב 1: טען את הדף האמיתי, רק DOM בסיסי
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // שלב 2: הזרק את הטוקן לדומיין הנכון
    await page.evaluate(() => {
      localStorage.setItem("token", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0c29va3JAZ21haWwuY29tIiwiZXhwIjoxNzQ2NTM3NDAwfQ.aDos9XIS74ylq79DP9JRIm6Xvl3H1hjaaCXbZ54XqPk");
    });

    // שלב 3: טען מחדש את הדף כשה-token כבר קיים
    await page.reload({ waitUntil: "networkidle2" });

    // אינטראקציה אנושית מדומה
    for (let i = 0; i < 30; i++) {
      await page.mouse.move(100 + i * 5, 200 + i * 3);
      await page.evaluate(() => window.scrollBy(0, 20));
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // נסה להפעיל את הפונקציה בעצמך
    const result = await page.evaluate(async () => {
      if (typeof triggerWebhook === "function") {
        try {
          const res = await triggerWebhook();
          return { manualTrigger: true, result: res };
        } catch (err) {
          return { manualTrigger: true, error: err.message };
        }
      }
      return { manualTrigger: false };
    });

    const webhookSent = await page.evaluate(() => {
      return [...document.querySelectorAll("span")].some(el =>
        el.textContent.includes("Last sent")
      );
    });

    await browser.close();

    res.status(200).json({ webhookSent, manualTrigger: result });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error running browser: " + err.message);
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log("Listening on port", port));
