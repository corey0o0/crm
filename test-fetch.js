const fetch = require('node-fetch'); // wait, fetch is built-in in recent node
async function test() {
  try {
    const res = await fetch('http://localhost:5001/api/cafe24/mappings');
    console.log(res.status, await res.text());
  } catch(e) {
    console.error(e);
  }
}
test();
