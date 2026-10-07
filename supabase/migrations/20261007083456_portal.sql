-- Apply once in a dedicated project. No anon/authenticated table access.
create table public.portal_staff(user_id uuid primary key references auth.users(id) on delete cascade, role text not null check(role in ('coordinator','principal')));
create table public.portal_events(id uuid primary key default gen_random_uuid(), reference text unique not null default upper(substr(md5(random()::text),1,8)), title text not null, label text not null, level text not null default '', start_date date not null, end_date date not null, status text not null default 'draft' check(status in ('draft','open','closed')), questionnaire_version integer not null default 1 check(questionnaire_version=1), codes_issued boolean not null default false, check(end_date>=start_date));
create table public.portal_roster(id uuid primary key default gen_random_uuid(),event_id uuid not null references public.portal_events on delete cascade,name text not null);
create table public.portal_instructors(id uuid primary key default gen_random_uuid(),event_id uuid not null references public.portal_events on delete cascade,name text not null,topic text not null default '',unique(id,event_id));
create table public.portal_codes(event_id uuid not null references public.portal_events on delete cascade,hash text not null check(length(hash)=64),primary key(event_id,hash));
create table public.portal_redemptions(event_id uuid not null,hash text not null,instructor_id uuid not null,primary key(event_id,hash,instructor_id),foreign key(event_id,hash) references public.portal_codes on delete cascade,foreign key(instructor_id,event_id) references public.portal_instructors(id,event_id) on delete cascade);
-- Deliberately no credential, roster, redemption or timestamp column.
create table public.portal_responses(id uuid primary key default gen_random_uuid(),event_id uuid not null references public.portal_events on delete cascade,instructor_id uuid not null,ratings jsonb not null,good text not null default '' check(length(good)<=1000),improve text not null default '' check(length(improve)<=1000),hidden boolean not null default false,foreign key(instructor_id,event_id) references public.portal_instructors(id,event_id) on delete cascade,check(jsonb_typeof(ratings)='array' and jsonb_array_length(ratings)=8));
create table public.portal_audit(id uuid primary key default gen_random_uuid(),actor uuid not null,action text not null,event_id uuid references public.portal_events on delete cascade,response_id uuid references public.portal_responses on delete cascade,created_at timestamptz not null default now());
do $$ declare t text; begin foreach t in array array['portal_staff','portal_events','portal_roster','portal_instructors','portal_codes','portal_redemptions','portal_responses','portal_audit'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon, authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
create index portal_roster_event on public.portal_roster(event_id);
create index portal_instructors_event on public.portal_instructors(event_id);
create index portal_responses_event_instructor on public.portal_responses(event_id,instructor_id);

create function public.portal_enter(p_reference text,p_hash text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.portal_events; result jsonb;
begin select * into e from public.portal_events where reference=p_reference;
if e.id is null or e.status<>'open' or not exists(select 1 from public.portal_codes where event_id=e.id and hash=p_hash) then raise exception 'Evaluation unavailable';end if;
select jsonb_build_object('reference',e.reference,'title',e.title,'label',e.label,'instructors',coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'topic',i.topic,'completed',exists(select 1 from public.portal_redemptions d where d.event_id=e.id and d.hash=p_hash and d.instructor_id=i.id)) order by i.name),'[]'::jsonb)) into result from public.portal_instructors i where i.event_id=e.id;return result;end $$;

