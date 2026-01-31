/**
 * Manual test script for since parameter
 * Run: node test-since-parameter.js
 */

const API_URL = process.env.API_URL || 'http://localhost:3000/v1';
const API_KEY = process.env.API_KEY || 'dev-key-change-this-in-production';

async function testSinceParameter() {
  console.log('🧪 Testing since parameter functionality\n');

  try {
    // Test 1: Get all items
    console.log('Test 1: GET /v1/inbox (no since parameter)');
    const response1 = await fetch(`${API_URL}/inbox`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    });

    const data1 = await response1.json();
    console.log(`✅ Status: ${response1.status}`);
    console.log(`📊 Total items: ${data1.entries?.length || 0}\n`);

    if (data1.entries && data1.entries.length > 0) {
      const latestItem = data1.entries[0];
      const latestTimestamp = latestItem.updatedAt || latestItem.createdAt;
      console.log(`📅 Latest item timestamp: ${latestTimestamp}`);
      console.log(`📝 Latest item id: ${latestItem.id}\n`);

      // Test 2: Get items since a future date (should return empty)
      console.log('Test 2: GET /v1/inbox?since=2099-01-01T00:00:00Z (future date)');
      const response2 = await fetch(`${API_URL}/inbox?since=2099-01-01T00:00:00Z`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      });

      const data2 = await response2.json();
      console.log(`✅ Status: ${response2.status}`);
      console.log(`📊 Items since future date: ${data2.entries?.length || 0}`);
      console.log(`✅ Expected: 0 items${data2.entries?.length === 0 ? ' ✓' : ' ✗'}\n`);

      // Test 3: Get items since epoch (should return all items)
      console.log('Test 3: GET /v1/inbox?since=1970-01-01T00:00:00Z (epoch)');
      const response3 = await fetch(`${API_URL}/inbox?since=1970-01-01T00:00:00Z`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      });

      const data3 = await response3.json();
      console.log(`✅ Status: ${response3.status}`);
      console.log(`📊 Items since epoch: ${data3.entries?.length || 0}`);
      console.log(`✅ Should equal Test 1: ${data3.entries?.length === data1.entries?.length ? '✓' : '✗'}\n`);

      // Test 4: Get items since latest item updated_at (should return 0 or 1)
      const updatedAt = new Date(latestTimestamp);
      updatedAt.setSeconds(updatedAt.getSeconds() + 1);

      console.log(`Test 4: GET /v1/inbox?since=${updatedAt.toISOString()}`);
      const response4 = await fetch(`${API_URL}/inbox?since=${updatedAt.toISOString()}`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      });

      const data4 = await response4.json();
      console.log(`✅ Status: ${response4.status}`);
      console.log(`📊 Items since ${updatedAt.toISOString()}: ${data4.entries?.length || 0}`);
      console.log(`✅ Expected: 0 items${data4.entries?.length === 0 ? ' ✓' : ' ✗'}\n`);
    } else {
      console.log('⚠️  No items found in database. Please create some items first.\n');
    }

    console.log('✅ All tests completed!\n');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
testSinceParameter();
