
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing Supabase environment variables.')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function keepAlive() {
    console.log(`Pinging Supabase at ${new Date().toISOString()}...`)

    try {
        // Perform a lightweight read operation.
        // Querying 'information_schema' or a known public table is usually safe.
        // Here we'll try to select 1 row from 'auth.users' which might fail if permissions aren't tight,
        // so let's try a health check or a simple rpc if available, or just a table select.
        // Since we are using the anon key, we should query something accessible publically or
        // just rely on the connection itself keeping the project active.

        // Attempt to read from a table that likely exists. 'species' is a good candidate from previous context.
        // If it fails, it still counts as activity.
        const { data, error } = await supabase.from('products').select('id').limit(1)

        if (error) {
            console.error('Supabase Ping Error Details:', JSON.stringify(error, null, 2))
            // Even if there is an error (e.g. RLS), the request hit the database, so it counts as activity.
            // We don't necessarily want to fail the script if it's just RLS, but we should log it.
        } else {
            console.log('Supabase Ping Success. Data received:', data)
        }

    } catch (err) {
        console.error('Unexpected Error:', err)
        process.exit(1)
    }
}

keepAlive()
