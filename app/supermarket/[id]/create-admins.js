// create-admins.js
import { createClient } from '@supabase/supabase-js'

// Replace with your Supabase credentials
const SUPABASE_URL = 'YOUR_SUPABASE_URL'
const SUPABASE_SERVICE_ROLE_KEY = 'YOUR_SUPABASE_SERVICE_ROLE_KEY'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const admins = [
  'washington.admin@gmail.com',
  'newyork.admin@gmail.com',
  'london.admin@gmail.com',
  'paris.admin@gmail.com',
  'berlin.admin@gmail.com',
  'tokyo.admin@gmail.com',
  'sydney.admin@gmail.com',
  'dubai.admin@gmail.com',
  'toronto.admin@gmail.com',
  'miami.admin@gmail.com',
  'amsterdam.admin@gmail.com',
  'barcelona.admin@gmail.com',
  'rome.admin@gmail.com',
  'cape.town.admin@gmail.com',
  'lisbon.admin@gmail.com',
  'seoul.admin@gmail.com',
  'boston.admin@gmail.com',
  'chicago.admin@gmail.com',
  'vienna.admin@gmail.com',
  'hongkong.admin@gmail.com',
]

async function createAdmins() {
  for (const email of admins) {
    try {
      // 1️⃣ Create Auth user
      const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email: email,
        password: 'Supa123!',
        email_confirm: true
      })

      if (userError) {
        console.error('Error creating user:', email, userError.message)
        continue
      }

      const userId = userData.id
      console.log('Created Auth user:', email, 'UUID:', userId)

      // 2️⃣ Insert into profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          { id: userId, role: 'admin', supermarket_id: null, created_at: new Date().toISOString() }
        ])

      if (profileError) console.error('Error inserting profile:', email, profileError.message)
      else console.log('Inserted into profiles:', email)

    } catch (err) {
      console.error('Unexpected error:', err)
    }
  }
}

createAdmins()
