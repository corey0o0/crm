import React, { useState } from 'react';
import { Box, Tabs, Tab, Typography, Paper, Container } from '@mui/material';
import SystemHealthCheck from '../../components/Test/SystemHealthCheck';
import TelegramTest from '../../components/Test/TelegramTest';

import BackupManager from '../../components/Backup/BackupManager';
import UserMenuSettings from '../../components/Settings/UserMenuSettings';
import TelegramSettings from '../../components/Settings/TelegramSettings';
import EcountDataUploader from '../../components/Settings/EcountDataUploader';

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
    const [value, setValue] = useState(1);

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
                        {/* <Tab label="시스템 상태 점검" {...a11yProps(0)} /> */}
                        <Tab label="텔레그램 테스트" {...a11yProps(1)} />
                        <Tab label="텔레그램 알림 관리" {...a11yProps(2)} />
                        <Tab label="데이터 백업/복원" {...a11yProps(3)} />
                        <Tab label="사용자 권한 관리" {...a11yProps(4)} />
                        {/* <Tab label="과거 이카운트 연동" {...a11yProps(5)} /> */}
                    </Tabs>
                </Box>
                {/* <TabPanel value={value} index={0}>
                    <SystemHealthCheck />
                </TabPanel> */}
                <TabPanel value={value} index={1}>
                    <TelegramTest />
                </TabPanel>
                <TabPanel value={value} index={2}>
                    <TelegramSettings />
                </TabPanel>
                <TabPanel value={value} index={3}>
                    <Box sx={{ mt: -3 }}>
                        <BackupManager />
                    </Box>
                </TabPanel>
                <TabPanel value={value} index={4}>
                    <UserMenuSettings />
                </TabPanel>
                {/* <TabPanel value={value} index={5}>
                    <EcountDataUploader />
                </TabPanel> */}
            </Paper>
        </Container>
    );
}
