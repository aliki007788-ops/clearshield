require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const TronWeb = require('tronweb');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const WALLET_ADDRESS = process.env.TRON_WALLET_ADDRESS;

const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io',
  headers: { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY || '' }
});

// دیتابیس ساده (در production از MongoDB استفاده کنید)
const users = [];
const jobs = [];
const payments = [];

// لیست واقعی سایت‌های داده‌بروکر
const DATA_BROKERS = [
  { name: "Whitepages", url: "https://whitepages.com", removalUrl: "https://whitepages.com/optout" },
  { name: "Spokeo", url: "https://spokeo.com", removalUrl: "https://www.spokeo.com/optout" },
  { name: "Intelius", url: "https://intelius.com", removalUrl: "https://www.intelius.com/optout" },
  { name: "TruePeopleSearch", url: "https://truepeoplesearch.com", removalUrl: "https://www.truepeoplesearch.com/removal" },
  { name: "BeenVerified", url: "https://beenverified.com", removalUrl: "https://www.beenverified.com/app/optout/search" },
  { name: "FastPeopleSearch", url: "https://fastpeoplesearch.com", removalUrl: "https://www.fastpeoplesearch.com/removal" },
  { name: "Radaris", url: "https://radaris.com", removalUrl: "https://radaris.com/page/control/profile" },
  { name: "Veripages", url: "https://veripages.com", removalUrl: "https://veripages.com/opt-out/" },
  { name: "PeopleFinder", url: "https://peoplefinder.com", removalUrl: "https://www.peoplefinder.com/opt-out" },
  { name: "InstantCheckmate", url: "https://instantcheckmate.com", removalUrl: "https://www.instantcheckmate.com/optout" }
];

// API Routes
app.get('/config', (req, res) => {
  res.json({ 
    wallet: WALLET_ADDRESS,
    status: 'active',
    version: '1.0'
  });
});

// تایید واقعی تراکنش USDT
async function verifyUSDTTransaction(txId, expectedAmount) {
  try {
    console.log(`Verifying transaction: ${txId}`);
    
    const transaction = await tronWeb.trx.getTransaction(txId);
    if (!transaction) {
      console.log('Transaction not found');
      return false;
    }

    const transactionInfo = await tronWeb.trx.getTransactionInfo(txId);
    if (!transactionInfo || transactionInfo.receipt?.result !== 'SUCCESS') {
      console.log('Transaction failed or not confirmed');
      return false;
    }

    // بررسی لاگ‌های تراکنش برای انتقال USDT
    for (const log of transactionInfo.log || []) {
      if (log.topics && log.topics[0] === 'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
        // این Transfer event هست
        const fromAddress = '41' + log.topics[1].slice(-40);
        const toAddress = '41' + log.topics[2].slice(-40);
        const amountHex = log.data;
        
        // تبدیل مقدار از هگزادسیمال
        const amount = parseInt(amountHex, 16) / 1000000; // USDT has 6 decimals
        
        console.log(`Transfer: ${amount} USDT from ${fromAddress} to ${toAddress}`);
        
        // بررسی آیا به والت ما واریز شده
        if (toAddress === WALLET_ADDRESS && amount >= expectedAmount) {
          console.log('Valid USDT transfer to our wallet');
          return {
            success: true,
            amount: amount,
            from: fromAddress
          };
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Transaction verification error:', error);
    return false;
  }
}

// اسکن واقعی داده‌ها (شبیه‌سازی شده)
async function performDataScan(email) {
  // در نسخه واقعی، اینجا API سایت‌های داده‌بروکر رو فراخوانی کنید
  return new Promise((resolve) => {
    setTimeout(() => {
      // شبیه‌سازی پیدا کردن داده‌ها در سایت‌های مختلف
      const foundSites = DATA_BROKERS.filter(() => Math.random() > 0.3);
      const personalInfo = {
        name: "John Doe", // در واقعیت از API داده‌بروکرها گرفته میشه
        age: "35-40",
        location: "New York, NY",
        relatives: ["Jane Doe", "Robert Doe"]
      };
      
      resolve({
        sitesFound: foundSites.length,
        sites: foundSites,
        personalInfo: personalInfo,
        riskScore: Math.floor(Math.random() * 100)
      });
    }, 3000);
  });
}

// حذف واقعی داده‌ها (شبیه‌سازی شده)
async function performDataRemoval(email, sites) {
  // در نسخه واقعی، اینجا فرآیند حذف دستی انجام میشه
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        removedCount: sites.length,
        sites: sites,
        removalId: 'RM' + Date.now(),
        completionTime: new Date().toISOString()
      });
    }, 5000);
  });
}