create function public.portal_submit(p_reference text,p_hash text,p_instructor uuid,p_ratings jsonb,p_good text,p_improve text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.portal_events; v jsonb;
begin
select * into e from public.portal_events where reference=p_reference for share;
if e.id is null or e.status<>'open' then raise exception 'Evaluation unavailable';end if;
perform 1 from public.portal_codes where event_id=e.id and hash=p_hash for update;
if not found or not exists(select 1 from public.portal_instructors where id=p_instructor and event_id=e.id) then raise exception 'Evaluation unavailable';end if;
if jsonb_typeof(p_ratings)<>'array' or jsonb_array_length(p_ratings)<>8 or p_good is null or p_improve is null or length(p_good)>1000 or length(p_improve)>1000 then raise exception 'Invalid response';end if;
for v in select value from jsonb_array_elements(p_ratings) loop if v<>'null'::jsonb and v not in ('1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb,'5'::jsonb) then raise exception 'Invalid rating';end if;end loop;
insert into public.portal_redemptions values(e.id,p_hash,p_instructor) on conflict do nothing;
if not found then return jsonb_build_object('ok',true,'alreadySubmitted',true);end if;
insert into public.portal_responses(event_id,instructor_id,ratings,good,improve) values(e.id,p_instructor,p_ratings,p_good,p_improve);
return jsonb_build_object('ok',true,'alreadySubmitted',false);end $$;

create function public.portal_admin(p_actor uuid,p_action text,p_data jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r text;e public.portal_events; x jsonb; result jsonb; n integer;
begin select role into r from public.portal_staff where user_id=p_actor;
if r is null then raise exception 'Staff access required';end if;
if p_action='dashboard' then select jsonb_build_object('role',r,'events',coalesce(jsonb_agg(jsonb_build_object('id',v.id,'reference',v.reference,'title',v.title,'label',v.label,'level',v.level,'start',v.start_date,'end',v.end_date,'status',v.status,'codesIssued',v.codes_issued,'eligible',(select count(*) from public.portal_roster where event_id=v.id),'instructors',(select count(*) from public.portal_instructors where event_id=v.id),'responses',(select count(*) from public.portal_responses where event_id=v.id)) order by v.start_date desc),'[]'::jsonb)) into result from public.portal_events v;return result;end if;
if p_action='create' then
if r<>'coordinator' then raise exception 'Coordinator required';end if;
n=jsonb_array_length(p_data->'participants');if n<1 or n>100 or jsonb_array_length(p_data->'instructors')<1 or jsonb_array_length(p_data->'instructors')>20 then raise exception 'Invalid batch';end if;
insert into public.portal_events(title,label,level,start_date,end_date) values(p_data->>'title',p_data->>'label',p_data->>'level',(p_data->>'start')::date,(p_data->>'end')::date) returning * into e;
for x in select value from jsonb_array_elements(p_data->'participants') loop insert into public.portal_roster(event_id,name) values(e.id,x#>>'{}');end loop;
for x in select value from jsonb_array_elements(p_data->'instructors') loop insert into public.portal_instructors(event_id,name,topic) values(e.id,x->>'name',x->>'topic');end loop;
insert into public.portal_audit(actor,action,event_id) values(p_actor,'create',e.id);return jsonb_build_object('ok',true,'id',e.id);
end if;
select * into e from public.portal_events where id=(p_data->>'id')::uuid for update;
if e.id is null then raise exception 'Batch not found';end if;
if p_action='report' then
if e.status<>'closed' then raise exception 'Close evaluation before reporting';end if;
select jsonb_build_object('title',e.title,'label',e.label,'reference',e.reference,'start',e.start_date,'end',e.end_date,'version',e.questionnaire_version,'eligible',(select count(*) from public.portal_roster where event_id=e.id),'instructors',coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'topic',i.topic,'count',(select count(*) from public.portal_responses where instructor_id=i.id),'rows',case when (select count(*) from public.portal_responses where instructor_id=i.id)>=5 then (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'ratings',a.ratings,'good',case when a.hidden then '' else a.good end,'improve',case when a.hidden then '' else a.improve end) order by a.id),'[]'::jsonb) from public.portal_responses a where a.instructor_id=i.id) else null end) order by i.name),'[]'::jsonb)) into result from public.portal_instructors i where i.event_id=e.id;return result;
end if;
if r<>'coordinator' then raise exception 'Coordinator required';end if;
if p_action='roster' then return jsonb_build_object('names',(select jsonb_agg(name order by name) from public.portal_roster where event_id=e.id));end if;
if p_action='codes' then
n=jsonb_array_length(p_data->'hashes');if e.status<>'draft' or e.codes_issued or n<>(select count(*) from public.portal_roster where event_id=e.id) then raise exception 'Slips already issued or count mismatch';end if;
for x in select value from jsonb_array_elements(p_data->'hashes') loop insert into public.portal_codes values(e.id,x#>>'{}');end loop;
update public.portal_events set codes_issued=true where id=e.id;
insert into public.portal_audit(actor,action,event_id) values(p_actor,'issue_codes',e.id);return jsonb_build_object('ok',true,'reference',e.reference);
elsif p_action='transition' then
if not ((e.status='draft' and p_data->>'status'='open' and e.codes_issued) or (e.status='open' and p_data->>'status'='closed')) then raise exception 'Invalid transition';end if;
update public.portal_events set status=p_data->>'status' where id=e.id;
insert into public.portal_audit(actor,action,event_id) values(p_actor,p_data->>'status',e.id);
elsif p_action='hide' then
if e.status<>'closed' then raise exception 'Close evaluation first';end if;
update public.portal_responses a set hidden=true where a.id=(p_data->>'response')::uuid and a.event_id=e.id and (select count(*) from public.portal_responses where instructor_id=a.instructor_id)>=5;
if not found then raise exception 'Comment unavailable';end if;
insert into public.portal_audit(actor,action,event_id,response_id) values(p_actor,'hide_comment',e.id,(p_data->>'response')::uuid);
else raise exception 'Unknown operation';end if;
return jsonb_build_object('ok',true);end $$;
revoke all on function public.portal_enter(text,text),public.portal_submit(text,text,uuid,jsonb,text,text),public.portal_admin(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.portal_enter(text,text),public.portal_submit(text,text,uuid,jsonb,text,text),public.portal_admin(uuid,text,jsonb) to service_role;
