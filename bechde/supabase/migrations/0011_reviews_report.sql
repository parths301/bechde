-- Phase 2 Part 2: Reviews Management (Reporting Reviews)

-- 1. Add review_id to reports
ALTER TABLE public.reports 
  ADD COLUMN review_id uuid REFERENCES public.reviews(id) ON DELETE CASCADE;

-- 2. Update the target check constraint
ALTER TABLE public.reports DROP CONSTRAINT reports_target_check;
ALTER TABLE public.reports 
  ADD CONSTRAINT reports_target_check 
  CHECK (listing_id IS NOT NULL OR profile_id IS NOT NULL OR review_id IS NOT NULL);

-- 3. Add an index for review_id
CREATE INDEX IF NOT EXISTS reports_review_idx ON public.reports (review_id);

-- 4. Allow authors to update their own reviews
DROP POLICY IF EXISTS reviews_update ON public.reviews;
CREATE POLICY reviews_update ON public.reviews FOR UPDATE
  USING (reviewer_id = public.current_profile_id())
  WITH CHECK (reviewer_id = public.current_profile_id());
