const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

app.get("/", (req, res) => res.status(200).send("Server is running!"));

app.post("/check", async (req, res) => {
  const { frameNo, regNo, classCode, serial } = req.body;
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

    // 1. 検索入力画面を開く (KDIS0010)
    await page.goto("https://www1.jars.gr.jp/k/kdis0010.do", { 
      waitUntil: "domcontentloaded",
      timeout: 60000 
    });

    // 2. フォーム入力
    await page.check('input[name="KDIS0010_radSyryuKbn"][value="1"]');
    await page.fill('input[name="KDIS0010_txtSydiNo4"]', String(frameNo));
    await page.fill('input[name="KDIS0010_txtSnM"]', String(regNo));
    await page.selectOption('select[name="KDIS0010_selKn"]', String(classCode));
    await page.fill('input[name="KDIS0010_txtItrnStiNo"]', String(serial));

    // 3. 検索ボタンをクリックして遷移を待つ
    // 「画面表示中です」のポップアップが出るため、ネットワークが静かになるまで待機
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }),
      page.click('input[name="KDIS0010_btnSearch"]')
    ]);

    // 4. 結果画面 (KDIS0020) の読み込みを待つ
    // 預託状況が書いてある場所（例：「預託済み」などの文字が含まれる要素）が出るまで待つ
    try {
      await page.waitForSelector('body', { timeout: 10000 });
    } catch (e) {
      console.log("タイムアウトしましたが続行します");
    }

    // 5. 画面全体のテキストを取得
    const resultText = await page.evaluate(() => document.body.innerText);

    // 6. システムエラー画面かどうか判定
    if (resultText.includes("システムエラー") || resultText.includes("コンタクトセンター")) {
      res.json({ result: "エラー: サイト側でシステムエラーが発生しました。" });
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
