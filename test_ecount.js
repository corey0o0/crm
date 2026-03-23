require('dotenv').config({ path: __dirname + '/server/.env' });
const ecountService = require('./server/ecountService');

async function test() {
  const paths = [
    '/OAPI/V2/Item/GetListItem',
    '/OAPI/V2/Setup/GetListItem',
    '/OAPI/V2/Setup/GetListProduct',
    '/OAPI/V2/Inventory/GetListItem',
    '/OAPI/V2/Master/GetListItem',
    '/OAPI/V2/InventoryBalance/GetListInventoryBalance'
  ];
  for (let p of paths) {
    console.log('\n--- Testing', p, '---');
    try {
      const resp = await ecountService.executeEcountApi(p, {});
      console.log('✅ SUCCESS:', p);
      console.log(JSON.stringify(resp).substring(0, 300));
      process.exit(0); // Stop on first success
    } catch(e) {
      console.log('❌ FAILED:', e.message);
    }
  }
}
test();
