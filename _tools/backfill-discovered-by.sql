-- Gives the "Discovered by <callsign>" line to every snapshot made before it was recorded: they were all first paid for by iw@sdcarealty.com.
-- Run once in the Supabase SQL editor. Changes nothing for a render that already has a first payer, and stops if the account is not found.
-- Left out on purpose: the permanent landmarks (their pictures are free for everyone, no one paid for them), render rows that are not Wikidata places, and
-- homes (their pictures live in home_renders and never carry a callsign). Safe to run again.
do $$
declare
  me constant text := 'iw@sdcarealty.com';
  u uuid;
  n_places integer;
  n_addresses integer;
begin
  select id into u from auth.users where lower(email) = me;
  if u is null then raise exception 'account % not found: nothing changed', me; end if;

  update public.renders set discovered_by = u
   where discovered_by is null and status = 'ready' and place_id like 'wd:Q%'
     and place_id not in ('wd:Q243','wd:Q9202','wd:Q5317','wd:Q41225','wd:Q45178','wd:Q79961','wd:Q133274','wd:Q2636724','wd:Q12495','wd:Q134883','wd:Q1107297','wd:Q4176','wd:Q1542408','wd:Q9188','wd:Q1052042','wd:Q5853834','wd:Q2027162','wd:Q44440','wd:Q1563940','wd:Q180376','wd:Q390028','wd:Q6506496','wd:Q831389','wd:Q3177225','wd:Q223207','wd:Q83063','wd:Q39054','wd:Q179191','wd:Q756452','wd:Q9141','wd:Q183536','wd:Q178114','wd:Q29294','wd:Q83101','wd:Q189476','wd:Q102281065','wd:Q494895','wd:Q548679','wd:Q12506','wd:Q214855','wd:Q7604504','wd:Q470763','wd:Q947870','wd:Q5715648','wd:Q7766239','wd:Q20712236','wd:Q868874','wd:Q722125','wd:Q1519373','wd:Q685484','wd:Q80290','wd:Q804210','wd:Q27857526','wd:Q6062105','wd:Q25452628','wd:Q206435','wd:Q1640197','wd:Q310023','wd:Q2722966','wd:Q169420','wd:Q630212','wd:Q893204','wd:Q271466','wd:Q1122206','wd:Q48435','wd:Q172822','wd:Q798416','wd:Q2226897','wd:Q285467','wd:Q2746222','wd:Q429371','wd:Q4255374');
  get diagnostics n_places = row_count;

  update public.address_renders set created_by = u
   where created_by is null and status = 'ready';
  get diagnostics n_addresses = row_count;

  raise notice 'backfilled % places and % addresses', n_places, n_addresses;
end $$;
