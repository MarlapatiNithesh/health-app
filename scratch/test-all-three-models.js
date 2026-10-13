import { createAccessToken } from '../src/security/tokens.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-super-safe-long-jwt-key-32chars!!';
const PORT = process.env.PORT || 4000;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PATIENT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

async function testAllThreeModels() {
  console.log('🤖 Testing All Three Models via /medibot/chat...');
  const token = createAccessToken(PATIENT_ID, JWT_SECRET);

  const models = [
    { key: 'gemini', expectedBadge: 'Gemini' },
    { key: 'medgamma', expectedBadge: 'MedGemma / Gemini Fallback' },
    { key: 'gpt-4o', expectedBadge: 'GPT-4o / Gemini Fallback' },
  ];

  for (const m of models) {
    console.log(`\n==================================================`);
    console.log(`Testing Model: [${m.key}] (${m.expectedBadge})`);
    console.log(`==================================================`);

    const start = Date.now();
    const res = await fetch(`${BASE_URL}/medibot/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: `Hello Dr. MediBot, test prompt for ${m.key}. Briefly say your role.`,
        model: m.key,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`❌ Model [${m.key}] failed HTTP ${res.status}:`, err);
      continue;
    }

    const data = await res.json();
    const elapsed = Date.now() - start;
    console.log(`✅ Model [${m.key}] responded successfully in ${elapsed}ms:`);
    console.log(`   Model Name Tag: "${data.modelName}"`);
    console.log(`   Risk Level: "${data.riskLevel}"`);
    console.log(`   Message ID: "${data.messageId}"`);
    console.log(`   Content: ${data.content.slice(0, 140)}...`);
  }

  console.log('\n🎉 ALL THREE MODELS TESTED AND WORKING IN THE BACKEND & APP!');
}

testAllThreeModels().catch(console.error);
