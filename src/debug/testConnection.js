// Frontend Debug Script - Test Backend Connection
// Run this in browser console to debug offers not showing

console.log('🔍 Testing Backend Connection...');

// Test 1: Health Check
fetch('http://localhost:5000/health')
  .then(response => response.json())
  .then(data => {
    console.log('✅ Health Check:', data);
  })
  .catch(error => {
    console.error('❌ Health Check Failed:', error);
  });

// Test 2: Login and Get Offers
const testLogin = async () => {
  try {
    console.log('🔐 Testing login...');
    
    // Login
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok) {
      console.error('❌ Login failed:', await loginResponse.text());
      
      // Try to register admin user
      console.log('🔧 Trying to register admin user...');
      const registerResponse = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'admin',
          email: 'admin@ascend.com',
          password: 'admin123'
        })
      });
      
      console.log('Register response:', registerResponse.status, await registerResponse.text());
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login successful:', loginData.user);
    
    const token = loginData.token;
    localStorage.setItem('token', token);
    
    // Get offers
    console.log('📋 Testing offers API...');
    const offersResponse = await fetch('http://localhost:5000/api/admin/offers', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!offersResponse.ok) {
      console.error('❌ Offers API failed:', await offersResponse.text());
      return;
    }
    
    const offersData = await offersResponse.json();
    console.log('✅ Offers retrieved:', offersData);
    
    if (offersData.offers && offersData.offers.length === 0) {
      console.log('📝 No offers found, creating sample offer...');
      
      // Create sample offer
      const sampleOffer = {
        campaign_id: 'FRONTEND-DEBUG-001',
        name: 'Frontend Debug Test Offer',
        description: 'Test offer created from frontend debug',
        status: 'active',
        countries: ['US', 'CA'],
        payout: 12.50,
        network: 'DebugNetwork',
        target_url: 'https://example.com/debug-offer'
      };
      
      const createResponse = await fetch('http://localhost:5000/api/admin/offers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sampleOffer)
      });
      
      if (createResponse.ok) {
        const createData = await createResponse.json();
        console.log('✅ Sample offer created:', createData.offer);
      } else {
        console.error('❌ Failed to create sample offer:', await createResponse.text());
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Run the test
testLogin();

// Helper function to quickly login (for manual testing)
window.quickLogin = async () => {
  const response = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  
  if (response.ok) {
    const data = await response.json();
    localStorage.setItem('token', data.token);
    console.log('✅ Logged in successfully! Token saved.');
    return data;
  } else {
    console.error('❌ Login failed:', await response.text());
  }
};

console.log('💡 Run quickLogin() to manually login and save token');
console.log('💡 Then refresh the admin offers page');
