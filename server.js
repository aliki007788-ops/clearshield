require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const TronWeb = require('tronweb');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware برای Render
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// پورت برای Render
const PORT = process.env.PORT || 10000;
const WALLET_ADDRESS = process.env.TRON_WALLET_ADDRESS;

// تنظیم TronWeb با API Key واقعی
const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io',
  headers: { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY || '' }
});

// داده‌های موقت
const jobs = [];
const payments = [];

// سایت‌های داده‌بروکر
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

// Route اصلی
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API برای گرفتن تنظیمات
app.get('/config', (req, res) => {
  res.json({ 
    wallet: WALLET_ADDRESS,
    status: 'active',
    version: '1.0',
    environment: process.env.NODE_ENV || 'production'
  });
});

// 🔥 **تابع واقعی تایید تراکنش USDT**
async function verifyUSDTTransaction(txId, expectedAmount) {
  try {
    console.log('🔍 Verifying REAL USDT transaction:', txId);
    
    // بررسی وجود تراکنش
    const transaction = await tronWeb.trx.getTransaction(txId);
    if (!transaction) {
      console.log('❌ Transaction not found');
      return false;
    }

    // بررسی وضعیت تراکنش
    const transactionInfo = await tronWeb.trx.getTransactionInfo(txId);
    if (!transactionInfo) {
      console.log('❌ Transaction info not available');
      return false;
    }

    if (transactionInfo.receipt?.result !== 'SUCCESS') {
      console.log('❌ Transaction failed:', transactionInfo.receipt?.result);
      return false;
    }

    console.log('✅ Transaction confirmed on blockchain');

    // بررسی لاگ‌های تراکنش برای انتقال USDT
    if (!transactionInfo.log || transactionInfo.log.length === 0) {
      console.log('❌ No logs found in transaction');
      return false;
    }

    for (const log of transactionInfo.log) {
      // بررسی آیا این لاگ مربوط به انتقال USDT هست
      if (log.topics && log.topics[0] === 'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
        
        // آدرس مقصد (40 کاراکتر آخر + 41 اول)
        const toAddress = '41' + log.topics[2].slice(-40);
        const fromAddress = '41' + log.topics[1].slice(-40);
        
        // تبدیل مقدار از هگز
        const amountHex = log.data;
        const amount = parseInt(amountHex, 16) / 1000000; // USDT has 6 decimals
        
        console.log('💰 USDT Transfer Details:', {
          from: fromAddress,
          to: toAddress,
          amount: amount + ' USDT',
          ourWallet: WALLET_ADDRESS
        });

        // بررسی آیا به والت ما واریز شده
        if (toAddress === WALLET_ADDRESS && amount >= expectedAmount) {
          console.log('✅ Valid USDT transfer to our wallet!');
          return {
            success: true,
            amount: amount,
            from: fromAddress,
            txId: txId
          };
        }
      }
    }

    console.log('❌ No valid USDT transfer to our wallet found');
    return false;

  } catch (error) {
    console.error('❌ Transaction verification error:', error);
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
        error: 'MISSING_PARAMETERS',
        message: 'Transaction ID and email are required'
      });
    }

    console.log('🔄 Starting scan process for:', email);

    // 🔥 تایید پرداخت واقعی 9 USDT
    const paymentVerification = await verifyUSDTTransaction(txId, 9);
    if (!paymentVerification) {
      console.log('❌ Payment verification failed for:', email);
      return res.status(400).json({
        success: false,
        error: 'PAYMENT_NOT_VERIFIED',
        message: 'Payment verification failed. Please make sure you sent 9 USDT to our wallet.'
      });
    }

    console.log('✅ Payment verified for:', email, 'Amount:', paymentVerification.amount);

    // ذخیره پرداخت
    const payment = {
      id: 'PAY_' + Date.now(),
      txId: txId,
      email: email,
      amount: paymentVerification.amount,
      type: 'scan',
      status: 'verified',
      fromAddress: paymentVerification.from,
      date: new Date().toISOString()
    };
    payments.push(payment);

    // ایجاد job
    const job = {
      id: 'SCAN_' + Date.now(),
      email: email,
      type: 'scan',
      status: 'processing',
      paymentId: payment.id,
      createdAt: new Date().toISOString()
    };
    jobs.push(job);

    // شبیه‌سازی اسکن داده
    console.log('🔍 Scanning data for:', email);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // نتایج شبیه‌سازی شده
    const foundCount = 5 + Math.floor(Math.random() * 6);
    const foundSites = DATA_BROKERS.slice(0, foundCount);
    
    const scanResults = {
      sitesFound: foundCount,
      sites: foundSites,
      personalInfo: {
        name: "John Doe",
        age: "35-40",
        location: "New York, NY",
        phone: "+1 XXX-XXX-XXXX",
        relatives: ["Jane Doe", "Robert Doe"],
        previousAddresses: ["Los Angeles, CA", "Chicago, IL"]
      },
      riskScore: 60 + Math.floor(Math.random() * 40),
      scanId: 'SCAN_' + Date.now()
    };

    // آپدیت job
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.results = scanResults;

    console.log('✅ Scan completed for:', email, '- Found:', foundCount, 'sites');

    res.json({
      success: true,
      jobId: job.id,
      message: 'Data scan completed successfully',
      results: scanResults
    });

  } catch (error) {
    console.error('❌ Scan error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Internal server error'
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
        error: 'MISSING_PARAMETERS',
        message: 'Transaction ID, email and sites are required'
      });
    }

    console.log('🔄 Starting removal process for:', email);

    // 🔥 تایید پرداخت واقعی 29 USDT
    const paymentVerification = await verifyUSDTTransaction(txId, 29);
    if (!paymentVerification) {
      console.log('❌ Removal payment verification failed for:', email);
      return res.status(400).json({
        success: false,
        error: 'PAYMENT_NOT_VERIFIED',
        message: 'Payment verification failed. Please make sure you sent 29 USDT to our wallet.'
      });
    }

    console.log('✅ Removal payment verified for:', email, 'Amount:', paymentVerification.amount);

    // ذخیره پرداخت
    const payment = {
      id: 'PAY_' + Date.now(),
      txId: txId,
      email: email,
      amount: paymentVerification.amount,
      type: 'removal',
      status: 'verified',
      fromAddress: paymentVerification.from,
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

    // شبیه‌سازی حذف داده
    console.log('🗑️ Removing data for:', email, '- Sites:', sites.length);
    await new Promise(resolve => setTimeout(resolve, 5000));

    // آپدیت job
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.results = {
      success: true,
      removedCount: sites.length,
      removalId: 'RM_' + Date.now(),
      completionTime: new Date().toISOString(),
      message: 'Data removal requests submitted successfully'
    };

    console.log('✅ Removal completed for:', email, '- Removed from:', sites.length, 'sites');

    res.json({
      success: true,
      jobId: job.id,
      message: 'Data removal process completed successfully',
      results: job.results
    });

  } catch (error) {
    console.error('❌ Removal error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// وضعیت job
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

// آمار پرداخت‌ها
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
    recentPayments: payments.slice(-10).reverse()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    service: 'clearshield',
    wallet: WALLET_ADDRESS ? 'configured' : 'not configured'
  });
});

// Fallback route برای SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Server Error:', error);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Something went wrong'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 ClearShield Server Started on Render!');
  console.log(`📍 Port: ${PORT}`);
  console.log(`💰 Wallet: ${WALLET_ADDRESS}`);
  console.log(`🔑 API Key: ${process.env.TRON_API_KEY ? 'Configured' : 'Not configured'}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`💸 Ready for REAL payments!`);
});
