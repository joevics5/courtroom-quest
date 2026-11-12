-- The demand is shown as a plain list of what is asked for, with no explanation attached.
update public.cases set requested_relief = requested_relief - 'basis' where requested_relief ? 'basis';
