const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

// 稼働時間チェック関数 (日本時間 7:00-24:00)
const isWithinServiceHours = () => {
  const now = new Date();
  const jstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const hour = jstNow.getHours();
  return hour >= 7 && hour < 24;
};

app.get("/", (req, res) => res.status(200).send("Server is running!"));

app.post("/check", async (req, res) => {
  if (!isWithinServiceHours()) {
    return res.status(503).json({ error: "【サービス時間外】JARSの稼働時間は7:00〜24:00です。" });
  }

  const { frameNo, regNo, classCode, serial, isKei } = req.body;
  let browser = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process']
    });

    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // 1. 新システムURLへアクセス
    await page.goto("https://www1.jars.gr.jp/k/kdis0010.do", { 
      waitUntil: "domcontentloaded",
      timeout: 60000 
    });

    // 2. フォーム入力
    // 車両区分（1:登録自動車 / 2:軽自動車）
    const syryuKbn = isKei ? "2" : "1";
    await page.check(`input[name="KDIS0010_radSyryuKbn"][value="${syryuKbn}"]`);
    
    // 車台番号入力
    await page.fill('input[name="KDIS0010_txtSydiNo"]', String(frameNo));

    // 支局名 (例: 春日部)
    await page.fill('input[name="KDIS0010_txtSNm"]', String(regNo));

    // 分類番号 (例: 31K) ※以前の変数があればそれを使う
    if (req.body.classNum) {
      await page.fill('input[name="KDIS0010_txtBnriNo"]', String(req.body.classNum));
    }

    // かな (例: り)
    await page.fill('input[name="KDIS0010_selKn"]', String(classCode));

    // 一連指定番号 (例: 11)
    await page.fill('input[name="KDIS0010_txtItrnStiNo"]', String(serial));

    // 3. 検索ボタンをクリック
    // 確実に「検索」ボタンを特定してクリック
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }),
      page.click('input[type="submit"], button[type="submit"], .btnSearch') 
    ]);

    // 4. 結果の取得
    const resultText = await page.evaluate(() => document.body.innerText);

    // エラーメッセージの判定
    if (resultText.includes("該当する車両が存在しません")) {
      res.json({ result: "エラー：車両が見つかりません。入力内容を確認してください。" });
    } else {
      res.json({ result: resultText });
    }

  } catch (err) {
    console.error("エラー詳細:", err);
    res.status(500).json({ error: err.toString() });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server started at port ${PORT}`));
