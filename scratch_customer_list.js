const fs = require('fs');

const path = './src/components/Customer/CustomerList.jsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import React, { useState, useEffect, useRef }')) {
  content = content.replace(
    "import React, { useState, useEffect } from 'react';", 
    "import React, { useState, useEffect, useRef } from 'react';"
  );
}

const isMountedPattern = /const isMounted = useRef\(true\);/;
if (!isMountedPattern.test(content)) {
  content = content.replace(
    "function CustomerList({ refreshTrigger, onRefresh }) {\n",
    "function CustomerList({ refreshTrigger, onRefresh }) {\n  const isMounted = useRef(true);\n  useEffect(() => {\n    return () => {\n      isMounted.current = false;\n    };\n  }, []);\n"
  );
}

// Modify fetchServiceHistory to check isMounted
const targetStr = `      setServiceHistory(servicesWithTags);
      setShipmentHistory(shipmentsData);
    } catch (err) {
      console.error('Error fetching history:', err);
      setError(err.message);
    }`;

const replaceStr = `      if (isMounted.current) {
        setServiceHistory(servicesWithTags);
        setShipmentHistory(shipmentsData);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
      if (isMounted.current) {
        setError(err.message);
      }
    }`;

content = content.replace(targetStr, replaceStr);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed CustomerList.jsx unmounted state warning');
