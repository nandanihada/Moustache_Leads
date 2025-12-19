// Test timezone conversion in JavaScript
const testDate = new Date('2025-12-19T00:28:12Z'); // UTC time

console.log('Original UTC:', testDate.toISOString());
console.log('UTC string:', testDate.toUTCString());

const formatted = testDate.toLocaleString('en-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
});

console.log('Formatted IST:', formatted + ' IST');
console.log('\nExpected: Should show 05:58:12 AM IST (UTC + 5:30)');
