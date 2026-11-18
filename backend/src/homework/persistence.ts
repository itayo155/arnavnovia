import {supabase} from '../config/db';
import {Envelope, Persistence} from './core';

class StorageError extends Error {
  readonly name='HomeworkStorageError';
  databaseCode:string;
  constructor(readonly step:string,code?:string) {
    super('Homework persistence is unavailable');
    this.databaseCode=code&&/^[A-Z0-9_]{3,12}$/.test(code)?code:'UNAVAILABLE';
  }
}

// Only authenticated, encrypted envelopes are persisted. No homework plaintext,
// Ministry credentials, browser state, or website password is stored in Postgres.
const schema=`
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
`;

export class SupabasePersistence implements Persistence {
  private ready?:Promise<void>;
  private async initialize() {
    if (!this.ready) this.ready=(async()=>{
      const check=await supabase.rpc('webtop_homework_read');
      if (!check.error) return;
      const result=await supabase.rpc('exec_sql',{query:schema});
      if (result.error) throw new StorageError('initialize',result.error.code);
      // PostgREST reloads its RPC schema asynchronously.
      for (let i=0;i<12;i++) {
        await new Promise(resolve=>setTimeout(resolve,500));
        if (!(await supabase.rpc('webtop_homework_read')).error) return;
      }
      throw new StorageError('schema_refresh');
    })().catch(error=>{this.ready=undefined;throw error;});
    return this.ready;
  }
  async read():Promise<{version:number;document:Envelope}|null> {
    await this.initialize();
    const {data,error}=await supabase.rpc('webtop_homework_read');
    if (error) throw new StorageError('read',error.code);
    return data;
  }
  async write(expected:number,document:Envelope):Promise<boolean> {
    await this.initialize();
    const {data,error}=await supabase.rpc('webtop_homework_write',{p_expected:expected,p_document:document});
    if (error) throw new StorageError('save',error.code);
    return data===true;
  }
}
