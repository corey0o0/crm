import React, { useState } from 'react';
import { Box, Tabs, Tab, Typography, Paper, Container, Alert } from '@mui/material';
import TelegramTest from '../../components/Test/TelegramTest';
import BackupManager from '../../components/Backup/BackupManager';
import UserMenuSettings from '../../components/Settings/UserMenuSettings';
import TelegramSettings from '../../components/Settings/TelegramSettings';
import { useAuth } from '../../contexts/AuthContext';
import { hasMenuAccess } from '../../config/menuConfig';

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
    const { user, userMenuPermissions } = useAuth();

    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    const email = user?.email;
    const canSeeTelegram = hasMenuAccess(email, 'admin_telegram', userMenuPermissions);
    const canSeeBackup = hasMenuAccess(email, 'admin_backup', userMenuPermissions);
    const canSeePermissions = hasMenuAccess(email, 'admin_permissions', userMenuPermissions);
    
    // Master accounts or those who specifically got permission
    // For telegram test, we will tie it to admin_telegram as well for simplicity, or just show it if any of them are true
    const tabs = [];
    
    if (canSeeTelegram) {
        tabs.push({ label: "텔레그램 테스트", component: <TelegramTest /> });
        tabs.push({ label: "텔레그램 알림 관리", component: <TelegramSettings /> });
    }
    if (canSeeBackup) {
        tabs.push({ label: "데이터 백업/복원", component: <Box sx={{ mt: -3 }}><BackupManager /></Box> });
    }
    if (canSeePermissions) {
        tabs.push({ label: "사용자 권한 관리", component: <UserMenuSettings /> });
    }

    // fallback if no specific permissions were granted but they still accessed admin tools
    if (tabs.length === 0) {
        return (
            <Container maxWidth="xl">
                <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 'bold' }}>
                    관리자 도구
                </Typography>
                <Alert severity="warning">세부 관리자 권한이 부여되지 않았습니다. 권한 관리자에게 문의하세요.</Alert>
            </Container>
        );
    }

    // Ensure value does not exceed tabs length
    const currentValue = value >= tabs.length ? 0 : value;

    return (
        <Container maxWidth="xl">
            <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 'bold' }}>
                관리자 도구
            </Typography>

            <Paper sx={{ width: '100%', mb: 4 }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs 
                        value={currentValue} 
                        onChange={handleChange} 
                        aria-label="admin tools tabs" 
                        variant="scrollable" 
                        scrollButtons="auto"
                    >
                        {tabs.map((tab, idx) => (
                            <Tab key={idx} label={tab.label} {...a11yProps(idx)} />
                        ))}
                    </Tabs>
                </Box>
                {tabs.map((tab, idx) => (
                    <TabPanel key={idx} value={currentValue} index={idx}>
                        {tab.component}
                    </TabPanel>
                ))}
            </Paper>
        </Container>
    );
}
