async function test() {
  console.log('--- 1. Testing Registration ---');
  const regPayload = {
    academyName: 'Test Academy ' + Date.now().toString(36),
    sport: 'FOOTBALL',
    name: 'Test Owner',
    email: 'testowner_' + Date.now().toString(36) + '@example.com',
    password: 'Password123!',
    phone: '+966500000000'
  };

  try {
    const res = await fetch('http://localhost:3000/v1/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000'
      },
      body: JSON.stringify(regPayload)
    });
    const text = await res.text();
    console.log('Register HTTP Status:', res.status);
    console.log('Register Response Body:', text);
  } catch (err) {
    console.error('Register Fetch Error:', err);
  }

  console.log('\n--- 2. Testing Login With Origin Header ---');
  try {
    const res = await fetch('http://localhost:3000/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://unit-purpose-horn-boundary.trycloudflare.com',
        'Cookie': 'access_token=some_old_token'
      },
      body: JSON.stringify({
        email: 'admin@academy.sa',
        password: 'AdminPass123!'
      })
    });
    const text = await res.text();
    console.log('Login HTTP Status (with tunnel origin & cookie):', res.status);
    console.log('Login Response Body:', text);
  } catch (err) {
    console.error('Login Fetch Error:', err);
  }
}

test();
