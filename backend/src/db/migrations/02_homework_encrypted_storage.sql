-- Homework ciphertext only. Does not modify existing application tables.

CREATE TABLE IF NOT EXISTS public.webtop_homework (
 id integer PRIMARY KEY CHECK(id=1), document jsonb NOT NULL, revision bigint NOT NULL
);
ALTER TABLE public.webtop_homework ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.webtop_homework FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.webtop_homework_read() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('version',revision,'document',document) FROM public.webtop_homework WHERE id=1;
$$;
CREATE OR REPLACE FUNCTION public.webtop_homework_write(p_expected bigint,p_document jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.webtop_homework AS h(id,document,revision) VALUES(1,p_document,1)
 ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document,revision=h.revision+1 WHERE h.revision=p_expected;
 RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.webtop_homework_read() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.webtop_homework_write(bigint,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.webtop_homework_read() TO anon;
GRANT EXECUTE ON FUNCTION public.webtop_homework_write(bigint,jsonb) TO anon;
NOTIFY pgrst, 'reload schema';
