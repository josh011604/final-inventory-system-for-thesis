import { createClient } from '@supabase/supabase-js'
import { appConfig } from '@/backend/config/env'
import type { Database } from '@/backend/types/supabase'

if (!appConfig.hasSupabase) {
	throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.')
}

export const supabase = createClient<Database>(appConfig.supabaseUrl, appConfig.supabaseAnonKey)