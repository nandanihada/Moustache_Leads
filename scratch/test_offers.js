
async function test() {
  try {
    const res = await fetch('http://localhost:8080/api/public/smart-link/offers?all_countries=true');
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
