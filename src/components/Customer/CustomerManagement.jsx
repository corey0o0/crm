import React, { useState } from 'react';
import {
  Paper,
  Tabs,
  Tab,
  Box
} from '@mui/material';
import CustomerList from './CustomerList';
import AddCustomer from './AddCustomer';

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`customer-tabpanel-${index}`}
      aria-labelledby={`customer-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function CustomerManagement() {
  const [tabValue, setTabValue] = useState(0);

  const handleChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Paper>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleChange}
          aria-label="customer management tabs"
        >
          <Tab label="고객 목록" />
          <Tab label="고객 등록" />
        </Tabs>
      </Box>
      <TabPanel value={tabValue} index={0}>
        <CustomerList />
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <AddCustomer onSuccess={() => setTabValue(0)} />
      </TabPanel>
    </Paper>
  );
}

export default CustomerManagement; 