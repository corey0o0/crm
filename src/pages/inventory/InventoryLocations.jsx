import React from 'react';
import { useOutletContext } from 'react-router-dom';
import LocationManagement from '../../components/Inventory/LocationManagement';

export default function InventoryLocations() {
  const { handleLocationUpdate, warehouses, dealers, products, inventory } = useOutletContext();
  
  return (
    <LocationManagement 
      onLocationUpdate={handleLocationUpdate} 
      warehouses={warehouses}
      dealers={dealers}
      products={products}
      inventory={inventory}
    />
  );
}
