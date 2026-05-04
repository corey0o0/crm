const fs = require('fs');
const path = require('path');

function replaceFileContent(filePath, targetContent, replacementContent) {
  const fullPath = path.resolve(filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  content = content.replace(targetContent, replacementContent);
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Updated ${filePath}`);
}

// 1. AddService.jsx
const addServicePath = './src/components/Service/AddService.jsx';
const addServiceTarget = `        // 2. 텔레그램 알림 발송
        await sendTelegramNotification({`;
const addServiceReplacement = `        // 2. 텔레그램 알림 발송 (비동기 처리로 화면 멈춤 방지)
        sendTelegramNotification({`;
replaceFileContent(addServicePath, addServiceTarget, addServiceReplacement);

// 2. ServiceDetail.jsx
const serviceDetailPath = './src/components/Service/ServiceDetail.jsx';
const serviceDetailTarget = `        // 2. 텔레그램 알림 발송
        await sendTelegramNotification({`;
const serviceDetailReplacement = `        // 2. 텔레그램 알림 발송 (비동기 처리로 화면 멈춤 방지)
        sendTelegramNotification({`;
replaceFileContent(serviceDetailPath, serviceDetailTarget, serviceDetailReplacement);

// 3. ManualSalesForm.jsx
const manualSalesPath = './src/pages/sales/ManualSalesForm.jsx';
const manualSalesTarget = `      // 텔레그램 알림 전송
      if (shipmentId) {
        try {
          const eventType = isEditMode ? 'shipment_edit' : 'shipment_add';
          const title = isEditMode ? '출고 정보 수정' : '출고 등록';
          await sendTelegramNotification({`;
const manualSalesReplacement = `      // 텔레그램 알림 전송 (비동기 처리로 화면 멈춤 방지)
      if (shipmentId) {
        try {
          const eventType = isEditMode ? 'shipment_edit' : 'shipment_add';
          const title = isEditMode ? '출고 정보 수정' : '출고 등록';
          sendTelegramNotification({`;
replaceFileContent(manualSalesPath, manualSalesTarget, manualSalesReplacement);

// 4. ShipmentForm.jsx
const shipmentPath = './src/pages/shipment/ShipmentForm.jsx';
const shipmentTarget = `      // 텔레그램 알림 전송
      if (shipmentId) {
        try {
          const eventType = isEditMode ? 'shipment_edit' : 'shipment_add';
          const title = isEditMode ? '출고 정보 수정' : '출고 등록';
          await sendTelegramNotification({`;
const shipmentReplacement = `      // 텔레그램 알림 전송 (비동기 처리로 화면 멈춤 방지)
      if (shipmentId) {
        try {
          const eventType = isEditMode ? 'shipment_edit' : 'shipment_add';
          const title = isEditMode ? '출고 정보 수정' : '출고 등록';
          sendTelegramNotification({`;
replaceFileContent(shipmentPath, shipmentTarget, shipmentReplacement);
