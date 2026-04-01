// CORS and API Diagnostic Test
// Run this in browser console to diagnose the MRF creation issue

console.log('🔍 CORS & API Diagnostic Test');
console.log('================================');

// Test 1: Check current origin
console.log('1. Current Frontend Origin:', window.location.origin);

// Test 2: Test basic connectivity without CORS
console.log('2. Testing basic connectivity...');
fetch('https://supply-chain-backend-hwh6.onrender.com/api', {
  method: 'GET',
  mode: 'no-cors' // This will prevent CORS errors but won't give us response details
})
.then(response => {
  console.log('✅ Basic connectivity (no-cors):', response.type, response.status);
})
.catch(error => {
  console.error('❌ Basic connectivity failed:', error);
});

// Test 3: Test with explicit CORS headers (should fail with CORS error)
console.log('3. Testing CORS preflight...');
fetch('https://supply-chain-backend-hwh6.onrender.com/api/mrfs', {
  method: 'OPTIONS',
  headers: {
    'Origin': window.location.origin,
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type,authorization'
  }
})
.then(response => {
  console.log('✅ CORS preflight response:', response.status, response.statusText);
  const corsHeaders = {
    'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
    'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
    'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
    'Access-Control-Allow-Credentials': response.headers.get('Access-Control-Allow-Credentials')
  };
  console.log('CORS Headers:', corsHeaders);
})
.catch(error => {
  console.error('❌ CORS preflight failed:', error);
});

// Test 4: Try to get actual error from server (will likely fail due to CORS)
console.log('4. Testing actual MRF endpoint (will likely fail due to CORS)...');
fetch('https://supply-chain-backend-hwh6.onrender.com/api/mrfs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test' // This will fail auth but should give us CORS info
  },
  body: JSON.stringify({
    title: 'Test MRF',
    description: 'Test description',
    category: 'Test',
    quantity: '1',
    urgency: 'Low',
    justification: 'Test',
    department: 'Test',
    estimatedCost: '100'
  })
})
.then(response => {
  console.log('✅ MRF POST response (unexpected):', response.status, response.statusText);
  return response.text();
})
.then(text => {
  console.log('Response body:', text);
})
.catch(error => {
  console.error('❌ MRF POST failed (expected due to CORS):', error.message);
});

// Test 5: Check if server is responding at all
console.log('5. Testing server availability...');
fetch('https://supply-chain-backend-hwh6.onrender.com/', {
  method: 'GET'
})
.then(response => {
  console.log('✅ Server root response:', response.status, response.statusText);
  return response.text();
})
.then(text => {
  console.log('Server root content (first 200 chars):', text.substring(0, 200));
})
.catch(error => {
  console.error('❌ Server root failed:', error);
});

console.log('================================');
console.log('Diagnostic test completed. Check results above.');
console.log('');
console.log('🔧 IMMEDIATE FIXES TO TRY:');
console.log('1. Backend CORS: Add your frontend origin to allowed origins');
console.log('2. Backend Error: Check server logs for the 500 error details');
console.log('3. Temporary: Use a proxy or local backend for testing');