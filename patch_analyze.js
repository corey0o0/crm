const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/shipment/ShipmentForm.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// The first block
const oldBlock1 = `
          // 1. 정확한 이름으로 검색
          const { data: exactMatchParts } = await supabase
            .from('parts')
            .select('*')
            .eq('brand', shipment.brand)
            .eq('name', part.part_name)
            .limit(1);

          if (exactMatchParts && exactMatchParts.length > 0) {
            foundPart = exactMatchParts[0];
          } else {
            // 2. 부분 일치 검색
            const { data: partialMatchParts } = await supabase
              .from('parts')
              .select('*')
              .eq('brand', shipment.brand)
              .ilike('name', \`% \${part.part_name}% \`)
              .limit(1);

            if (partialMatchParts && partialMatchParts.length > 0) {
              foundPart = partialMatchParts[0];
            }
          }`;

const newBlock1 = `
          // 1. 올인원 검색 (바코드, 코드, 제품명)
          const searchName = part.part_name ? part.part_name.replace(/[\\s\\-]/g, '').toLowerCase() : '';
          foundPart = allParts.find(p => 
            (part.part_code && p.code === part.part_code) ||
            (part.part_code && p.barcode === part.part_code) ||
            (p.code === part.part_name) ||
            (p.barcode === part.part_name) ||
            (p.name === part.part_name) ||
            (searchName && p.name && searchName.includes(p.name.replace(/[\\s\\-]/g, '').toLowerCase()))
          );`;

// The second block
const oldBlock2 = `
          // 1. 정확한 이름으로 검색 (정확히 일치하는 제품 먼저 찾기)
          const { data: exactMatchParts } = await supabase
            .from('parts')
            .select('*')
            .eq('brand', shipment.brand)
            .eq('name', productName)
            .limit(1);

          if (exactMatchParts && exactMatchParts.length > 0) {
            partFromDB = exactMatchParts[0];
          } else {
            // 2. 정확히 일치하는 제품이 없으면 부분 일치 검색
            const { data: partialMatchParts } = await supabase
              .from('parts')
              .select('*')
              .eq('brand', shipment.brand)
              .ilike('name', \`% \${productName}% \`)
              .limit(1);

            if (partialMatchParts && partialMatchParts.length > 0) {
              partFromDB = partialMatchParts[0];
            }
          }`;

const newBlock2 = `
          // 1. 올인원 검색 (바코드, 코드, 제품명)
          const searchName = productName ? productName.replace(/[\\s\\-]/g, '').toLowerCase() : '';
          partFromDB = allParts.find(p => 
            (partCode && p.code === partCode) ||
            (partCode && p.barcode === partCode) ||
            (p.code === productName) ||
            (p.barcode === productName) ||
            (p.name === productName) ||
            (searchName && p.name && searchName.includes(p.name.replace(/[\\s\\-]/g, '').toLowerCase()))
          );`;

// The third block
const oldBlock3 = `
        // 1. 정확한 이름으로 검색 (정확히 일치하는 제품 먼저 찾기)
        const { data: exactMatchParts } = await supabase
          .from('parts')
          .select('*')
          .eq('brand', shipment.brand)
          .eq('name', shipment.product_name)
          .limit(1);

        if (exactMatchParts && exactMatchParts.length > 0) {
          partFromDB = exactMatchParts[0];
        } else {
          // 2. 정확히 일치하는 제품이 없으면 부분 일치 검색
          const { data: partialMatchParts } = await supabase
            .from('parts')
            .select('*')
            .eq('brand', shipment.brand)
            .ilike('name', \`% \${shipment.product_name}% \`)
            .limit(1);

          if (partialMatchParts && partialMatchParts.length > 0) {
            partFromDB = partialMatchParts[0];
          }
        }`;

const newBlock3 = `
        // 1. 올인원 검색 (바코드, 코드, 제품명)
        const searchName = shipment.product_name ? shipment.product_name.replace(/[\\s\\-]/g, '').toLowerCase() : '';
        partFromDB = allParts.find(p => 
          (partCode && p.code === partCode) ||
          (partCode && p.barcode === partCode) ||
          (p.code === shipment.product_name) ||
          (p.barcode === shipment.product_name) ||
          (p.name === shipment.product_name) ||
          (searchName && p.name && searchName.includes(p.name.replace(/[\\s\\-]/g, '').toLowerCase()))
        );`;


let replaced1 = content.replace(oldBlock1, newBlock1);
let replaced2 = replaced1.replace(oldBlock2, newBlock2);
let replaced3 = replaced2.replace(oldBlock3, newBlock3);

fs.writeFileSync(filePath, replaced3);

console.log("Block 1 found:", content.includes(oldBlock1));
console.log("Block 2 found:", content.includes(oldBlock2));
console.log("Block 3 found:", content.includes(oldBlock3));

