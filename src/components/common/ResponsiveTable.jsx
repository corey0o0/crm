import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  useTheme,
  useMediaQuery,
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper
} from '@mui/material';

function ResponsiveTable({ columns, data, renderMobileCard, onRowClick, hoverEffect = false }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {data.map((row, index) => (
          <Card 
            key={index}
            onClick={() => onRowClick && onRowClick(row)}
            sx={{
              cursor: onRowClick ? 'pointer' : 'default',
              '&:hover': {
                backgroundColor: '#e3f2fd'
              }
            }}
          >
            {renderMobileCard(row, index)}
          </Card>
        ))}
      </Box>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell 
                key={column.id}
                sx={{
                  backgroundColor: '#fafafa',
                  fontWeight: 'bold'
                }}
              >
                {column.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row, index) => (
            <TableRow 
              key={index}
              onClick={() => onRowClick && onRowClick(row)}
              hover={hoverEffect}
              sx={{
                cursor: onRowClick ? 'pointer' : 'default',
                '&:hover': hoverEffect ? {
                  backgroundColor: '#e3f2fd !important'
                } : {}
              }}
            >
              {columns.map((column) => (
                <TableCell key={column.id}>
                  {column.render ? column.render(row) : row[column.id]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default ResponsiveTable;
