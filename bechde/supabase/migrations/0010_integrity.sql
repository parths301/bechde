-- P2-5: Database Data Integrity (Offers & Cascades)

-- 1. Relax Chats FK to Listing so chats survive listing deletion
-- We also do this for offers and reviews to keep the whole chat history intact.
ALTER TABLE public.chats ALTER COLUMN listing_id DROP NOT NULL;
ALTER TABLE public.chats DROP CONSTRAINT IF EXISTS chats_listing_id_fkey;
ALTER TABLE public.chats ADD CONSTRAINT chats_listing_id_fkey 
  FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;

ALTER TABLE public.offers ALTER COLUMN listing_id DROP NOT NULL;
ALTER TABLE public.offers DROP CONSTRAINT IF EXISTS offers_listing_id_fkey;
ALTER TABLE public.offers ADD CONSTRAINT offers_listing_id_fkey 
  FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;

ALTER TABLE public.reviews ALTER COLUMN listing_id DROP NOT NULL;
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_listing_id_fkey;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_listing_id_fkey 
  FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;

-- 2. Enforce max 1 pending offer per chat at any given time
CREATE UNIQUE INDEX IF NOT EXISTS offers_one_pending_per_chat 
  ON public.offers(chat_id) WHERE status = 'pending';

-- 3. Prevent users from leaving empty (whitespace-only) review bodies, if provided
ALTER TABLE public.reviews 
  ADD CONSTRAINT reviews_body_not_empty CHECK (body IS NULL OR trim(body) <> '');
