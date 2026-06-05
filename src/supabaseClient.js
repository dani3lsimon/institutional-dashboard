// src/supabaseClient.js

import { createClient } from '@supabase/supabase-js'

// Get your Supabase URL and Key from the Supabase project settings
const supabaseUrl = 'https://qviwrpyoammikkzougcz.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aXdycHlvYW1taWtrem91Z2N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MTgxOTUsImV4cCI6MjA5NjE5NDE5NX0.VfFQhSA65vngnkFPQ-tsmWT6TKGstqcCcP5TZaA-zWE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)