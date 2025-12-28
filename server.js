const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

// 【追加】ヘルスチェック用のルート
// Renderの Health Check Path を "/" にした場合はこれが必須です
app.get("/", (req, res) => {
  res.status(200).send("Server is running!");
});

app.post("/check", async (req, res) => {
  const { frameNo, regNo, classCode, serial } = req.body;
  
  let browser = null;

  try {
    // ブラウザの起動
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

    const context = await browser.newContext();
    const page = await context.newPage();

    // サイトへアクセス（タイムアウト30秒）
    await page.goto("https://www1.jars.gr.jp/k/kdis0010.do", { 
      waitUntil: "domcontentloaded",
      timeout: 30000 
    });

    // フォーム入力
    await page.check('input[name="KDIS0010_radSyryuKbn"][value="1"]');
    await page.fill('input[name="KDIS0010_txtSydiNo4"]', String(frameNo));
    await page.fill('input[name="KDIS0010_txtSnM"]', String(regNo));
    await page.selectOption('select[name="KDIS0010_selKn"]', String(classCode));
    await page.fill('input[name="KDIS0010_txtItrnStiNo"]', String(serial));

    // 検索ボタンクリックと遷移待ち
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
      page.click('input[name="KDIS0010_btnSearch"]')
    ]);

    // 結果の取得
    const text = await page.evaluate(() => document.body.innerText);

    // 正常レスポンス
    res.json({ result: text });

  } catch (err) {
    console.error("エラー発生:", err);
    res.status(500).json({ error: err.toString() });
  } finally {
    // ブラウザを確実に閉じる（メモリ解放）
    if (browser) {
      await browser.close();
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server started at port ${PORT}`);
});
