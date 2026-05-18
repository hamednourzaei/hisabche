import { supabaseClient } from './supabase'

export async function signIn(email: string, password: string) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabaseClient.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data } = await supabaseClient.auth.getSession()
  return data.session
}

export function onAuthChange(callback: (session: any) => void) {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
}