CREATE TYPE payment_method AS ENUM ('CARD', 'CASH', 'QR');

CREATE TABLE IF NOT EXISTS waiter_calls (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    mesa_id UUID REFERENCES mesas(id) NOT NULL,
    payment_method payment_method NOT NULL,
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
); 