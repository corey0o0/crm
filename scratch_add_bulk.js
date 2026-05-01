const fs = require('fs');

let content = fs.readFileSync('src/pages/sales/ManualSalesList.jsx', 'utf8');

const analyzeLogic = `
  const handleBulkAnalyze = async () => {
    if (!window.confirm(\`\${selectedItems.length}개 항목의 부품 구성을 최신 상품 정보 기준으로 재분석하여 덮어씁니다. 진행하시겠습니까?\`)) {
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeProgress({ current: 0, total: selectedItems.length });

    try {
      let currentIdx = 0;
      for (const id of selectedItems) {
        // 1. 출고 정보 조회
        const { data: shipment, error: fetchErr } = await supabase
          .from('shipments')
          .select('*')
          .eq('id', id)
          .single();
          
        if (fetchErr || !shipment || !shipment.product_name) {
          currentIdx++;
          setAnalyzeProgress({ current: currentIdx, total: selectedItems.length });
          continue;
        }

        const productNames = shipment.product_name.split(',').map(name => name.trim()).filter(name => name);
        if (productNames.length === 0) {
          currentIdx++;
          setAnalyzeProgress({ current: currentIdx, total: selectedItems.length });
          continue;
        }

        const newParts = [];
        let partsUpdated = 0;

        for (let i = 0; i < productNames.length; i++) {
          const productName = productNames[i];
          let category = '기체';
          let price = 0;
          let partCode = '';
          let partId = null;

          // 1. 정확한 이름으로 검색
          let partFromDB = null;
          const { data: exactMatchParts } = await supabase
            .from('parts')
            .select('*')
            .eq('brand', shipment.brand)
            .eq('name', productName)
            .limit(1);

          if (exactMatchParts && exactMatchParts.length > 0) {
            partFromDB = exactMatchParts[0];
          } else {
            // 2. 부분 일치 검색
            const { data: partialMatchParts } = await supabase
              .from('parts')
              .select('*')
              .eq('brand', shipment.brand)
              .ilike('name', \`%\${productName}%\`)
              .limit(1);

            if (partialMatchParts && partialMatchParts.length > 0) {
              partFromDB = partialMatchParts[0];
            }
          }

          if (partFromDB) {
            if (partFromDB.note) {
              const note = partFromDB.note.toLowerCase();
              if (note.includes('파츠') || note.includes('part') || note.includes('부품')) {
                category = '파츠';
              } else if (note.includes('공임') || note.includes('작업') || note.includes('서비스')) {
                category = '공임';
              } else if (note.includes('기타') || note.includes('etc')) {
                category = '기타';
              } else if (note.includes('기체') || note.includes('바이크') || note.includes('자전거')) {
                category = '기체';
              }
            }

            if (partFromDB.code) {
              const code = partFromDB.code.toUpperCase();
              if (code.startsWith('XRBP-') || code.startsWith('NBP-') || code.includes('PART')) {
                category = '파츠';
              } else if (code.startsWith('XRBS-') || code.startsWith('NBS-') || code.includes('SERVICE')) {
                category = '공임';
              } else if (code.startsWith('XRBM-') || code.startsWith('NBM-') || code.includes('BIKE')) {
                category = '기체';
              }
            }

            price = partFromDB.price || 0;
            partCode = partFromDB.code || '';
            partId = partFromDB.id || null;
            partsUpdated++;
          } else {
            price = shipment.price ? Math.round(shipment.price / productNames.length) : 0;
            partCode = '';
          }

          newParts.push({
            shipment_id: shipment.id,
            part_name: productName,
            part_code: partCode,
            part_category: category,
            quantity: 1, // 기본값
            price: price,
            total_price: price,
            warehouse_id: shipment.warehouse_id,
            created_at: new Date().toISOString(),
            _part_id: partId // 임시용
          });
        }

        // 기존 부품 정보 삭제
        await supabase.from('shipment_parts').delete().eq('shipment_id', shipment.id);
        
        // 새 부품 정보 삽입
        const partsToInsert = newParts.map(p => {
           const { _part_id, ...rest } = p;
           return rest;
        });
        await supabase.from('shipment_parts').insert(partsToInsert);

        // 총계 업데이트
        const totalQuantity = newParts.reduce((sum, p) => sum + p.quantity, 0);
        const totalPrice = newParts.reduce((sum, p) => sum + p.total_price, 0);

        await supabase.from('shipments').update({
          quantity: totalQuantity,
          price: totalPrice,
          product_code: newParts[0]?.part_code || '',
          updated_at: new Date().toISOString()
        }).eq('id', shipment.id);

        // 출고 완료인 경우 수불부 재동기화
        if (shipment.status === '출고완료') {
          await supabase.from('transactions').delete().eq('group_id', shipment.id);
          
          const transactionsToInsert = newParts.map(part => {
            return {
              group_id: shipment.id,
              type: 'out',
              product_id: part._part_id || null, // 부품 고유 ID
              product_name: part.part_name,
              product_code: part.part_code || '',
              quantity: part.quantity || 1,
              from_location: shipment.warehouse_id || 'DEFAULT',
              date: shipment.shipment_date || new Date().toISOString().split('T')[0],
              note: \`[일반 출고] \${shipment.customer_name}\`,
              status: '완료'
            };
          }).filter(t => t.product_id); // product_id가 없으면 수불부 차감 불가 (매핑 안된 항목)

          if (transactionsToInsert.length > 0) {
            await supabase.from('transactions').insert(transactionsToInsert);
          }
        }

        currentIdx++;
        setAnalyzeProgress({ current: currentIdx, total: selectedItems.length });
      }

      setSnackbar({ open: true, message: \`\${selectedItems.length}개 항목의 파츠 재분석 및 동기화가 완료되었습니다.\`, severity: 'success' });
      fetchManualSales();
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: '분석 중 오류 발생: ' + err.message, severity: 'error' });
    } finally {
      setIsAnalyzing(false);
      setSelectedItems([]);
    }
  };
`;

if (!content.includes('const handleBulkAnalyze = async () =>')) {
  content = content.replace(
    /const handleBulkDelete = async \(\) => \{/,
    analyzeLogic + '\n\n  const handleBulkDelete = async () => {'
  );
  fs.writeFileSync('src/pages/sales/ManualSalesList.jsx', content);
}