// endpoint پرداخت و اسکن
app.post('/scan-data', async (req, res) => {
  try {
    const { txId, email } = req.body;
    
    if (!txId || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'MISSING_PARAMETERS',
        message: 'Transaction ID and email are required'
      });
    }

    // تایید پرداخت 9 USDT
    const paymentVerification = await verifyUSDTTransaction(txId, 9);
    if (!paymentVerification) {
      return res.status(400).json({
        success: false,
        error: 'PAYMENT_NOT_VERIFIED',
        message: 'Payment verification failed'
      });
    }

    // ذخیره پرداخت
    const payment = {
      id: 'PAY_' + Date.now(),
      txId: txId,
      email: email,
      amount: paymentVerification.amount,
      type: 'scan',
      status: 'verified',
      date: new Date().toISOString()
    };
    payments.push(payment);

    // ایجاد job جدید
    const job = {
      id: 'SCAN_' + Date.now(),
      email: email,
      type: 'scan',
      status: 'processing',
      paymentId: payment.id,
      createdAt: new Date().toISOString()
    };
    jobs.push(job);

    // انجام اسکن
    const scanResults = await performDataScan(email);
    
    // آپدیت job
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.results = scanResults;

    res.json({
      success: true,
      jobId: job.id,
      message: 'Data scan completed successfully',
      results: scanResults
    });

  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// endpoint حذف داده‌ها
app.post('/remove-data', async (req, res) => {
  try {
    const { txId, email, sites } = req.body;
    
    if (!txId || !email || !sites) {
      return res.status(400).json({ 
        success: false, 
        error: 'MISSING_PARAMETERS',
        message: 'Transaction ID, email and sites are required'
      });
    }

    // تایید پرداخت 29 USDT
    const paymentVerification = await verifyUSDTTransaction(txId, 29);
    if (!paymentVerification) {
      return res.status(400).json({
        success: false,
        error: 'PAYMENT_NOT_VERIFIED',
        message: 'Payment verification failed'
      });
    }

    // ذخیره پرداخت
    const payment = {
      id: 'PAY_' + Date.now(),
      txId: txId,
      email: email,
      amount: paymentVerification.amount,
      type: 'removal',
      status: 'verified',
      date: new Date().toISOString()
    };
    payments.push(payment);

    // ایجاد job حذف
    const job = {
      id: 'REMOVE_' + Date.now(),
      email: email,
      type: 'removal',
      status: 'processing',
      paymentId: payment.id,
      sitesToRemove: sites,
      createdAt: new Date().toISOString()
    };
    jobs.push(job);

    // انجام حذف
    const removalResults = await performDataRemoval(email, sites);
    
    // آپدیت job
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.results = removalResults;

    res.json({
      success: true,
      jobId: job.id,
      message: 'Data removal process started successfully',
      results: removalResults
    });

  } catch (error) {
    console.error('Removal error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// دریافت وضعیت job
app.get('/job-status/:jobId', (req, res) => {
  const job = jobs.find(j => j.id === req.params.jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'JOB_NOT_FOUND'
    });
  }
  
  res.json({
    success: true,
    job: job
  });
});

// آمار برای پنل مدیریت
app.get('/admin/stats', (req, res) => {
  const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter(job => job.status === 'completed').length;
  
  res.json({
    success: true,
    stats: {
      totalRevenue: totalRevenue,
      totalJobs: totalJobs,
      completedJobs: completedJobs,
      pendingJobs: totalJobs - completedJobs,
      totalPayments: payments.length
    },
    recentPayments: payments.slice(-5).reverse()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 ClearShield Revenue App running on port ${PORT}`);
  console.log(`💰 Wallet: ${WALLET_ADDRESS}`);
  console.log(`💸 Scan Price: 9 USDT | Removal Price: 29 USDT`);
});
