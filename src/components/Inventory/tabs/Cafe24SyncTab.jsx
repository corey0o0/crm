import React from 'react';
import { useOutletContext } from 'react-router-dom';
import Cafe24InventoryReconciliation from '../Cafe24InventoryReconciliation';

function Cafe24SyncTab() {
  const { products, visibleWarehouses, inventory } = useOutletContext();

  return (
    <Cafe24InventoryReconciliation
      products={products || []}
      warehouses={visibleWarehouses || []}
      recalculatedInventory={inventory || {}}
    />
  );
}

export default Cafe24SyncTab;
