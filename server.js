const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

app.post("/check", async (req, res) => {
  const { frameNo, regNo, classCode, serial } = req.body;

const browser = await chromium.launch({ 
  headless: true,
  args: [
    '--no-sandbox', 
    '--disable-setuid-sandbox', 
    '--disable-dev-shm-usage', // メモリ不足対策
    '--single-process'         // 処理を1つに絞る
  ]
});
  const page = await browser.newPage();

  try {
    await page.goto("https://www1.jars.gr.jp/k/kdis0010.do", { waitUntil: "networkidle" });

    await page.check('input[name="KDIS0010_radSyryuKbn"][value="1"]');
    await page.fill('input[name="KDIS0010_txtSydiNo4"]', frameNo);
    await page.fill('input[name="KDIS0010_txtSnM"]', regNo);
    await page.selectOption('select[name="KDIS0010_selKn"]', classCode);
    await page.fill('input[name="KDIS0010_txtItrnStiNo"]', serial);
    await page.click('input[name="KDIS0010_btnSearch"]');

    await page.waitForTimeout(1500);
    const text = await page.evaluate(() => document.body.innerText);

    await browser.close();
    res.json({ result: text });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.toString() });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
   console.log(`✅ Server started at port ${PORT}`);
});