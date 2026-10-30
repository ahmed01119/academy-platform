const http = require('http');

async function measureRequest(path, method = 'GET', body = null, headers = {}) {
  const start = Date.now();
  return new Promise((resolve) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3001,
        path: `/v1${path}`,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
          ...headers,
        },
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => {
          resData += chunk;
        });
        res.on('end', () => {
          const latency = Date.now() - start;
          resolve({
            statusCode: res.statusCode,
            latency,
            data: resData,
            headers: res.headers,
          });
        });
      },
    );
    req.on('error', (err) => {
      resolve({ statusCode: 0, latency: Date.now() - start, error: err.message });
    });
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function computeStats(samples) {
  samples.sort((a, b) => a - b);
  const p50 = samples[Math.floor(samples.length * 0.5)];
  const p95 = samples[Math.floor(samples.length * 0.95)];
  const p99 = samples[Math.floor(samples.length * 0.99)];
  const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  return { p50, p95, p99, avg, min: samples[0], max: samples[samples.length - 1] };
}

async function run() {
  console.log('--- Benchmarking Sportexus Phase 1 Performance ---');

  // 1. Health endpoint latency (50 samples)
  const healthSamples = [];
  for (let i = 0; i < 50; i++) {
    const res = await measureRequest('/health');
    healthSamples.push(res.latency);
  }
  const healthStats = computeStats(healthSamples);
  console.log('Health Endpoint (50 requests):', healthStats);

  // 2. Login latency (Argon2 password verify)
  const loginRes = await measureRequest('/auth/login', 'POST', {
    email: 'superadmin@platform.sa',
    password: 'xjwhxRcPgBlytvbyeFUj#9',
  });
  console.log('Admin Login status:', loginRes.statusCode, 'latency:', loginRes.latency, 'ms');

  // 3. Authenticated requests latency with cookie/tenant
  if (loginRes.statusCode === 200) {
    const cookies = loginRes.headers['set-cookie'];
    const cookieHeader = cookies ? cookies.map((c) => c.split(';')[0]).join('; ') : '';
    const parsed = JSON.parse(loginRes.data);
    const tenantId = parsed.activeTenant?.tenantId;

    const meSamples = [];
    for (let i = 0; i < 30; i++) {
      const res = await measureRequest('/auth/me', 'GET', null, {
        Cookie: cookieHeader,
        ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      });
      meSamples.push(res.latency);
    }
    const meStats = computeStats(meSamples);
    console.log('Auth /me Endpoint (30 requests):', meStats);

    const branchSamples = [];
    for (let i = 0; i < 20; i++) {
      const res = await measureRequest('/branches', 'GET', null, {
        Cookie: cookieHeader,
        ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      });
      branchSamples.push(res.latency);
    }
    const branchStats = computeStats(branchSamples);
    console.log('Branches list Endpoint (20 requests):', branchStats);
  }

  // 4. Test Web frontend responsiveness (port 3000)
  const webStart = Date.now();
  const webRes = await new Promise((resolve) => {
    http
      .get('http://127.0.0.1:3000/login', (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () =>
          resolve({ statusCode: res.statusCode, latency: Date.now() - webStart }),
        );
      })
      .on('error', (err) => resolve({ statusCode: 0, error: err.message }));
  });
  console.log('Next.js /login response:', webRes.statusCode, 'latency:', webRes.latency, 'ms');

  console.log('Performance test completed.');
}

run().catch(console.error);
