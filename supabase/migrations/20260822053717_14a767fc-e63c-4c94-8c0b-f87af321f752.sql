select cron.schedule(
  'starter-pack-nurture-6h',
  '40 */6 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://project--622409bb-9a09-4d0a-94c0-f5a8640d5c80.lovable.app/api/public/cron/starter-pack-nurture',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5bXJ1cWt4bWJ4b2Jya2tla29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTgyNTQsImV4cCI6MjA5Nzk5NDI1NH0.l5vnbmOtm2LVixboeiF-Obrf3bZYkktREwkNFNhnqh8'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $job$
);