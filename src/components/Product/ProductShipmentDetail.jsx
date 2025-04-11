import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

function ProductShipmentDetail() {
  const { id } = useParams();
  const [shipment, setShipment] = useState(null);

  useEffect(() => {
    fetchShipmentDetail();
  }, [id]);

  const fetchShipmentDetail = async () => {
    const { data, error } = await supabase.from('shipments').select('*').eq('id', id).single();
    if (error) {
      console.error('Error fetching shipment detail:', error);
    } else {
      setShipment(data);
    }
  };

  if (!shipment) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        출고 상세 정보
      </Typography>
      <Typography variant="h6">이름: {shipment.customer_name}</Typography>
      <Typography variant="h6">연락처: {shipment.customer_phone}</Typography>
      <Typography variant="h6">판매처: {shipment.sales_channel}</Typography>
      <Typography variant="h6">상태: {shipment.status}</Typography>
      <Chip label={shipment.sales_channel} size="small" />
    </Box>
  );
}

export default ProductShipmentDetail;
