-- Add CANCELLED to the order_status enum so orders can be cancelled from cashier
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'CANCELLED';
