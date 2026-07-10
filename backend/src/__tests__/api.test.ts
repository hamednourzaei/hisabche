// backend/src/__tests__/api.test.ts
import { describe, it, expect } from 'vitest';

const BASE_URL = 'https://hisabche.onrender.com';

describe('API Health', () => {
  it('GET /docs returns Swagger UI', async () => {
    const res = await fetch(`${BASE_URL}/docs`);
    expect(res.status).toBe(200);
  });
});

describe('Auth Endpoints', () => {
  it('POST /auth/login — invalid credentials returns 401', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'fake@test.com', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('Protected Endpoints', () => {
  it('GET /products returns 401 without auth', async () => {
    const res = await fetch(`${BASE_URL}/products`);
    expect(res.status).toBe(401);
  });

  it('GET /invoices returns 401 without auth', async () => {
    const res = await fetch(`${BASE_URL}/invoices`);
    expect(res.status).toBe(401);
  });

  it('GET /customers returns 401 without auth', async () => {
    const res = await fetch(`${BASE_URL}/customers`);
    expect(res.status).toBe(401);
  });
});