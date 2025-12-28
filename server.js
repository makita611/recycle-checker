const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

app.post("/check", async (req, res) => {
  const { frameNo, regNo, classCode, serial } = req.body;
  
  let browser = null;

  try {
    // 1. ブラウザの起動（Render向けの設定）
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

    // 2. サイトへアクセス
    // タイムアウトを30秒に設定し、読み込み完了を待つ
    await page.goto("https://www1.jars.gr.jp/k/kdis0010.do", { 
      waitUntil: "domcontentloaded",
      timeout: 30000 
    });

    // 3. フォーム入力
    // 車種区分（軽自動車=1）を選択
    await page.check('input[name="KDIS0010_radSyryuKbn"][value="1"]');
    
    // 車台番号下4桁
    await page.fill('input[name="KDIS0010_txtSydiNo4"]', String(frameNo));
    
    // 登録番号（地名以外）
    await page.fill('input[name="KDIS0010_txtSnM"]', String(regNo));
    
    // かな
    await page.selectOption('select[name="KDIS0010_selKn"]', String(classCode));
    
    // 一連番号
    await page.fill('input[name="KDIS0010_txtItrnStiNo"]', String(serial));

    // 4. 検索ボタンクリックと遷移待ち
    // クリックと同時にページ遷移が終わるのを待機する
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
      page.click('input[name="KDIS0010_btnSearch"]')
    ]);

    // 5. 結果の取得
    // 画面全体のテキストを取得（必要に応じてセレクタで絞ることも可能）
    const text = await page.evaluate(() => document.body.innerText);

    // 6. 正常レスポンス
    res.json({ result: text });

  } catch (err) {
    console.error("エラー発生:", err);
    res.status(500).json({ error: err.toString() });
  } finally {
    // 7. ブラウザを確実に閉じる（メモリ解放）
    if (browser) {
      await browser.close();
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server started at port ${PORT}`);
});
