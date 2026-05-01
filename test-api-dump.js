const axios = require('axios');
async function run() {
  await axios.post('http://localhost:3001/api/cafe24/sync/orders/slimpack79');
}
run();
