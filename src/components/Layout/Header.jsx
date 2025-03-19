import React from 'react';
import { AppBar } from '@mui/material';

const Header = () => {
  return (
    <AppBar 
      position="fixed" 
      elevation={0}
      sx={{ 
        backgroundColor: '#fff',
        color: '#000',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        borderBottom: '1px solid #e0e0e0',
        borderRadius: '0 !important',
        '& .MuiAppBar-root': {
          borderRadius: '0 !important'
        }
      }}
    >
      {/* Rest of the component code */}
    </AppBar>
  );
};

export default Header; 