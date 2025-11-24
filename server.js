require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const TronWeb = require('tronweb');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
app.use(helmet({ contentSecurityPolicy: (process.env.NODE_ENV === 'production') ? undefined : false }));
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const TRON_API_KEY = process.env.TRON_API_KEY || '';
const WALLET_ADDRESS = process.env.TRON_WALLET_ADDRESS || '';
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // ✅ آدرس صحیح USDT-TRC20

const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io',
  headers: { 'TRON-PRO-API-KEY': TRON_API_KEY }
});

// ارسال آدرس والت به فرانت
app.get('/config', (req, res) => {
  res.json({ wallet: WALLET_ADDRESS });
});

// لیست سایت‌های دیتابروکر واقعی (برای شبیه‌سازی هوشمند)
const BROKER_SITES = [
  { name: "Whitepages", url: "https://whitepages.com", snippet: "Full name, phone, address listed publicly" },
  { name: "Spokeo", url: "https://spokeo.com", snippet: "Email, relatives, and social profiles exposed" },
  { name: "Intelius", url: "https://intelius.com", snippet: "Criminal records and contact info found" },
  { name: "PeopleFinder", url: "https://peoplefinder.com", snippet: "Public directory with old addresses" },
  { name: "BeenVerified", url: "https://beenverified.com", snippet: "Social media links and employment history" },
  { name: "Veripages", url: "https://veripages.com", snippet: "Phone number and household members listed" },
  { name: "TruePeopleSearch", url: "https://truepeoplesearch.com", snippet: "Age, relatives, and location history" },
  { name: "Radaris", url: "https://radaris.com", snippet: "Education and property records exposed" },
  { name: "FastPeopleSearch", url: "https://fastpeoplesearch.com", snippet: "Multiple address history and phone numbers" },
  { name: "That’s Them", url: "https://thatsthem.com", snippet: "Email and social media profiles indexed" }
];

// شبیه‌سازی اسکن (بدون Bing)
async function performScan(query) {
  // در نسخه تجاری: جایگزین با اسکن دستی توسط تیم
  const count = Math.min(47, 10 + Math.floor(Math.random() * 40)); // عدد واقع‌نمایانه
  const results = [];
  for (let i = 0; i < count; i++) {
    const site = BROKER_SITES[Math.floor(Math.random() * BROKER_SITES.length)];
    results.push({ ...site, foundAt: new Date().toISOString() });
  }
  return results;
}

// ذخیره‌سازی ساده در حافظه (برای تست — در تولید از DB استفاده کن)
const jobs = [];

// تأیید تراکنش TRC20 با log analysis
async function verifyTx(txId) {
  try {
    if (!txId) return { success: false, reason: 'no-txid' };
    const txInfo = await tronWeb.trx.getTransactionInfo(txId);
    if (!txInfo || txInfo.receipt?.result !== 'SUCCESS') return { success: false, reason: 'tx-failed' };
    
    const logs = txInfo.log || [];
    const usdtHex = tronWeb.address.toHex(USDT_CONTRACT).toLowerCase();
    const toHex = tronWeb.address.toHex(WALLET_ADDRESS).toLowerCase();

    for (const log of logs) {
      if (log.address?.toLowerCase() === usdtHex) {
        // انتقال به آدرس تو؟
        const data = log.data || '';
        if (data.includes(toHex.replace(/^41/, ''))) {
          return { success: true, txId, amount: 0 };
        }
      }
    }
    return { success: false, reason: 'no-match' };
  } catch (err) {
    return { success: false, reason: 'verify-error', error: err.message };
  }
}

// دریافت پرداخت
app.post('/confirm-payment', async (req, res) => {
  const { txId, type, query } = req.body;
  if (!txId || !type || !query) return res.status(400).json({ error: 'Missing fields' });

  const job = { id: Date.now().toString(), txId, type, query, status: 'verifying', createdAt: new Date().toISOString() };
  jobs.push(job);

  const ver = await verifyTx(txId);
  if (ver.success) {
    job.status = 'processing';
    // شبیه‌سازی پردازش
    setTimeout(async () => {
      job.result = type === 'scan' ? { scan: await performScan(query) } : { erase: 'Removal request submitted' };
      job.status = 'done';
    }, 2000);
    res.json({ message: 'Payment verified. Processing...', jobId: job.id });
  } else {
    job.status = 'failed';
    res.status(400).json({ message: 'Payment not verified', reason: ver.reason });
  }
});

// دریافت وضعیت کار
app.get('/jobs', (req, res) => {
  res.json(jobs);
});

// سلامتی سرور
app.get('/health', (req, res) => {
  res.json({ status: 'ok', wallet: WALLET_ADDRESS, now: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`ClearShield running on port ${PORT}`);
});
