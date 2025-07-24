// src/supabaseClient.js

import { createClient } from '@supabase/supabase-js'

// Get your Supabase URL and Key from the Supabase project settings
const supabaseUrl = 'https://hozumtcebtyznkjtzcic.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvenVtdGNlYnR5em5ranR6Y2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNTk0MDUsImV4cCI6MjA2ODkzNTQwNX0.h7akLn6vVyhxwAO2f_loeZME1wj0FX71BKiOAbAjM0E'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)