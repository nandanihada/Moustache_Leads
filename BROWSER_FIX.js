// BROWSER CONSOLE FIX - Copy and paste this entire script into browser console
// This will fix the offers not showing issue

console.log('🔧 Starting Browser Fix for Offers Issue...');

const fixOffers = async () => {
  try {
    const baseUrl = 'http://localhost:5000';
    
    // Step 1: Register admin user
    console.log('1. Ensuring admin user exists...');
    
    try {
      const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          email: 'admin@ascend.com',
          password: 'admin123'
        })
      });
      
      if (registerResponse.status === 201) {
        console.log('✅ Admin user created!');
      } else if (registerResponse.status === 400) {
        console.log('✅ Admin user already exists!');
      }
    } catch (e) {
      console.log('⚠️ Register step skipped:', e.message);
    }
    
    // Step 2: Login and get token
    console.log('2. Logging in as admin...');
    
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok) {
      console.error('❌ Login failed:', await loginResponse.text());
      return;
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    
    console.log('✅ Login successful! Role:', loginData.user.role || 'user');
    
    // Save token to localStorage
    localStorage.setItem('token', token);
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Step 3: Check existing offers
    console.log('3. Checking existing offers...');
    
    const offersResponse = await fetch(`${baseUrl}/api/admin/offers`, {
      headers: headers
    });
    
    if (!offersResponse.ok) {
      console.error('❌ Offers API failed:', await offersResponse.text());
      return;
    }
    
    const offersData = await offersResponse.json();
    const existingOffers = offersData.offers || [];
    
    console.log(`📊 Found ${existingOffers.length} existing offers`);
    
    // Step 4: Create sample offers if none exist
    if (existingOffers.length === 0) {
      console.log('4. Creating sample offers...');
      
      const sampleOffers = [
        {
          campaign_id: 'BROWSER-001',
          name: 'Gaming Offer - Premium',
          description: 'High-converting gaming offer with excellent payouts',
          status: 'active',
          countries: ['US', 'CA', 'UK'],
          payout: 15.00,
          network: 'GameNetwork',
          short_description: 'Premium gaming offer',
          affiliates: 'all',
          image_url: 'https://via.placeholder.com/400x300/4F46E5/FFFFFF?text=Gaming+Offer',
          thumbnail_url: 'https://via.placeholder.com/150x150/4F46E5/FFFFFF?text=Game',
          target_url: 'https://example.com/gaming-offer',
          preview_url: 'https://example.com/gaming-preview',
          hash_code: 'GAME123',
          limit: 1000,
          expiration_date: '2024-12-31',
          device_targeting: 'all'
        },
        {
          campaign_id: 'BROWSER-002',
          name: 'Finance Leads - High Quality',
          description: 'Premium finance lead generation',
          status: 'active',
          countries: ['US', 'CA'],
          payout: 25.00,
          network: 'FinanceLeads',
          short_description: 'High-quality finance leads',
          affiliates: 'premium',
          image_url: 'https://via.placeholder.com/400x300/10B981/FFFFFF?text=Finance+Leads',
          thumbnail_url: 'https://via.placeholder.com/150x150/10B981/FFFFFF?text=Finance',
          target_url: 'https://example.com/finance-leads',
          preview_url: 'https://example.com/finance-preview',
          hash_code: 'FIN456',
          limit: 500,
          expiration_date: '2024-12-31',
          device_targeting: 'desktop'
        },
        {
          campaign_id: 'BROWSER-003',
          name: 'Mobile App Installs',
          description: 'Mobile app installation campaign',
          status: 'active',
          countries: ['US', 'CA', 'UK', 'AU'],
          payout: 8.50,
          network: 'MobileApps',
          short_description: 'Mobile app installs',
          affiliates: 'all',
          image_url: 'https://via.placeholder.com/400x300/F59E0B/FFFFFF?text=Mobile+Apps',
          thumbnail_url: 'https://via.placeholder.com/150x150/F59E0B/FFFFFF?text=App',
          target_url: 'https://example.com/mobile-app',
          preview_url: 'https://example.com/app-preview',
          hash_code: 'APP789',
          limit: 2000,
          expiration_date: '2024-12-31',
          device_targeting: 'mobile'
        }
      ];
      
      let createdCount = 0;
      
      for (let i = 0; i < sampleOffers.length; i++) {
        try {
          const createResponse = await fetch(`${baseUrl}/api/admin/offers`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(sampleOffers[i])
          });
          
          if (createResponse.ok) {
            const createData = await createResponse.json();
            createdCount++;
            console.log(`✅ Created offer ${i + 1}: ${createData.offer.offer_id} - ${sampleOffers[i].name}`);
          } else {
            console.error(`⚠️ Failed to create offer ${i + 1}:`, await createResponse.text());
          }
        } catch (e) {
          console.error(`⚠️ Error creating offer ${i + 1}:`, e.message);
        }
      }
      
      console.log(`📊 Successfully created ${createdCount} sample offers`);
    } else {
      console.log('✅ Offers already exist:');
      existingOffers.slice(0, 3).forEach(offer => {
        console.log(`   - ${offer.offer_id}: ${offer.name} ($${offer.payout})`);
      });
    }
    
    // Step 5: Final verification
    console.log('5. Final verification...');
    
    const finalCheck = await fetch(`${baseUrl}/api/admin/offers`, {
      headers: headers
    });
    
    if (finalCheck.ok) {
      const finalData = await finalCheck.json();
      const finalCount = finalData.offers ? finalData.offers.length : 0;
      
      console.log(`✅ Final count: ${finalCount} offers available`);
      
      if (finalCount > 0) {
        console.log('🎉 SUCCESS! Fix completed successfully!');
        console.log('=' .repeat(50));
        console.log('✅ Admin user ready');
        console.log(`✅ ${finalCount} offers available`);
        console.log('✅ Token saved to localStorage');
        console.log('');
        console.log('🔄 REFRESH THE PAGE NOW!');
        console.log('   The offers should now be visible');
        console.log('   If you\'re not on the offers page, go to: Admin → Offers');
        
        // Auto-refresh if on offers page
        if (window.location.pathname.includes('/admin') || window.location.pathname.includes('/offers')) {
          console.log('🔄 Auto-refreshing page in 3 seconds...');
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
        
        return true;
      } else {
        console.error('❌ No offers found after creation');
        return false;
      }
    } else {
      console.error('❌ Final verification failed:', await finalCheck.text());
      return false;
    }
    
  } catch (error) {
    console.error('💥 Fix error:', error);
    return false;
  }
};

// Run the fix
fixOffers().then(success => {
  if (success) {
    console.log('✅ Browser fix completed successfully!');
  } else {
    console.log('❌ Browser fix failed - check console for errors');
  }
});

// Helper function for manual testing
window.testOffersAPI = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.log('❌ No token found. Run the fix script first.');
    return;
  }
  
  try {
    const response = await fetch('http://localhost:5000/api/admin/offers', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Offers API test successful:', data);
      return data;
    } else {
      console.error('❌ Offers API test failed:', await response.text());
    }
  } catch (error) {
    console.error('❌ Offers API test error:', error);
  }
};

console.log('💡 After the fix completes, you can run testOffersAPI() to verify');
