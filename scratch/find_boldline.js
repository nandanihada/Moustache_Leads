
async function test() {
  try {
    const res = await fetch('http://localhost:8080/api/public/smart-link/offers?all_countries=true');
    const data = await res.json();
    const boldlineOffers = data.offers.filter(o => 
      (o.target_url && o.target_url.includes('boldline')) || 
      (o.preview_url && o.preview_url.includes('boldline'))
    );
    console.log('Found:', boldlineOffers.length);
    if (boldlineOffers.length > 0) {
      console.log(JSON.stringify(boldlineOffers[0], null, 2));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
