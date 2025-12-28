const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

// ヘルスチェック用
app.get("/", (req, res) => {
  res.status(200).send("Server is running!");
});

app.post("/check", async (req, res) => {
  const { frameNo, regNo, classCode, serial } = req.body;
  
  let browser = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process'
      ]
    });

    // 【修正ポイント】ignoreHTTPSErrors: true を追加して証明書エラーを無視する
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // サイトへアクセス
    await page.goto("https://www1.jars.gr.jp/k/kdis0010.do", { 
      waitUntil: "domcontentloaded",
      timeout: 60000 // 念のため1分まで待機を許可
    });

    // フォーム入力
    await page.check('input[name="KDIS0010_radSyryuKbn"][value="1"]');
    await page.fill('input[name="KDIS0010_txtSydiNo4"]', String(frameNo));
    await page.fill('input[name="KDIS0010_txtSnM"]', String(regNo));
    await page.selectOption('select[name="KDIS0010_selKn"]', String(classCode));
    await page.fill('input[name="KDIS0010_txtItrnStiNo"]', String(serial));

    // 検索ボタンクリックと遷移待ち
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }),
      page.click('input[name="KDIS0010_btnSearch"]')
    ]);

    // 結果の取得
    const text = await page.evaluate(() => document.body.innerText);

    res.json({ result: text });

  } catch (err) {
    console.error("エラー発生:", err);
    res.status(500).json({ error: err.toString() });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server started at port ${PORT}`);
});
