// API Connectivity Test Script
// Run this in the browser console to debug the MRF creation issue

// Test 1: Basic connectivity to API base URL
console.log('Testing API connectivity...');

fetch('https://supply-chain-backend-hwh6.onrender.com/api', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
})
.then(response => {
  console.log('✅ API Base URL Response:', response.status, response.statusText);
  return response.text();
})
.then(data => {
  console.log('API Base Response Data:', data);
})
.catch(error => {
  console.error('❌ API Base URL Error:', error);
});

// Test 2: Test MRF endpoint specifically
console.log('Testing MRF endpoint...');

fetch('https://supply-chain-backend-hwh6.onrender.com/api/mrfs', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
})
.then(response => {
  console.log('✅ MRF Endpoint Response:', response.status, response.statusText);
  if (response.status === 401) {
    console.log('ℹ️  401 Unauthorized - This is expected without authentication');
  }
  return response.text();
})
.then(data => {
  console.log('MRF Endpoint Response Data:', data);
})
.catch(error => {
  console.error('❌ MRF Endpoint Error:', error);
});

// Test 3: Check CORS headers
console.log('Testing CORS...');

fetch('https://supply-chain-backend-hwh6.onrender.com/api', {
  method: 'OPTIONS',
  headers: {
    'Content-Type': 'application/json',
  },
})
.then(response => {
  console.log('✅ CORS Response:', response.status);
  console.log('CORS Headers:', {
    'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
    'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
    'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
  });
})
.catch(error => {
  console.error('❌ CORS Error:', error);
});

console.log('API connectivity tests completed. Check the console output above.');