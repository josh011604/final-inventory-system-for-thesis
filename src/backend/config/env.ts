const appName = import.meta.env.VITE_APP_NAME ?? 'React Invy Projects'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const appConfig = {
	appName,
	supabaseUrl,
	supabaseAnonKey,
	hasSupabase: Boolean(supabaseUrl && supabaseAnonKey),
} as const