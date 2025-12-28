app.post("/check", async (req, res) => {
  const { frameNo, regNo, classCode, serial } = req.body;
  let browser; // ブラウザ変数を外に出す

  try {
    browser = await chromium.launch({ 
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-gpu', // Render等の制限環境では推奨
      ]
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("https://www1.jars.gr.jp/k/kdis0010.do", { waitUntil: "domcontentloaded" });

    // 入力処理
    await page.check('input[name="KDIS0010_radSyryuKbn"][value="1"]');
    await page.fill('input[name="KDIS0010_txtSydiNo4"]', frameNo);
    await page.fill('input[name="KDIS0010_txtSnM"]', regNo);
    await page.selectOption('select[name="KDIS0010_selKn"]', classCode);
    await page.fill('input[name="KDIS0010_txtItrnStiNo"]', serial);
    
    // クリックして結果待ち
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('input[name="KDIS0010_btnSearch"]')
    ]);

    const text = await page.evaluate(() => document.body.innerText);
    res.json({ result: text });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.toString() });
  } finally {
    if (browser) {
      await browser.close(); // エラーが起きても起きなくても必ず閉じる
    }
  }
});
