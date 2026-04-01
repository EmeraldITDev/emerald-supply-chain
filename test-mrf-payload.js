// Test MRF Creation Payload
// Run this in browser console to test with a minimal payload

console.log('🧪 Testing MRF Creation with Minimal Payload');

// Get auth token
const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

if (!token) {
  console.error('❌ No auth token found. Please log in first.');
} else {
  console.log('✅ Auth token found');

  // Minimal test payload
  const testPayload = {
    title: 'Test MRF - CORS Debug',
    description: 'Testing MRF creation after CORS fix',
    category: 'Office Supplies',
    quantity: '1',
    urgency: 'Low',
    justification: 'Testing CORS and API connectivity',
    department: 'IT',
    estimatedCost: '100'
  };

  console.log('📤 Sending test payload:', testPayload);

  // Test with fetch (will fail with CORS until backend is fixed)
  fetch('https://supply-chain-backend-hwh6.onrender.com/api/mrfs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(testPayload)
  })
  .then(response => {
    console.log('✅ Response received:', response.status, response.statusText);
    console.log('Response headers:', {
      'content-type': response.headers.get('content-type'),
      'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
      'access-control-allow-methods': response.headers.get('access-control-allow-methods')
    });
    return response.text();
  })
  .then(text => {
    console.log('📄 Response body:', text);
    try {
      const json = JSON.parse(text);
      console.log('📋 Parsed JSON response:', json);
    } catch (e) {
      console.log('Response is not JSON');
    }
  })
  .catch(error => {
    console.error('❌ Request failed:', error);

    // Check if it's a CORS error
    if (error.message.includes('CORS') || error.message.includes('Cross-Origin')) {
      console.log('🔒 This is a CORS error. Backend needs CORS configuration.');
      console.log('📖 See CORS_FIX_GUIDE.md for backend configuration instructions.');
    } else if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
      console.log('🌐 This is a network connectivity error.');
      console.log('🔍 Check if backend server is running and accessible.');
    }
  });
}

console.log('🧪 Test completed. Check results above.');