import React, { useState } from 'react';
import { Box, Tabs, Tab, Typography, Paper, Container } from '@mui/material';
import SystemHealthCheck from '../../components/Test/SystemHealthCheck';
import TelegramTest from '../../components/Test/TelegramTest';
import GoogleDriveTest from '../../components/Test/GoogleDriveTest';

import BackupManager from '../../components/Backup/BackupManager';

function TabPanel(props) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
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

function a11yProps(index) {
    return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
    };
}

export default function AdminTools() {
    const [value, setValue] = useState(0);

    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    return (
        <Container maxWidth="xl">
            <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 'bold' }}>
                관리자 도구
            </Typography>

            <Paper sx={{ width: '100%', mb: 4 }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs 
                        value={value} 
                        onChange={handleChange} 
                        aria-label="admin tools tabs" 
                        variant="scrollable" 
                        scrollButtons="auto"
                    >
                        <Tab label="시스템 상태 점검" {...a11yProps(0)} />
                        <Tab label="텔레그램 테스트" {...a11yProps(1)} />
                        <Tab label="구글 드라이브 테스트" {...a11yProps(2)} />
                        <Tab label="데이터 백업/복원" {...a11yProps(3)} />
                    </Tabs>
                </Box>
                <TabPanel value={value} index={0}>
                    <SystemHealthCheck />
                </TabPanel>
                <TabPanel value={value} index={1}>
                    <TelegramTest />
                </TabPanel>
                <TabPanel value={value} index={2}>
                    <GoogleDriveTest />
                </TabPanel>
                <TabPanel value={value} index={3}>
                    <Box sx={{ mt: -3 }}>
                        <BackupManager />
                    </Box>
                </TabPanel>
            </Paper>
        </Container>
    );
}
