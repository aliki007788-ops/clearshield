require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const TronWeb = require('tronweb');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());

// سرویس فایل‌های استاتیک از پوشه public
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const WALLET_ADDRESS = process.env.TRON_WALLET_ADDRESS;

const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io',
  headers: { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY || '' }
});

// داده‌های موقت
const jobs = [];
const payments = [];

// سایت‌های داده‌بروکر
const DATA_BROKERS = [
  { name: "Whitepages", url: "https://whitepages.com" },
  { name: "Spokeo", url: "https://spokeo.com" },
  { name: "Intelius", url: "https://intelius.com" },
  { name: "TruePeopleSearch", url: "https://truepeoplesearch.com" },
  { name: "BeenVerified", url: "https://beenverified.com" },
  { name: "FastPeopleSearch", url: "https://fastpeoplesearch.com" },
  { name: "Radaris", url: "https://radaris.com" },
  { name: "Veripages", url: "https://veripages.com" }
];

// Route اصلی - سرویس index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API برای گرفتن تنظیمات
app.get('/config', (req, res) => {
  res.json({ 
    wallet: WALLET_ADDRESS,
    status: 'active'
  });
});

// تایید تراکنش
async function verifyUSDTTransaction(txId, expectedAmount) {
  try {
    console.log('Verifying transaction:', txId);
    
    // شبیه‌سازی تایید تراکنش - در نسخه واقعی باید پیاده‌سازی بشه
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // برای تست، همیشه true برمی‌گردونه
    return {
      success: true,
      amount: expectedAmount,
      from: 'TDN3QZCFCQMVQST5U4SJMPCKDKPPBT5C3KJZQTY'
    };
  } catch (error) {
    console.error('Transaction verification error:', error);
    return false;
  }
}

// اسکن داده
app.post('/scan-data', async (req, res) => {
  try {
    const { txId, email } = req.body;
    
    if (!txId || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing parameters'
      });
    }

    // تایید پرداخت
    const paymentVerification = await verifyUSDTTransaction(txId, 9);
    if (!paymentVerification) {
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed'
      });
    }

    // ذخیره پرداخت
    const payment = {
      id: 'PAY_' + Date.now(),
      txId: txId,
      email: email,
      amount: 9,
      type: 'scan',
      date: new Date().toISOString()
    };
    payments.push(payment);

    // شبیه‌سازی اسکن
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // نتایج شبیه‌سازی شده
    const foundCount = 5 + Math.floor(Math.random() * 6); // 5-10 سایت
    const foundSites = DATA_BROKERS.slice(0, foundCount);
    
    const scanResults = {
      sitesFound: foundCount,
      sites: foundSites,
      personalInfo: {
        name: "John Doe",
        age: "35-40",
        location: "New York, NY",
        relatives: ["Jane Doe", "Robert Doe"]
      },
      riskScore: 60 + Math.floor(Math.random() * 40)
    };

    // ذخیره job
    const job = {
      id: 'SCAN_' + Date.now(),
      email: email,
      type: 'scan',
      status: 'completed',
      results: scanResults,
      createdAt: new Date().toISOString()
    };
    jobs.push(job);

    res.json({
      success: true,
      jobId: job.id,
      results: scanResults
    });

  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// حذف داده
app.post('/remove-data', async (req, res) => {
  try {
    const { txId, email, sites } = req.body;
    
    if (!txId || !email || !sites) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing parameters'
      });
    }

    // تایید پرداخت
    const paymentVerification = await verifyUSDTTransaction(txId, 29);
    if (!paymentVerification) {
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed'
      });
    }

    // ذخیره پرداخت
    const payment = {
      id: 'PAY_' + Date.now(),
      txId: txId,
      email: email,
      amount: 29,
      type: 'removal',
      date: new Date().toISOString()
    };
    payments.push(payment);

    // شبیه‌سازی حذف
    await new Promise(resolve => setTimeout(resolve, 2000));

    const job = {
      id: 'REMOVE_' + Date.now(),
      email: email,
      type: 'removal',
      status: 'completed',
      sitesRemoved: sites.length,
      createdAt: new Date().toISOString()
    };
    jobs.push(job);

    res.json({
      success: true,
      jobId: job.id,
      message: `Data removal started for ${sites.length} sites`
    });

  } catch (error) {
    console.error('Removal error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Scan: 9 USDT | Removal: 29 USDT`);
  console.log(`👛 Wallet: ${WALLET_ADDRESS}`);
});
