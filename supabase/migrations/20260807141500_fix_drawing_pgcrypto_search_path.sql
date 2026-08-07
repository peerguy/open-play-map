alter function public.random_drawing_entry(integer)
set search_path = public, extensions;

alter function public.run_monthly_drawing(date)
set search_path = public, extensions;

alter function public.run_monthly_redraw(uuid)
set search_path = public, extensions;
