const bcrypt = require('bcrypt');

const plainPassword = 'YOUR_PLAIN_PASSWORD_HERE';
const storedHash = '$2b$10$ws.H.Bz51k9rs1ZzqOsUCexK0o6B7sUWMfzzVgeRVIrZAFtzf.1GS';

// Test 1: Generate new hash and compare (should work)
const newHash = bcrypt.hashSync(plainPassword, 10);
console.log('New Hash:', newHash);
const compareNewSync = bcrypt.compareSync(plainPassword, newHash);
console.log('Compare New Hash (sync):', compareNewSync);

// Test 2: Compare stored hash (sync)
const compareStoredSync = bcrypt.compareSync(plainPassword, storedHash);
console.log('Compare Stored Hash (sync):', compareStoredSync);

// Test 3: Compare stored hash (async, for comparison)
bcrypt.compare(plainPassword, storedHash, (err, result) => {
  if (err) {
    console.error('Async Compare Error:', err);
  } else {
    console.log('Compare Stored Hash (async):', result);
  }
});
