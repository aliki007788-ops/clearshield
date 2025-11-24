// Global variables
let currentEmail = '';
let scanResults = null;
let WALLET_ADDRESS = '';

// Initialize application
async function initializeApp() {
    try {
        const response = await fetch('/config');
        const config = await response.json();
        WALLET_ADDRESS = config.wallet;
        console.log('✅ App initialized with wallet:', WALLET_ADDRESS);
    } catch (error) {
        console.error('❌ Failed to load config:', error);
        showError('Failed to connect to service. Please refresh the page.');
    }
}

// Step navigation
function showStep(stepNumber) {
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.add('hidden');
    document.getElementById('step4').classList.add('hidden');
    document.getElementById('step' + stepNumber).classList.remove('hidden');
}

// Step 1: Start scan process
function startScan() {
    const email = document.getElementById('emailInput').value.trim();
    
    if (!email || !isValidEmail(email)) {
        showError('Please enter a valid email address');
        return;
    }
    
    currentEmail = email;
    showStep(2);
}

// 🔥 تابع پرداخت واحد برای همه کاربران
async function processPayment(amount) {
    try {
        // بررسی آیا TronLink در دسترس هست
        if (typeof window.tronLink !== 'undefined') {
            const transaction = await window.tronLink.request({
                method: 'tron_sendTransaction',
                params: [{
                    to: WALLET_ADDRESS,
                    amount: amount * 1000000,
                    contractAddress: "TR7NHqjeKQxGTCuuQdCA3f2Y2Y8pSQ9e6"
                }]
            });
            return transaction;
        } else {
            throw new Error('Please install TronLink wallet from https://www.tronlink.org/');
        }
    } catch (error) {
        console.error('❌ Payment error:', error);
        throw error;
    }
}

// Step 2: Process payment for scan
async function processPaymentForScan() {
    const paymentStatus = document.getElementById('paymentStatus');
    const payButton = document.querySelector('#step2 button');
    
    paymentStatus.classList.remove('hidden');
    payButton.disabled = true;
    payButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';
    
    try {
        const transaction = await processPayment(9);
        console.log('💰 Payment transaction:', transaction);

        const response = await fetch('/scan-data', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                txId: transaction,
                email: currentEmail
            })
        });

        const result = await response.json();
        
        if (result.success) {
            scanResults = result.results;
            showStep(3);
            displayScanResults(result.results);
        } else {
            showError('Payment verification failed: ' + (result.message || result.error));
        }

    } catch (error) {
        console.error('❌ Payment error:', error);
        showError('Payment failed: ' + error.message);
    } finally {
        paymentStatus.classList.add('hidden');
        payButton.disabled = false;
        payButton.innerHTML = '<i class="fas fa-credit-card mr-3"></i>Pay 9 USDT Now';
    }
}

// Step 3: Display scan results
function displayScanResults(results) {
    const resultsContent = document.getElementById('resultsContent');
    
    const riskLevel = results.riskScore >= 80 ? 'high' : results.riskScore >= 60 ? 'medium' : 'low';
    const riskColor = riskLevel === 'high' ? 'risk-high' : riskLevel === 'medium' ? 'risk-medium' : 'risk-low';
    
    let html = `
        <div class="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <div class="flex items-center gap-3 mb-2">
                <i class="fas fa-exclamation-triangle text-red-500 text-xl"></i>
                <div>
                    <h3 class="font-semibold text-lg">Privacy Risk Assessment</h3>
                    <p class="text-gray-300">Your data exposure level</p>
                </div>
            </div>
            <div class="mt-3">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-gray-300">Risk Score:</span>
                    <span class="font-bold text-xl ${riskColor}">${results.riskScore}%</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-gray-300">Sites Found:</span>
                    <span class="font-bold text-orange-500">${results.sitesFound} data broker sites</span>
                </div>
            </div>
        </div>

        <div class="bg-white/5 rounded-xl p-4">
            <h3 class="font-semibold mb-3 flex items-center gap-2">
                <i class="fas fa-user-circle text-orange-500"></i>
                Personal Information Found
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="flex justify-between p-2 bg-white/5 rounded">
                    <span class="text-gray-400">Full Name:</span>
                    <span class="font-semibold">${results.personalInfo.name}</span>
                </div>
                <div class="flex justify-between p-2 bg-white/5 rounded">
                    <span class="text-gray-400">Age Range:</span>
                    <span class="font-semibold">${results.personalInfo.age}</span>
                </div>
                <div class="flex justify-between p-2 bg-white/5 rounded">
                    <span class="text-gray-400">Location:</span>
                    <span class="font-semibold">${results.personalInfo.location}</span>
                </div>
                <div class="flex justify-between p-2 bg-white/5 rounded">
                    <span class="text-gray-400">Phone:</span>
                    <span class="font-semibold">${results.personalInfo.phone}</span>
                </div>
            </div>
        </div>

        <div class="bg-white/5 rounded-xl p-4">
            <h3 class="font-semibold mb-3 flex items-center gap-2">
                <i class="fas fa-globe-americas text-orange-500"></i>
                Data Broker Sites with Your Information
            </h3>
            <div class="space-y-3 max-h-80 overflow-y-auto scrollable">
    `;

    results.sites.forEach(site => {
        html += `
                <div class="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div class="flex items-center gap-3">
                        <i class="fas fa-database text-orange-500"></i>
                        <div>
                            <div class="font-semibold">${site.name}</div>
                            <div class="text-sm text-gray-400">${site.url}</div>
                        </div>
                    </div>
                    <span class="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-medium">Data Found</span>
                </div>
        `;
    });

    html += `
            </div>
            <p class="text-sm text-gray-400 mt-3 text-center">
                ${results.sitesFound} sites found containing your personal information
            </p>
        </div>
    `;

    resultsContent.innerHTML = html;
}

// Step 4: Show removal option
function showRemovalOption() {
    showStep(4);
}

// Step 5: Process removal payment
async function processRemovalPayment() {
    const removalStatus = document.getElementById('removalStatus');
    const removeButton = document.querySelector('#step4 button');
    
    removalStatus.classList.remove('hidden');
    removeButton.disabled = true;
    removeButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';

    try {
        const transaction = await processPayment(29);
        console.log('💰 Removal payment transaction:', transaction);

        const response = await fetch('/remove-data', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                txId: transaction,
                email: currentEmail,
                sites: scanResults.sites
            })
        });

        const result = await response.json();
        
        if (result.success) {
            showSuccess(
                'Data Removal Started Successfully!', 
                'Our team will manually remove your data from all ' + scanResults.sitesFound + ' sites. ' +
                'You will receive a detailed completion report within 48 hours via email.'
            );
            
            showStep(1);
            document.getElementById('emailInput').value = '';
            currentEmail = '';
            scanResults = null;
        } else {
            showError('Removal payment verification failed: ' + (result.message || result.error));
        }

    } catch (error) {
        console.error('❌ Removal payment error:', error);
        showError('Removal payment failed: ' + error.message);
    } finally {
        removalStatus.classList.add('hidden');
        removeButton.disabled = false;
        removeButton.innerHTML = '<i class="fas fa-credit-card mr-3"></i>Pay 29 USDT & Remove All Data';
    }
}

// Utility functions
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showError(message) {
    alert('❌ Error: ' + message);
}

function showSuccess(title, message) {
    alert('✅ ' + title + '\n\n' + message);
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    showStep(1);
    
    document.getElementById('emailInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            startScan();
        }
    });
});
