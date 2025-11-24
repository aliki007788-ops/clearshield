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
    // Hide all steps
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.add('hidden');
    document.getElementById('step4').classList.add('hidden');
    
    // Show target step
    document.getElementById('step' + stepNumber).classList.remove('hidden');
}

// Step 1: Start scan process
function startScan() {
    const email = document.getElementById('emailInput').value.trim();
    
    // Validate email
    if (!email || !isValidEmail(email)) {
        showError('Please enter a valid email address');
        return;
    }
    
    currentEmail = email;
    showStep(2);
}

// Step 2: Process payment for scan
async function processPayment() {
    // Check if TronLink is available
    if (!window.tronWeb?.ready) {
        showError('Please install and unlock TronLink wallet to make payment');
        return;
    }

    // Show loading state
    document.getElementById('paymentStatus').classList.remove('hidden');
    
    try {
        // Initialize contract
        const contract = await window.tronWeb.contract().at("TR7NHqjeKQxGTCuuQdCA3f2Y2Y8pSQ9e6");
        
        // Execute payment
        const transaction = await contract.transfer(WALLET_ADDRESS, 9 * 1000000).send({ 
            feeLimit: 40000000 
        });

        console.log('💰 Payment transaction:', transaction);

        // Send to server for verification and processing
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
        document.getElementById('paymentStatus').classList.add('hidden');
    }
}

// Step 3: Display scan results
function displayScanResults(results) {
    const resultsContent = document.getElementById('resultsContent');
    
    // Determine risk level
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
                <div class="
