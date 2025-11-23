require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const TronWeb = require('tronweb');
const { GoogleSpreadsheet } = require('google-spreadsheet');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // فایل‌های HTML/CSS/JS

// تنظیمات Tron
const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io',
  headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY || '' }
});

const WALLET_ADDRESS = process.env.TRON_WALLET_ADDRESS;
const USDT_CONTRACT = 'TR7NHqjeKQxGTCuuQdCA3f2Y2Y8pSQVr7i'; // USDT TRC20
const SCAN_PRICE = 9000000;   // 9 USDT
const ERASE_PRICE = 29000000; // 29 USDT

// ۱. ارسال آدرس والت به فرانت‌اند (امن)
app.get('/config', (req, res) => {
  if (!WALLET_ADDRESS) return res.status(500).json({ error: "Wallet not configured" });
  res.json({ wallet: WALLET_ADDRESS });
});

// ۲. تأیید واقعی پرداخت (مهم‌ترین بخش)
app.post('/verify-payment', async (req, res) => {
  const { txID, type } = req.body;

  if (!txID || !type) return res.status(400).json({ success: false, message: "Missing data" });

  try {
    // دریافت اطلاعات تراکنش
    const txInfo = await tronWeb.trx.getTransactionInfo(txID);
    if (!txInfo || txInfo.receipt.result !== 'SUCCESS') {
      return res.json({ success: false, message: "Transaction pending or failed" });
    }

    // بررسی جزئیات قرارداد USDT
    const log = txInfo.log[0];
    if (!log) return res.json({ success: false, message: "No log found" });

    const data = log.data;
    const topics = log.topics;

    // موضوع استاندارد انتقال USDT
    if (topics[0] !== 'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
      return res.json({ success: false, message: "Not a USDT transfer" });
    }

    // استخراج مقدار و مقصد
    const amountHex = '0x' + data.slice(64, 128);
    const toHex = '0x' + data.slice(24, 64).padStart(64, '0');
    const amount = parseInt(amountHex, 16);
    const toAddress = tronWeb.address.fromHex('41' + toHex.slice(26));

    const expectedAmount = type === 'scan' ? SCAN_PRICE : ERASE_PRICE;

    if (toAddress === WALLET_ADDRESS && amount >= expectedAmount) {
      // ذخیره در Google Sheet (اختیاری – بعداً اضافه کن)
      await logToSheet({ txID, type, amount: amount / 1000000, time: new Date().toISOString() });

      return res.json({ success: true, message: "Payment confirmed!" });
    } else {
      return res.json({ success: false, message: "Invalid recipient or amount" });
    }
  } catch (err) {
    console.error("Verification error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ۳. دریافت اطلاعات کاربر بعد از اسکن
app.post('/submit-info', async (req, res) => {
  const { name, email, city } = req.body;
  if (!name || !email) return res.status(400).send("Missing info");

  await logToSheet({ name, email, city, type: 'info', time: new Date().toISOString() });
  res.json({ message: "Info received. Removal team will contact you." });
});

// تابع ذخیره در Google Sheet (اختیاری – ولی خیلی خوبه داشته باشی)
async function logToSheet(data) {
  try {
    const doc = new GoogleSpreadsheet('YOUR_GOOGLE_SHEET_ID'); // اینجا ID شیتت رو بذار
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({ ...data, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Sheet error:", err.message);
  }
}

// صفحه اصلی
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ClearShield Server running on port ${PORT}`);
  console.log(`Wallet: ${WALLET_ADDRESS}`);
  console.log(`Ready to accept USDT payments!`);
});