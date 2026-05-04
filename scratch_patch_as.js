const fs = require('fs');
const path = require('path');

function replaceFileContent(filePath, targetContent, replacementContent) {
  const fullPath = path.resolve(filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Replace the target content
  content = content.replace(targetContent, replacementContent);
  
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Updated ${filePath}`);
}

// 1. AddService.jsx
const addServicePath = './src/components/Service/AddService.jsx';
const addServiceTarget = `      // 알림 및 텔레그램 비동기 처리
      Promise.resolve().then(async () => {
        try {
          const serviceInfo = {
            id: serviceId,
            customer_name: formData.customer_name,
            phone: formData.phone,
            product_name: formData.product_name,
            brand: formData.brand,
            symptoms: formData.symptoms
          };

          // 1. DB 알림 생성 (우선순위 낮음)
          await createNotification('as_new', serviceInfo);

          // 2. 텔레그램 알림 발송
          await sendTelegramNotification({
            message: \`[신규 A/S 접수] (AS-\${String(serviceId).slice(0, 8).toUpperCase()})\\n고객: \${formData.customer_name}\\n연락처: \${formData.phone}\\n제품: \${formData.product_name}\\n증상: \${formData.symptoms}\`,
            link: \`/service/\${serviceId}\`
          }, { eventType: 'as_add' });
        } catch (error) {
          console.error('알림 발송 중 오류:', error);
        }
      });

      if (submitActionRef.current === 'detail' && serviceId) {
        navigate(\`/service/\${serviceId}\`);
      } else {
        navigate('/service');
      }`;
const addServiceReplacement = `      try {
        const serviceInfo = {
          id: serviceId,
          customer_name: formData.customer_name,
          phone: formData.phone,
          product_name: formData.product_name,
          brand: formData.brand,
          symptoms: formData.symptoms
        };
        // 1. DB 알림 생성
        await createNotification('as_new', serviceInfo);
        // 2. 텔레그램 알림 발송
        await sendTelegramNotification({
          message: \`[신규 A/S 접수] (AS-\${String(serviceId).slice(0, 8).toUpperCase()})\\n고객: \${formData.customer_name}\\n연락처: \${formData.phone}\\n제품: \${formData.product_name}\\n증상: \${formData.symptoms}\`,
          link: \`/service/\${serviceId}\`
        }, { eventType: 'as_add' });
      } catch (error) {
        console.error('알림 발송 중 오류:', error);
      }

      setTimeout(() => {
        if (submitActionRef.current === 'detail' && serviceId) {
          navigate(\`/service/\${serviceId}\`);
        } else {
          navigate('/service');
        }
      }, 500);`;
replaceFileContent(addServicePath, addServiceTarget, addServiceReplacement);

// 2. ServiceDetail.jsx
const serviceDetailPath = './src/components/Service/ServiceDetail.jsx';
const serviceDetailTarget = `      // 알림 및 텔레그램 비동기 처리
      Promise.resolve().then(async () => {
        try {
          const serviceInfo = {
            id: serviceId,
            customer_name: formData.customer_name,
            phone: formData.phone,
            product_name: formData.product_name,
            brand: formData.brand,
            symptoms: formData.symptoms,
            status: formData.status
          };

          // 1. DB 알림 생성
          await createNotification('as_status_change', serviceInfo);

          // 2. 텔레그램 알림 발송
          await sendTelegramNotification({
            message: \`[A/S \${formData.status}] (AS-\${String(serviceId).slice(0, 8).toUpperCase()})\\n고객: \${formData.customer_name}\\n연락처: \${formData.phone}\\n제품: \${formData.product_name}\`,
            link: \`/service/\${serviceId}\`
          }, { eventType: 'as_edit' });
        } catch (error) {
          console.error('알림 발송 중 오류:', error);
        }
      });

      // 변경사항 초기화
      setInitialData({
        formData: { ...formData },
        selectedParts: [...selectedParts]
      });
      setHasUnsavedChanges(false);

      if (submitActionRef.current === 'list') {
        navigate('/service');
      } else {
        window.location.reload(); // 현재 페이지 새로고침
      }`;
const serviceDetailReplacement = `      try {
        const serviceInfo = {
          id: serviceId,
          customer_name: formData.customer_name,
          phone: formData.phone,
          product_name: formData.product_name,
          brand: formData.brand,
          symptoms: formData.symptoms,
          status: formData.status
        };
        // 1. DB 알림 생성
        await createNotification('as_status_change', serviceInfo);
        // 2. 텔레그램 알림 발송
        await sendTelegramNotification({
          message: \`[A/S \${formData.status}] (AS-\${String(serviceId).slice(0, 8).toUpperCase()})\\n고객: \${formData.customer_name}\\n연락처: \${formData.phone}\\n제품: \${formData.product_name}\`,
          link: \`/service/\${serviceId}\`
        }, { eventType: 'as_edit' });
      } catch (error) {
        console.error('알림 발송 중 오류:', error);
      }

      // 변경사항 초기화
      setInitialData({
        formData: { ...formData },
        selectedParts: [...selectedParts]
      });
      setHasUnsavedChanges(false);

      setTimeout(() => {
        if (submitActionRef.current === 'list') {
          navigate('/service');
        } else {
          window.location.reload(); // 현재 페이지 새로고침
        }
      }, 500);`;
replaceFileContent(serviceDetailPath, serviceDetailTarget, serviceDetailReplacement);

// 3. ManualSalesForm.jsx
const manualSalesPath = './src/pages/sales/ManualSalesForm.jsx';
const manualSalesTarget = `      // 텔레그램 알림 전송 (비동기 처리)
      if (shipmentId) {
        Promise.resolve().then(async () => {
          try {
            const eventType = isEditMode ? 'shipment_edit' : 'shipment_add';
            const title = isEditMode ? '출고 정보 수정' : '출고 등록';
            await sendTelegramNotification({
              message: \`\${title}(SHP-\${String(shipmentId).slice(0, 8).toUpperCase()}) - 고객: \${shipmentData.customer_name}, 연락처: \${shipmentData.customer_phone}, 제품: \${combinedProductName}\`,
              link: \`/shipment/\${shipmentId}\`
            }, { eventType });
          } catch (telegramError) {
            console.error('출고 텔레그램 알림 전송 중 오류:', telegramError);
          }
        });
      }

      // 변경사항 초기화
      setInitialData({
        shipmentData: { ...shipmentData },
        selectedParts: [...selectedParts]
      });
      setHasUnsavedChanges(false);

      if (submitActionRef.current === 'detail' && shipmentId) {
        navigate(\`/shipment/\${shipmentId}\`);
      } else {
        navigate('/shipment');
      }`;
const manualSalesReplacement = `      // 텔레그램 알림 전송
      if (shipmentId) {
        try {
          const eventType = isEditMode ? 'shipment_edit' : 'shipment_add';
          const title = isEditMode ? '출고 정보 수정' : '출고 등록';
          await sendTelegramNotification({
            message: \`\${title}(SHP-\${String(shipmentId).slice(0, 8).toUpperCase()}) - 고객: \${shipmentData.customer_name}, 연락처: \${shipmentData.customer_phone}, 제품: \${combinedProductName}\`,
            link: \`/shipment/\${shipmentId}\`
          }, { eventType });
        } catch (telegramError) {
          console.error('출고 텔레그램 알림 전송 중 오류:', telegramError);
        }
      }

      // 변경사항 초기화
      setInitialData({
        shipmentData: { ...shipmentData },
        selectedParts: [...selectedParts]
      });
      setHasUnsavedChanges(false);

      setTimeout(() => {
        if (submitActionRef.current === 'detail' && shipmentId) {
          navigate(\`/shipment/\${shipmentId}\`);
        } else {
          navigate('/shipment');
        }
      }, 500);`;
replaceFileContent(manualSalesPath, manualSalesTarget, manualSalesReplacement);

// 4. ShipmentForm.jsx
const shipmentPath = './src/pages/shipment/ShipmentForm.jsx';
const shipmentTarget = `      // 텔레그램 알림 전송 (비동기 처리)
      if (shipmentId) {
        Promise.resolve().then(async () => {
          try {
            const eventType = isEditMode ? 'shipment_edit' : 'shipment_add';
            const title = isEditMode ? '출고 정보 수정' : '출고 등록';
            await sendTelegramNotification({
              message: \`\${title}(SHP-\${String(shipmentId).slice(0, 8).toUpperCase()}) - 고객: \${shipmentData.customer_name}, 연락처: \${shipmentData.customer_phone}, 제품: \${combinedProductName}\`,
              link: \`/shipment/\${shipmentId}\`
            }, { eventType });
          } catch (telegramError) {
            console.error('출고 텔레그램 알림 전송 중 오류:', telegramError);
          }
        });
      }

      // 변경사항 초기화
      setInitialData({
        shipmentData: { ...shipmentData },
        selectedParts: [...selectedParts]
      });
      setHasUnsavedChanges(false);

      if (submitActionRef.current === 'detail' && shipmentId) {
        navigate(isManualB2B ? \`/sales/manual\` : \`/shipment/\${shipmentId}\`);
      } else {
        navigate(isManualB2B ? '/sales/manual' : '/shipment');
      }`;
const shipmentReplacement = `      // 텔레그램 알림 전송
      if (shipmentId) {
        try {
          const eventType = isEditMode ? 'shipment_edit' : 'shipment_add';
          const title = isEditMode ? '출고 정보 수정' : '출고 등록';
          await sendTelegramNotification({
            message: \`\${title}(SHP-\${String(shipmentId).slice(0, 8).toUpperCase()}) - 고객: \${shipmentData.customer_name}, 연락처: \${shipmentData.customer_phone}, 제품: \${combinedProductName}\`,
            link: \`/shipment/\${shipmentId}\`
          }, { eventType });
        } catch (telegramError) {
          console.error('출고 텔레그램 알림 전송 중 오류:', telegramError);
        }
      }

      // 변경사항 초기화
      setInitialData({
        shipmentData: { ...shipmentData },
        selectedParts: [...selectedParts]
      });
      setHasUnsavedChanges(false);

      setTimeout(() => {
        if (submitActionRef.current === 'detail' && shipmentId) {
          navigate(isManualB2B ? \`/sales/manual\` : \`/shipment/\${shipmentId}\`);
        } else {
          navigate(isManualB2B ? '/sales/manual' : '/shipment');
        }
      }, 500);`;
replaceFileContent(shipmentPath, shipmentTarget, shipmentReplacement);
