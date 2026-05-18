import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://quxpxatopmquheoazzlj.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_mGppZjb0DVEKLFf7f1XjmQ_iHBQVu_U'

export const supabaseClient = createClient(supabaseUrl, supabaseKey)