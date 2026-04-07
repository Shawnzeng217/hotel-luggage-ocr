-- =============================================
-- Hotel Luggage Storage - Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Luggage Records Table
CREATE TABLE luggage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  guest_name TEXT NOT NULL,
  room_number TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  signature_url TEXT,
  status TEXT NOT NULL DEFAULT 'stored' CHECK (status IN ('stored', 'collected')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  collected_at TIMESTAMPTZ
);

-- 2. Luggage Photos Table
CREATE TABLE luggage_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES luggage_records(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable Row Level Security
ALTER TABLE luggage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE luggage_photos ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies - Staff (authenticated users) can do everything
CREATE POLICY "Authenticated users can select records"
  ON luggage_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert records"
  ON luggage_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update records"
  ON luggage_records FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can select photos"
  ON luggage_photos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert photos"
  ON luggage_photos FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 5. Functions for guest access (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_record_by_token(p_token UUID)
RETURNS TABLE (
  id UUID,
  voucher_token UUID,
  guest_name TEXT,
  room_number TEXT,
  item_count INTEGER,
  notes TEXT,
  signature_url TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ
) AS $$
  SELECT r.id, r.voucher_token, r.guest_name, r.room_number, r.item_count,
         r.notes, r.signature_url, r.status, r.created_at, r.collected_at
  FROM luggage_records r
  WHERE r.voucher_token = p_token;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_photos_by_token(p_token UUID)
RETURNS TABLE (
  id UUID,
  photo_url TEXT,
  uploaded_at TIMESTAMPTZ
) AS $$
  SELECT lp.id, lp.photo_url, lp.uploaded_at
  FROM luggage_photos lp
  JOIN luggage_records lr ON lp.record_id = lr.id
  WHERE lr.voucher_token = p_token;
$$ LANGUAGE sql SECURITY DEFINER;

-- 6. Storage Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('luggage-photos', 'luggage-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', true);

-- 7. Storage Policies
CREATE POLICY "Authenticated users can upload luggage photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'luggage-photos');

CREATE POLICY "Anyone can view luggage photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'luggage-photos');

CREATE POLICY "Authenticated users can upload signatures"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'signatures');

CREATE POLICY "Anyone can view signatures"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'signatures');
