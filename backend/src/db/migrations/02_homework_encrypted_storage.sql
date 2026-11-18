-- Homework ciphertext only. Does not modify existing application tables.

CREATE TABLE IF NOT EXISTS public.webtop_homework (
 id integer PRIMARY KEY CHECK(id=1), document jsonb NOT NULL, revision bigint NOT NULL
);
ALTER TABLE public.webtop_homework ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.webtop_homework FROM anon, authenticated;
DROP FUNCTION IF EXISTS public.webtop_homework_read();
DROP FUNCTION IF EXISTS public.webtop_homework_write(bigint,jsonb);
CREATE OR REPLACE FUNCTION public.webtop_homework_read(p_proof text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF encode(sha256(convert_to(p_proof,'UTF8')),'hex') <> 'bcd9fdb5c3431ee5d3b365252098a61c54e1d60fa377c5801359c53e49e65844' OR p_proof IS NULL THEN
  RAISE EXCEPTION 'Access denied' USING ERRCODE='42501';
 END IF;
 RETURN (SELECT jsonb_build_object('version',revision,'document',document) FROM public.webtop_homework WHERE id=1);
END;
$$;
CREATE OR REPLACE FUNCTION public.webtop_homework_write(p_expected bigint,p_document jsonb,p_proof text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF encode(sha256(convert_to(p_proof,'UTF8')),'hex') <> 'bcd9fdb5c3431ee5d3b365252098a61c54e1d60fa377c5801359c53e49e65844' OR p_proof IS NULL THEN
  RAISE EXCEPTION 'Access denied' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.webtop_homework AS h(id,document,revision) VALUES(1,p_document,1)
 ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document,revision=h.revision+1 WHERE h.revision=p_expected;
 RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.webtop_homework_read(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.webtop_homework_write(bigint,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.webtop_homework_read(text) TO anon;
GRANT EXECUTE ON FUNCTION public.webtop_homework_write(bigint,jsonb,text) TO anon;
NOTIFY pgrst, 'reload schema';
